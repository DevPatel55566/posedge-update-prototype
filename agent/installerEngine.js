import fs from "fs";
import { spawn } from "child_process";

export async function runInstaller(installerPath) {
  console.log("\n==========================================");
  console.log("[INSTALLER] Launching UniversalPOS Setup");
  console.log("==========================================");
  console.log(`[INSTALLER] File: ${installerPath}`);

  if (!fs.existsSync(installerPath)) {
    throw new Error(`Installer file does not exist: ${installerPath}`);
  }

  // Just open the file. You will click "Next" yourself.
  spawn("cmd.exe", ["/c", "start", "", installerPath], { detached: true, stdio: 'ignore' }).unref();
  
  return { success: true };
}