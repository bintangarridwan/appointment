let myMSALObj;
let _authResolve;
const authReadyPromise = new Promise(resolve => { _authResolve = resolve; });

async function initAuth() {
    try {
        const res = await fetch('/api/config');
        const configData = await res.json();
        const msalConfig = {
            auth: {
                clientId: configData.clientId,
                authority: `https://login.microsoftonline.com/${configData.tenantId}`,
                redirectUri: window.location.origin
            }
        };
        myMSALObj = new msal.PublicClientApplication(msalConfig);
        await myMSALObj.initialize();
        
        const currentAccounts = myMSALObj.getAllAccounts();
        if (currentAccounts.length > 0) {
            handleResponse(currentAccounts[0]);
            _authResolve();
        } else {
            window.location.href = '/';
        }
    } catch (e) {
        console.error("Auth init error:", e);
    }
}

function handleResponse(account) {
    if (account) {
        myMSALObj.setActiveAccount(account);
        document.getElementById('auth-user-info').innerText = `Selamat Datang ${account.name}`;
        
        // Set the organizer input default value to logged in user
        const orgInput = document.getElementById('organizer');
        if (orgInput && !orgInput.value) {
            orgInput.value = account.username;
        }
    }
}

function signOut() {
    const logoutRequest = {
        account: myMSALObj.getActiveAccount(),
        mainWindowRedirectUri: window.location.origin
    };
    myMSALObj.logoutPopup(logoutRequest).then(() => {
        document.getElementById('global-loader').classList.add('modal-open');
        window.location.href = '/';
    });
}

// Helper: acquire ID token for API calls
async function getAuthHeaders() {
    const account = myMSALObj.getActiveAccount();
    if (!account) {
        window.location.href = '/';
        throw new Error('Not authenticated');
    }
    try {
        const response = await myMSALObj.acquireTokenSilent({
            scopes: ['User.Read'],
            account: account
        });
        return { 'Authorization': `Bearer ${response.idToken}` };
    } catch (e) {
        const response = await myMSALObj.acquireTokenPopup({
            scopes: ['User.Read']
        });
        return { 'Authorization': `Bearer ${response.idToken}` };
    }
}

// Authenticated fetch wrapper — adds Bearer token to all API calls
async function authFetch(url, options = {}) {
    const authHeaders = await getAuthHeaders();
    options.headers = { ...options.headers, ...authHeaders };
    const response = await fetch(url, options);
    if (response.status === 401) {
        window.location.href = '/';
        throw new Error('Session expired');
    }
    return response;
}

// Background session checker (auto-redirect if token expired)
setInterval(async () => {
    if (typeof myMSALObj === 'undefined') return;
    const account = myMSALObj.getActiveAccount();
    if (!account) return;
    try {
        await myMSALObj.acquireTokenSilent({
            scopes: ['User.Read'],
            account: account
        });
    } catch (e) {
        console.warn('Session expired in background, redirecting...');
        window.location.href = '/';
    }
}, 60000);

initAuth();
