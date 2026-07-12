require('dotenv').config();
const msal = require('@azure/msal-node');
const { Client } = require('@microsoft/microsoft-graph-client');
require('isomorphic-fetch');

const config = {
    auth: {
        clientId: process.env.CLIENT_ID,
        authority: `https://login.microsoftonline.com/${process.env.TENANT_ID}`,
        clientSecret: process.env.CLIENT_SECRET
    }
};

const cca = new msal.ConfidentialClientApplication(config);

async function getGraphClient() {
    const authResponse = await cca.acquireTokenByClientCredential({
        scopes: ['https://graph.microsoft.com/.default'],
    });

    return Client.init({
        authProvider: (done) => {
            done(null, authResponse.accessToken);
        }
    });
}

(async () => {
    try {
        const client = await getGraphClient();
        const start = new Date(Date.now() - 3600000).toISOString();
        const end = new Date(Date.now() + 86400000).toISOString();
        const email = process.env.ROOM_A_EMAIL || 'RM.Kuah@citarasakuliner.com';
        
        console.log("fetching...");
        const res = await client.api(`/users/${email}/calendarView`)
            .query({ startDateTime: start, endDateTime: end })
            .select('subject,start,end')
            .get();
        console.log("calendarView events:");
        console.log(JSON.stringify(res.value, null, 2));

    } catch (e) {
        console.error("ERROR:", e.message);
    }
})();
