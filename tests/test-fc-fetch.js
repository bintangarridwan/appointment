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
        
        // Simulasikan request dari FullCalendar (contoh info.startStr format)
        const start = "2026-07-12T00:00:00+07:00"; 
        const end = "2026-07-13T00:00:00+07:00";
        
        console.log("start parameter:", start);

        const email = process.env.ROOM_A_EMAIL || 'RM.Kuah@citarasakuliner.com';
        
        const response = await client.api(`/users/${email}/calendarView`)
            .query({
                startDateTime: start,
                endDateTime: end
            })
            .select('subject,start,end,organizer')
            .get();
            
        console.log("fetch success! returned:");
        console.log(JSON.stringify(response.value, null, 2));

        const formattedEvents = response.value.map(e => ({
            id: e.id,
            resourceId: 'A', // Untuk FullCalendar Resource View
            title: e.subject || 'Busy',
            start: e.start.dateTime + 'Z', // Convert to UTC ISO
            end: e.end.dateTime + 'Z',
            organizer: e.organizer?.emailAddress?.name || ''
        }));
        
        console.log("formatted:");
        console.log(JSON.stringify(formattedEvents, null, 2));
    } catch (e) {
        console.error("ERROR:", e.message);
    }
})();
