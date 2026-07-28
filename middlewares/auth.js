require('dotenv').config();
const jwt = require('jsonwebtoken');
const jwksRsa = require('jwks-rsa');

const jwksClient = jwksRsa({
    jwksUri: `https://login.microsoftonline.com/${process.env.TENANT_ID}/discovery/v2.0/keys`,
    cache: true,
    cacheMaxAge: 86400000
});

function getSigningKey(header, callback) {
    jwksClient.getSigningKey(header.kid, (err, key) => {
        if (err) return callback(err);
        callback(null, key.getPublicKey());
    });
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
    if (req.method === 'GET') return next();
    authMiddleware(req, res, next);
}

module.exports = { authMiddleware, publicGetMiddleware };
