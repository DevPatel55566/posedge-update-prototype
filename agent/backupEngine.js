import { spawn } from "child_process";

export function performBackup(dataPath, nasPath, clientName) {
  return new Promise((resolve, reject) => {
    if (!clientName) {
      return reject(new Error("Client name not detected. Cannot create backup folder."));
    }

    const safeClientName = clientName.replace(/[<>:"/\\|?*]+/g, "").trim();
    
    // Using the exact folder name from your NAS
    const remoteDestination = `synology:XTREME POS DATA/${safeClientName}`;
    
    console.log(`[BACKUP] Starting rclone backup from: ${dataPath}`);
    console.log(`[BACKUP] Destination: ${remoteDestination}`);

    const rcloneArgs = [
      "sync",
      `"${dataPath}"`,
      `"${remoteDestination}"`,
      "--no-check-certificate",
      "--transfers", "4",
      "--create-empty-src-dirs"
    ];

    // HARDCODED PATH TO RCLONE (from your machine)const rclonePath = "C:\\Users\\USER\\AppData\\Local\\Microsoft\\WinGet\\Links\\rclone.exe";
    const rclonePath = "rclone";


    console.log(`[BACKUP] Running: ${rclonePath} ${rcloneArgs.join(" ")}`);

    const cmd = spawn(rclonePath, rcloneArgs, { shell: true });

    let stdout = "";
    let stderr = "";

    cmd.stdout.on("data", (data) => { stdout += data.toString(); });
    cmd.stderr.on("data", (data) => { stderr += data.toString(); });

    cmd.on("close", (code) => {
      if (code === 0) {
        console.log(`[BACKUP] Backup completed successfully via rclone.`);
        resolve({ success: true, destination: remoteDestination });
      } else {
        console.error(`[BACKUP] Backup failed with exit code ${code}`);
        console.error(`[BACKUP] Error Details: ${stderr || stdout}`);
        reject(new Error(`rclone failed with exit code ${code}`));
      }
    });
  });
}