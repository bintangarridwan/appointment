require('dotenv').config();
const msal = require('@azure/msal-node');

let cca = null;

function getMsalClient() {
    if (!cca) {
        const clientId = process.env.CLIENT_ID;
        const tenantId = process.env.TENANT_ID;
        const clientSecret = process.env.CLIENT_SECRET;

        if (!clientId || !tenantId || !clientSecret) {
            throw new Error('Missing Azure AD credentials in environment variables (CLIENT_ID, TENANT_ID, CLIENT_SECRET)');
        }

        const config = {
            auth: {
                clientId,
                authority: `https://login.microsoftonline.com/${tenantId}`,
                clientSecret
            }
        };

        cca = new msal.ConfidentialClientApplication(config);
    }
    return cca;
}

module.exports = { getMsalClient };

