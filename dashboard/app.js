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

        tbody.innerHTML = agents.map(agent => {
            const isOnline = agent.status === "Online";
            const statusClass = isOnline ? "status-online" : "status-offline";
            
            const lastBk = agent.lastBackup ? new Date(agent.lastBackup).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' }) : '—';
            const nextBk = agent.nextBackup ? new Date(agent.nextBackup).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' }) : '—';

            return `
            <tr>
                <td>
                    <input type="text" class="folder-input" id="folder_${agent.computer}" 
                           value="${agent.folderName || ''}" placeholder="Enter backup folder name..."
                           onkeypress="handleEnter(event, '${agent.computer}')">
                </td>
                <td>${agent.computer}</td>
                <td class="${statusClass}">${isOnline ? 'Online' : 'Offline'}</td>
                <td>${lastBk}</td>
                <td>${nextBk}</td>
                <td style="text-align: center;">
                    <button class="btn-action" onclick="runBackup('${agent.computer}')" 
                        ${isOnline ? '' : 'disabled'}>
                        Save & Backup
                    </button>
                </td>
            </tr>
            `;
        }).join("");

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