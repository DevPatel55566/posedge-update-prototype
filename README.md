# PosEdge Update Manager — Prototype V1

This prototype establishes the local dashboard/server, Windows agent, WebSocket connection, `C:\Posedge\Data` scanning, `.lic` discovery, client-name/address extraction based on the supplied sample, and the Run Update command path.

## Requirements
- Windows
- Node.js 20+

## Server
```powershell
cd server
npm install
Copy-Item .env.example .env
```
Edit `.env` and set `AGENT_TOKEN`.
Then:
```powershell
npm start
```
Open `http://localhost:3000`.

## Agent
In another terminal:
```powershell
cd agent
npm install
Copy-Item config.example.json config.json
```
Edit `config.json` so `agentToken` exactly matches the server `.env` token.
Then:
```powershell
npm start
```

If `C:\Posedge\Data` contains a `.lic` file, the dashboard should show the detected client.

Run Update Prototype only tests communication. It does not yet log into UniversalPOS or install software.
