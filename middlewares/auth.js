require('dotenv').config();
const jwt = require('jsonwebtoken');

let jwksClient = null;

async function getJwksClient() {
    if (!jwksClient) {
        let jwksRsa;
        try {
            jwksRsa = require('jwks-rsa');
        } catch (err) {
            if (err.code === 'ERR_REQUIRE_ESM') {
                const mod = await import('jwks-rsa');
                jwksRsa = mod.default || mod;
            } else {
                throw err;
            }
        }
        const tenantId = process.env.TENANT_ID || 'common';
        jwksClient = jwksRsa({
            jwksUri: `https://login.microsoftonline.com/${tenantId}/discovery/v2.0/keys`,
            cache: true,
            cacheMaxAge: 86400000
        });
    }
    return jwksClient;
}

function getSigningKey(header, callback) {
    getJwksClient()
        .then(client => {
            client.getSigningKey(header.kid, (err, key) => {
                if (err) return callback(err);
                callback(null, key.getPublicKey());
            });
        })
        .catch(err => callback(err));
}



function authMiddleware(req, res, next) {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    const token = authHeader.split(' ')[1];

    jwt.verify(token, getSigningKey, {
        audience: process.env.CLIENT_ID,
        issuer: `https://login.microsoftonline.com/${process.env.TENANT_ID}/v2.0`,
        algorithms: ['RS256']
    }, (err, decoded) => {
        if (err) {
            console.error('Token validation error:', err.message);
            return res.status(401).json({ error: 'Invalid token' });
        }
        req.user = decoded;
        next();
    });
}

function publicGetMiddleware(req, res, next) {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
        return authMiddleware(req, res, next);
    }
    if (req.method === 'GET') return next();
    return res.status(401).json({ error: 'Unauthorized' });
}

module.exports = { authMiddleware, publicGetMiddleware };
