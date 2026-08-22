const { writeLog, getLogs } = require('../services/logService');

exports.getLogsList = async (req, res) => {
    try {
        const userEmail = req.user ? (req.user.preferred_username || req.user.upn || req.user.email || '') : '';
        if (userEmail.toLowerCase() !== 'bintang.arridwan@citarasakuliner.com') {
            return res.status(403).json({ error: 'Hanya Admin yang dapat melihat log' });
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
