import fs from "fs";
import path from "path";

export function scanLicense(dataPath) {
  if (!fs.existsSync(dataPath)) {
    return {
      detected: false,
      reason: `Data path does not exist: ${dataPath}`
    };
  }

  try {
    const files = fs.readdirSync(dataPath, {
      withFileTypes: true
    });

    const licenseFiles = files.filter(
      entry =>
        entry.isFile() &&
        path.extname(entry.name).toLowerCase() === ".lic"
    );

    if (!licenseFiles.length) {
      return {
        detected: false,
        reason: "No .lic file found in the directory"
      };
    }

    const fileName = licenseFiles[0].name;
    const fullPath = path.join(dataPath, fileName);

    const text = fs.readFileSync(fullPath, "utf8");

    const lines = text
      .split(/\r?\n/)
      .map(line => line.trim());

    const nonEmpty = lines.filter(Boolean);

    const name = nonEmpty[0] || "Unknown client";

    const address = [
      lines[2],
      lines[3],
      lines[4]
    ]
      .filter(Boolean)
      .join(", ");

    return {
      detected: true,
      fileName,
      name,
      address,
      path: fullPath
    };
  } catch (error) {
    return {
      detected: false,
      reason: `Error reading files: ${error.message}`
    };
  }
}