const { writeLog, getLogs } = require('../services/logService');

exports.getLogsList = async (req, res) => {
    try {
        const userEmail = req.user ? (req.user.preferred_username || req.user.upn || req.user.email || '') : '';
        if (!userEmail) {
            return res.status(403).json({ error: 'Unauthorized' });
        }
        const logs = await getLogs();
        res.json(logs);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
};

exports.logLogin = async (req, res) => {
    try {
        const userEmail = req.user ? (req.user.preferred_username || req.user.upn || req.user.email || req.body.email || 'Unknown') : 'Unknown';
        writeLog(userEmail, "LOGIN", "SUCCESS", "User logged in via MSAL");
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
};
