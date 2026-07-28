const { Client } = require('@microsoft/microsoft-graph-client');
require('isomorphic-fetch');
const cca = require('../config/msal');

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

module.exports = { getGraphClient };
