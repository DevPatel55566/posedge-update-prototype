async function loadNasData() {
    try {
        const response = await fetch("/api/nas-folders");
        const folders = await response.json();
        const tbody = document.getElementById("nasBody");

        if (folders.length === 0) {
            tbody.innerHTML = `<tr><td colspan="2" style="text-align: center; padding: 20px;">No folders found on NAS.</td></tr>`;
            return;
        }

        folders.sort((a, b) => a.name.localeCompare(b.name));

        tbody.innerHTML = folders.map(folder => `
            <tr>
                <td style="font-weight: 600; color: #111827;">📁 ${folder.name}</td>
                <td>${new Date(folder.date).toLocaleString()}</td>
            </tr>
        `).join("");

    } catch (error) {
        console.error("Failed to load NAS data:", error);
    }
}

loadNasData();
setInterval(loadNasData, 10000); 