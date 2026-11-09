import { spawn } from "child_process";
import path from "path";
import fs from "fs";

export function performBackup(dataPath, nasPath, folderName) {
  return new Promise((resolve, reject) => {
    if (!folderName) return reject(new Error("Folder name is required."));

    if (!fs.existsSync(dataPath)) {
        return reject(new Error(`Source folder does not exist: ${dataPath}`));
    }

    const safeFolderName = folderName.replace(/[<>:"/\\|?*]+/g, "").trim();
    
    // Using the working Synology-R remote
    const remoteDestination = `Synology-R:XTREME POS DATA/${safeFolderName}`;
    
    const configPath = path.join(process.cwd(), "rclone.conf");
    if (!fs.existsSync(configPath)) {
        return reject(new Error(`rclone.conf is MISSING from the agent folder!`));
    }

    const rcloneArgs = [
      "copy",
      dataPath,
      remoteDestination,
      "--config", configPath,
      "--create-empty-src-dirs",
      "--transfers", "1",       
      "--checkers", "1",        
      "--buffer-size", "4M",    
      "--retries", "1",         
      "--low-level-retries", "1",
      "--contimeout", "15s",
      "--timeout", "10m",
      "--local-no-check-updated",
      "--exclude", "*.tmp",
      "--exclude", "*.partial",
      "--exclude", "*.lock"
    ];

    console.log(`[BACKUP] Starting rclone for ${folderName} using Synology-R...`);
    
    const cmd = spawn("rclone", rcloneArgs, { windowsHide: true });
    
    let stderr = "";

    cmd.stderr.on("data", (data) => { 
        stderr += data.toString(); 
        console.log(`[RCLONE ERROR] ${data.toString().trim()}`);
    });

    cmd.on("error", (err) => {
        reject(new Error(`Failed to start rclone. ${err.message}`));
    });

    cmd.on("close", (code) => {
      if (code === 0) {
          console.log(`[BACKUP] Success!`);
          resolve({ success: true, destination: remoteDestination });
      } else {
          reject(new Error(`rclone failed with code ${code}. Details: ${stderr}`));
      }
    });
  });
}