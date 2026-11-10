const renderedRows = {};

async function loadClients() {
    try {
        const response = await fetch("/api/status");
        const agents = await response.json();
        
        // Sort alphabetically by folder name
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
            tbody.innerHTML = `<tr><td colspan="8" style="text-align: center; padding: 20px;">No agents connected yet.</td></tr>`;
            return;
        }

        if (tbody.children.length === 1 && tbody.children[0].children.length === 1) {
            tbody.innerHTML = "";
        }

        agents.forEach((agent, index) => {
            let tr = renderedRows[agent.id];

            if (!tr) {
                tr = document.createElement("tr");
                tr.innerHTML = `
                    <td class="col-srno" style="text-align: center; font-weight: bold; color: #6b7280;"></td>
                    <td>
                        <input type="text" class="folder-input" id="folder_${agent.id}" 
                               value="${agent.folderName || ''}" placeholder="Enter backup folder name..."
                               onkeypress="handleEnter(event, '${agent.id}')">
                    </td>
                    <td><strong>${agent.computer}</strong></td>
                    <td class="col-date-started" style="color: #6b7280; font-size: 13px;"></td>
                    <td class="col-status"></td>
                    <td class="col-last"></td>
                    <td class="col-next"></td>
                    <td style="text-align: center;">
                        <button class="btn-action" onclick="runBackup('${agent.id}')">Save & Backup</button>
                    </td>
                `;
                renderedRows[agent.id] = tr;
                tbody.appendChild(tr);
            }

            // Update Sr No based on the sorted index
            tr.querySelector(".col-srno").textContent = index + 1;

            // Update Date Started
            tr.querySelector(".col-date-started").textContent = agent.dateStarted ? new Date(agent.dateStarted).toLocaleDateString() : '—';

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

            const input = tr.querySelector(".folder-input");
            if (input && document.activeElement !== input) {
                if (agent.folderName && input.value !== agent.folderName) {
                    input.value = agent.folderName;
                }
            }
        });

        agents.forEach(agent => {
            tbody.appendChild(renderedRows[agent.id]);
        });

    } catch (error) {
        console.error("Failed to load clients:", error);
    }
}

function handleEnter(event, agentId) {
    if (event.key === "Enter") {
        runBackup(agentId);
    }
}

async function runBackup(agentId) {
    const folderInput = document.getElementById(`folder_${agentId}`);
    if (!folderInput) return;
    
    let folderName = folderInput.value.trim();

    if (!folderName) {
        alert("Please enter a backup folder name.");
        return;
    }

    try {
        const response = await fetch("/api/run-backup", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ agentId: agentId, folderName: folderName })
        });
        
        if (response.ok) {
            const btn = folderInput.parentElement.nextElementSibling.nextElementSibling.nextElementSibling.nextElementSibling.nextElementSibling.nextElementSibling.querySelector('button');
            if(btn) {
                btn.textContent = "Sent!";
                setTimeout(() => { btn.textContent = "Save & Backup"; }, 2000);
            }
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