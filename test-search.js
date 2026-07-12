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
    const authResponse = await cca.acquireTokenByClientCredential({ scopes: ['https://graph.microsoft.com/.default'] });
    return Client.init({ authProvider: (done) => done(null, authResponse.accessToken) });
}

(async () => {
    try {
        const client = await getGraphClient();
        const query = 'bin';
        const response = await client.api('/users')
            .filter(`startswith(mail,'${query}') or startswith(displayName,'${query}')`)
            .select('displayName,mail')
            .top(5)
            .get();
        console.log(response.value);
    } catch (e) {
        console.error("ERROR:", e.message);
    }
})();
