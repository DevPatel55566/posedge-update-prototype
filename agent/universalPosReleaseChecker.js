import https from "https";

const BASE_URL = "https://universalpos.net";
const LOGIN_URL = `${BASE_URL}/login.asp`;
const VERIFY_URL = `${BASE_URL}/verify.asp`;
const RELEASE_PAGE = `${BASE_URL}/welcomeupos.asp`;

function request(method, url, options = {}) {
  return new Promise((resolve, reject) => {
    const req = https.request(
      url,
      {
        method,
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/140.0.0.0 Safari/537.36",
          "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          "Accept-Language": "en-US,en;q=0.9",
          "Cache-Control": "no-cache",
          ...options.headers
        }
      },
      (res) => {
        let body = "";
        res.setEncoding("utf8");
        res.on("data", chunk => { body += chunk; });
        res.on("end", () => {
          resolve({
            statusCode: res.statusCode,
            headers: res.headers,
            body
          });
        });
      }
    );

    req.on("error", reject);
    if (options.body) req.write(options.body);
    req.end();
  });
}

function mergeCookies(existing, setCookie) {
  const jar = new Map();
  for (const cookie of existing || []) {
    const pair = cookie.split(";")[0];
    const index = pair.indexOf("=");
    if (index > 0) jar.set(pair.substring(0, index), pair.substring(index + 1));
  }
  for (const cookie of setCookie || []) {
    const pair = cookie.split(";")[0];
    const index = pair.indexOf("=");
    if (index > 0) jar.set(pair.substring(0, index), pair.substring(index + 1));
  }
  return [...jar.entries()].map(([name, value]) => `${name}=${value}`).join("; ");
}

function extractToken(html) {
  const match = html.match(/name=["']_token["'][^>]*value=["']([^"']+)["']/i);
  return match ? match[1] : null;
}

function extractRedirect(headers) {
  return headers.location || null;
}

function parseLatestRelease(html) {
  const matches = [];
  const regex = /href=["']([^"']*universal(\d{7})\.exe)["']/gi;
  let match;

  while ((match = regex.exec(html)) !== null) {
    const relativeUrl = match[1];
    const versionNumber = match[2];
    matches.push({
      versionNumber,
      fileName: `universal${versionNumber}.exe`,
      url: new URL(relativeUrl, BASE_URL).href
    });
  }

  if (!matches.length) {
    throw new Error("No UniversalPOS installer releases were found on the dealer portal.");
  }

  matches.sort((a, b) => Number(b.versionNumber) - Number(a.versionNumber));
  return matches[0];
}

export async function getLatestRelease(username, password) {
  console.log("\n==========================================");
  console.log("[UNIVERSALPOS] LOGIN DIAGNOSTIC");
  console.log("==========================================");

  if (!username || !password) {
    throw new Error("UniversalPOS username/password are missing from agent config.json.");
  }

  let cookies = [];

  // STEP 1: Open login page
  console.log("[UNIVERSALPOS] STEP 1: Opening login page");
  const loginResponse = await request("GET", LOGIN_URL);
  console.log(`[UNIVERSALPOS] Login page status: ${loginResponse.statusCode}`);
  console.log(`[UNIVERSALPOS] Login page URL: ${LOGIN_URL}`);

  cookies = mergeCookies(cookies, loginResponse.headers["set-cookie"]);
  console.log(`[UNIVERSALPOS] Cookies received: ${cookies ? cookies.split("; ").map(x => x.split("=")[0]).join(", ") : "none"}`);

  const token = extractToken(loginResponse.body);
  if (!token) throw new Error("Could not find UniversalPOS login token on login.asp.");
  console.log("[UNIVERSALPOS] Login token found.");

  // STEP 2: Submit login
  console.log("[UNIVERSALPOS] STEP 2: Submitting credentials to /verify.asp");
  const formBody = new URLSearchParams({
    _token: token,
    txtUsername: username,
    txtPassword: password,
    chkR: "true"
  }).toString();

  const verifyResponse = await request("POST", VERIFY_URL, {
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "Content-Length": Buffer.byteLength(formBody),
      "Cookie": cookies,
      "Origin": BASE_URL,
      "Referer": LOGIN_URL,
      "Upgrade-Insecure-Requests": "1"
    },
    body: formBody
  });

  cookies = mergeCookies(cookies, verifyResponse.headers["set-cookie"]);
  console.log(`[UNIVERSALPOS] Verify status: ${verifyResponse.statusCode}`);
  console.log(`[UNIVERSALPOS] Verify redirect: ${extractRedirect(verifyResponse.headers) || "none"}`);
  console.log(`[UNIVERSALPOS] Cookies after login: ${cookies ? cookies.split("; ").map(x => x.split("=")[0]).join(", ") : "none"}`);

  const bodyLower = verifyResponse.body.toLowerCase();
  console.log(`[UNIVERSALPOS] Response contains "namefailed": ${bodyLower.includes("namefailed")}`);
  console.log(`[UNIVERSALPOS] Response contains "login.asp": ${bodyLower.includes("login.asp")}`);
  console.log(`[UNIVERSALPOS] Response contains "welcomeupos": ${bodyLower.includes("welcomeupos")}`);

  const preview = verifyResponse.body.replace(/password[^<]{0,100}/gi, "[REDACTED]").substring(0, 1000);
  console.log("[UNIVERSALPOS] Response preview:");
  console.log(preview);

  const location = extractRedirect(verifyResponse.headers);
  if (location && location.includes("login=namefailed")) {
    throw new Error("UniversalPOS rejected the login request with login=namefailed.");
  }
  if (verifyResponse.body.includes("login=namefailed")) {
    throw new Error("UniversalPOS rejected the login request with login=namefailed.");
  }

  // STEP 3: Open dealer portal
  console.log("[UNIVERSALPOS] STEP 3: Opening dealer portal");
  const portalResponse = await request("GET", RELEASE_PAGE, {
    headers: {
      "Cookie": cookies,
      "Referer": LOGIN_URL
    }
  });

  console.log(`[UNIVERSALPOS] Dealer portal status: ${portalResponse.statusCode}`);
  console.log(`[UNIVERSALPOS] Dealer portal redirect: ${extractRedirect(portalResponse.headers) || "none"}`);

  const portalLower = portalResponse.body.toLowerCase();
  if (portalLower.includes("login.asp") || portalLower.includes("namefailed")) {
    throw new Error("UniversalPOS login session was not accepted. Dealer portal redirected back to login.");
  }
  if (!portalLower.includes("dealer portal") || !portalLower.includes("universal pos")) {
    throw new Error("UniversalPOS dealer portal could not be verified.");
  }

  // STEP 4: Find newest release
  const latest = parseLatestRelease(portalResponse.body);
  console.log("\n[UNIVERSALPOS] Latest release found:");
  console.log(`[UNIVERSALPOS] Version: ${latest.versionNumber}`);
  console.log(`[UNIVERSALPOS] File: ${latest.fileName}`);
  console.log(`[UNIVERSALPOS] URL: ${latest.url}\n`);

  return { ...latest, cookies };
}