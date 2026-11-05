let allHistoryData = []; // Store data globally for filtering

async function getHistory() {
  try {
    const response = await fetch("/api/history");
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    allHistoryData = await response.json();
    renderTable(allHistoryData);
  } catch (error) {
    console.error("History error:", error);
    document.getElementById("historyBody").innerHTML = `<tr><td colspan="5" style="text-align: center; padding: 40px; color: #b42318;">Failed to load history.</td></tr>`;
  }
}

function renderTable(data) {
    const tbody = document.getElementById("historyBody");
    
    if (data.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" style="text-align: center; padding: 40px; color: #9ca3af;">No records found.</td></tr>`;
        return;
    }

    tbody.innerHTML = data.map(item => {
      const isSuccess = item.status === 'Success';
      const badgeClass = isSuccess ? 'badge-success' : 'badge-failed';
      
      // Get initials for the avatar
      const initials = item.computer ? item.computer.substring(0, 2).toUpperCase() : 'PC';

      return `
      <tr>
          <td>
              <div class="computer-cell">
                  <div class="avatar">${initials}</div>
                  <div>
                      <div style="font-weight: 600; color: #111827;">${item.client}</div>
                      <div style="font-size: 12px; color: #6b7280; font-weight: normal;">${item.computer}</div>
                  </div>
              </div>
          </td>
          <td style="font-weight: 500;">${item.action}</td>
          <td><span class="badge ${badgeClass}">${item.status}</span></td>
          <td style="color: #6b7280; max-width: 300px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${item.details}">${item.details}</td>
          <td style="color: #6b7280; font-size: 13px;">${formatDate(item.timestamp)}</td>
      </tr>
      `;
    }).join("");
}

// NEW: Search functionality
function filterTable() {
    const query = document.getElementById("searchInput").value.toLowerCase();
    const filteredData = allHistoryData.filter(item => 
        (item.client && item.client.toLowerCase().includes(query)) || 
        (item.computer && item.computer.toLowerCase().includes(query)) ||
        (item.action && item.action.toLowerCase().includes(query))
    );
    renderTable(filteredData);
}

function formatDate(value) { 
    if (!value) return "—"; 
    try { 
        const d = new Date(value);
        return d.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' }) + ' at ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }); 
    } catch { 
        return value; 
    } 
}

// Load immediately and refresh every 5 seconds (CRM style)
getHistory();
setInterval(getHistory, 5000);