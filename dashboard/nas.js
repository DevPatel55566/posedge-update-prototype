async function loadNasData() {
    try {
        const response = await fetch("/api/nas-folders");
        const folders = await response.json();
        const tbody = document.getElementById("nasBody");

        if (!folders || folders.length === 0) {
            tbody.innerHTML = `<tr><td colspan="4" style="text-align: center; padding: 20px;">No folders found on NAS.</td></tr>`;
            return;
        }

        // Sort alphabetically
        folders.sort((a, b) => a.name.localeCompare(b.name));

        tbody.innerHTML = folders.map((folder, index) => {
            const dateObj = new Date(folder.date);
            const formattedDate = dateObj.toLocaleString([], { dateStyle: 'short', timeStyle: 'short' });

            return `
            <tr>
                <td style="text-align: center; font-weight: bold; color: #6b7280;">${index + 1}</td>
                <td style="font-weight: 600; color: #111827;">📁 ${folder.name}</td>
                <td>${formattedDate}</td>
                <td>${formattedDate}</td>
            </tr>
            `;
        }).join("");

    } catch (error) {
        console.error("Failed to load NAS data:", error);
        document.getElementById("nasBody").innerHTML = `<tr><td colspan="4" style="text-align: center; padding: 20px; color: red;">Failed to load NAS data.</td></tr>`;
    }
}

loadNasData();
setInterval(loadNasData, 10000); // Refresh every 10 seconds