const supabase = require('../services/supabaseService');

async function adminMiddleware(req, res, next) {
    try {
        const email = req.user?.preferred_username || req.user?.username;
        if (!email) return res.status(401).json({ error: 'Unauthorized' });
        
        const { data } = await supabase
            .from('admin_users')
            .select('email')
            .eq('email', email.toLowerCase())
            .single();
            
        if (data) {
            return next();
        }
        
        return res.status(403).json({ error: 'Forbidden: Admin role required' });
    } catch (error) {
        console.error('Admin middleware error:', error);
        return res.status(403).json({ error: 'Forbidden: Admin role required' });
    }
}

module.exports = { adminMiddleware };
