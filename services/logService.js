const { getGraphClient } = require('./graphService');

const SITE_ID = 'citarasakuliner.sharepoint.com,dd91e39f-0bec-457b-8322-ac67d232f602,f7286f5b-de72-4c2c-b542-917d6b64b266';
const FILE_ID = '2eb5a897-31a6-4b9c-b49d-a8d0cc7d9873';
const TABLE_NAME = 'TableLog';

async function writeLog(email, action, status, message) {
    try {
        const client = await getGraphClient();
        const time = new Date().toISOString();
        
        // Fire and forget, no need to wait
        client.api(`/sites/${SITE_ID}/drive/items/${FILE_ID}/workbook/tables/${TABLE_NAME}/rows`).post({
            "values": [
                [time, email || 'Unknown', action, status, message || '']
            ]
        }).catch(err => console.error("Failed to write log to Excel:", err.message));
        
    } catch (e) {
        console.error("Log error:", e.message);
    }
}

async function getLogs() {
    try {
        const client = await getGraphClient();
        // Get rows from the table and file metadata concurrently
        const [res, itemRes] = await Promise.all([
            client.api(`/sites/${SITE_ID}/drive/items/${FILE_ID}/workbook/tables/${TABLE_NAME}/rows`).get(),
            client.api(`/sites/${SITE_ID}/drive/items/${FILE_ID}`).select('size').get().catch(() => ({ size: null }))
        ]);
        
        let logs = [];
        if (res && res.value) {
            // Map rows back to objects. Headers: Waktu, Email, Aksi, Status, Pesan_Eror
            // We read them backwards to get newest first
            const rows = res.value.reverse();
            logs = rows.map(r => {
                return {
                    time: r.values[0][0],
                    email: r.values[0][1],
                    action: r.values[0][2],
                    status: r.values[0][3],
                    message: r.values[0][4]
                };
            }).filter(log => log.time); // filter out empty rows
        }
        return { logs, size: itemRes.size };
    } catch (e) {
        console.error("Fetch log error:", e.message);
        return { logs: [], size: null };
    }
}

module.exports = { writeLog, getLogs };
