const supabase = require('./supabaseService');

async function writeLog(email, action, status, message) {
    try {
        // Fire and forget
        supabase.from('activity_logs').insert([
            { 
                user_email: email || 'Unknown', 
                action: action, 
                status: status, 
                message: message || '' 
            }
        ]).then(({ error }) => {
            if (error) console.error("Failed to write log to Supabase:", error.message);
        });
        
    } catch (e) {
        console.error("Log error:", e.message);
    }
}

async function getLogs() {
    try {
        const { data, error } = await supabase
            .from('activity_logs')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(1000); // Batasi 1000 log terakhir agar tidak memberatkan memori

        if (error) throw error;

        let logs = [];
        if (data) {
            logs = data.map(r => ({
                time: r.created_at,
                email: r.user_email,
                action: r.action,
                status: r.status,
                message: r.message
            }));
        }
        
        // Supabase tidak punya 'file size', kita kembalikan 0 agar UI tidak rusak
        return { logs, size: 0 };
    } catch (e) {
        console.error("Fetch log error:", e.message);
        return { logs: [], size: null };
    }
}

module.exports = { writeLog, getLogs };
