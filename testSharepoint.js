const { getGraphClient } = require('./services/graphService');

async function testSharepoint() {
    try {
        const client = await getGraphClient();
        
        console.log("Fetching site ID...");
        const site = await client.api('/sites/citarasakuliner.sharepoint.com:/sites/IT').get();
        console.log("Site ID:", site.id);
        
        console.log("Adding row to TableLog...");
        const response = await client.api(`/sites/${site.id}/drive/items/2eb5a897-31a6-4b9c-b49d-a8d0cc7d9873/workbook/tables/TableLog/rows`).post({
            "values": [
                [new Date().toISOString(), "test@citarasakuliner.com", "LOGIN", "SUCCESS", ""]
            ]
        });
        console.log("Added row:", response.index);

        
    } catch (e) {
        console.error("Error:", e.message);
        if (e.body) console.error(e.body);
    }
}

testSharepoint();
