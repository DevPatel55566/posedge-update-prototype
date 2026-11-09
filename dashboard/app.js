// Store rendered rows so we can update them without wiping your typing
const renderedRows = {};

async function loadClients() {
    try {
        const response = await fetch("/api/status");
        const agents = await response.json();
        
        agents.sort((a, b) => {
            const nameA = a.folderName || "";
            const nameB = b.folderName || "";
            if (nameA && nameB) return nameA.localeCompare(nameB);
            return a.computer.localeCompare(b.computer);
        });

        const tbody = document.getElementById("clientsBody");
        const countLabel = document.getElementById("clientCount");

        countLabel.innerHTML = `${agents.length} clients found for Xtreme Tech Solutions`;

        if (agents.length === 0) {
            tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; padding: 20px;">No agents connected yet.</td></tr>`;
            return;
        }

        if (tbody.children.length === 1 && tbody.children[0].children.length === 1) {
            tbody.innerHTML = "";
        }

        agents.forEach((agent, index) => {
            let tr = renderedRows[agent.computer];

            if (!tr) {
                tr = document.createElement("tr");
                tr.innerHTML = `
                    <td>
                        <input type="text" class="folder-input" id="folder_${agent.computer}" 
                               placeholder="Enter backup folder name..."
                               onkeypress="handleEnter(event, '${agent.computer}')">
                    </td>
                    <td><strong>${agent.computer}</strong></td>
                    <td class="col-status"></td>
                    <td class="col-last"></td>
                    <td class="col-next"></td>
                    <td style="text-align: center;">
                        <button class="btn-action" onclick="runBackup('${agent.computer}')">Save & Backup</button>
                    </td>
                `;
                renderedRows[agent.computer] = tr;
                tbody.appendChild(tr);
            }

            const isOnline = agent.status === "Online";
            const statusTd = tr.querySelector(".col-status");
            statusTd.textContent = isOnline ? "Online" : "Offline";
            statusTd.className = `col-status ${isOnline ? 'status-online' : 'status-offline'}`;

            tr.querySelector(".col-last").textContent = agent.lastBackup ? new Date(agent.lastBackup).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' }) : '—';
            tr.querySelector(".col-next").textContent = agent.nextBackup ? new Date(agent.nextBackup).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' }) : '—';

            const btn = tr.querySelector(".btn-action");
            btn.disabled = !isOnline;
            btn.style.backgroundColor = isOnline ? '#ffffff' : '#cccccc';
            btn.style.cursor = isOnline ? 'pointer' : 'not-allowed';

            // Only update the input if the user is NOT currently typing
            const input = tr.querySelector(".folder-input");
            if (input && document.activeElement !== input) {
                if (agent.folderName && input.value !== agent.folderName) {
                    input.value = agent.folderName;
                }
            }
        });

        agents.forEach(agent => {
            tbody.appendChild(renderedRows[agent.computer]);
        });

    } catch (error) {
        console.error("Failed to load clients:", error);
    }
}

function handleEnter(event, computerName) {
    if (event.key === "Enter") {
        runBackup(computerName);
    }
}

async function runBackup(computerName) {
    const folderInput = document.getElementById(`folder_${computerName}`);
    let folderName = folderInput.value.trim();

    if (!folderName) {
        folderName = computerName; 
        folderInput.value = folderName; 
    }

    if (!confirm(`Run backup for ${computerName} into folder "${folderName}"?`)) return;
    
    try {
        const response = await fetch("/api/run-backup", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ computer: computerName, folderName })
        });
        
        if (response.ok) {
            loadClients();
        } else {
            alert("Failed to reach agent. It might be offline.");
        }
    } catch (e) {
        alert("Server error.");
    }
}

loadClients();
setInterval(loadClients, 5000);