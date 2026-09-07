const supabase = require('../services/supabaseService');

exports.getWeekendSetting = async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('app_settings')
            .select('value')
            .eq('key', 'allow_weekend_booking')
            .single();

        if (error) throw error;
        res.json({ allow_weekend_booking: data ? data.value : true });
    } catch (error) {
        console.error('Error getting weekend setting:', error);
        res.status(500).json({ error: error.message });
    }
};

exports.toggleWeekendSetting = async (req, res) => {
    try {
        const { allow_weekend_booking } = req.body;
        const { error } = await supabase
            .from('app_settings')
            .update({ value: allow_weekend_booking })
            .eq('key', 'allow_weekend_booking');

        if (error) throw error;
        res.json({ success: true, allow_weekend_booking });
    } catch (error) {
        console.error('Error toggling weekend setting:', error);
        res.status(500).json({ error: error.message });
    }
};

exports.getRoomLocks = async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('room_locks')
            .select('*')
            .order('start_time', { ascending: true });

        if (error) throw error;
        res.json(data || []);
    } catch (error) {
        console.error('Error getting room locks:', error);
        res.status(500).json({ error: error.message });
    }
};

exports.addRoomLock = async (req, res) => {
    try {
        const { room_email, start_time, end_time, reason } = req.body;
        const { data, error } = await supabase
            .from('room_locks')
            .insert([{ room_email, start_time, end_time, reason }])
            .select();

        if (error) throw error;
        res.json({ success: true, lock: data[0] });
    } catch (error) {
        console.error('Error adding room lock:', error);
        res.status(500).json({ error: error.message });
    }
};

exports.deleteRoomLock = async (req, res) => {
    try {
        const { id } = req.params;
        const { error } = await supabase
            .from('room_locks')
            .delete()
            .eq('id', id);

        if (error) throw error;
        res.json({ success: true });
    } catch (error) {
        console.error('Delete room lock error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

// Admin Users Management
exports.checkAdminStatus = async (req, res) => {
    try {
        const email = req.user.preferred_username || req.user.username;
        if (!email) return res.status(401).json({ isAdmin: false });
        
        // Check DB
        
        const { data } = await supabase
            .from('admin_users')
            .select('email')
            .eq('email', email.toLowerCase())
            .single();
            
        return res.json({ isAdmin: !!data });
    } catch (error) {
        console.error('Check admin status error:', error);
        res.json({ isAdmin: false });
    }
};

exports.getAdminUsers = async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('admin_users')
            .select('*')
            .order('created_at', { ascending: false });
            
        if (error) throw error;
        
        res.json({ admins: data });
    } catch (error) {
        console.error('Get admin users error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

exports.addAdminUser = async (req, res) => {
    try {
        const { email } = req.body;
        const added_by = req.user.preferred_username || req.user.username;
        
        if (!email) return res.status(400).json({ error: 'Email is required' });
        
        const { error } = await supabase
            .from('admin_users')
            .insert([{ email: email.toLowerCase(), added_by }]);
            
        if (error) {
            if (error.code === '23505') return res.status(400).json({ error: 'Admin sudah terdaftar.' });
            throw error;
        }
        
        res.json({ success: true });
    } catch (error) {
        console.error('Add admin user error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

exports.deleteAdminUser = async (req, res) => {
    try {
        const email = req.params.email;
        
        const { error } = await supabase
            .from('admin_users')
            .delete()
            .eq('email', email);
            
        if (error) throw error;
        res.json({ success: true });
    } catch (error) {
        console.error('Delete admin user error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

exports.getAnalytics = async (req, res) => {
    try {
        // Top 3 Rooms
        const { data: roomLogs, error: roomError } = await supabase
            .from('activity_logs')
            .select('message')
            .eq('action', 'BOOKING')
            .eq('status', 'SUCCESS');
            
        if (roomError) throw roomError;

        const roomCounts = {};
        roomLogs.forEach(log => {
            const roomName = log.message.replace('Berhasil booking ', '');
            roomCounts[roomName] = (roomCounts[roomName] || 0) + 1;
        });
        const topRooms = Object.entries(roomCounts)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 3)
            .map(e => ({ name: e[0], count: e[1] }));

        // Top 3 Users
        const { data: userLogs, error: userError } = await supabase
            .from('activity_logs')
            .select('user_email')
            .eq('action', 'BOOKING')
            .eq('status', 'SUCCESS');

        if (userError) throw userError;

        const userCounts = {};
        userLogs.forEach(log => {
            userCounts[log.user_email] = (userCounts[log.user_email] || 0) + 1;
        });
        const topUsers = Object.entries(userCounts)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 3)
            .map(e => ({ email: e[0], count: e[1] }));

        // Top 3 Hours (Booking creation hours)
        const { data: timeLogs, error: timeError } = await supabase
            .from('activity_logs')
            .select('created_at')
            .eq('action', 'BOOKING')
            .eq('status', 'SUCCESS');

        if (timeError) throw timeError;

        const hourCounts = {};
        timeLogs.forEach(log => {
            // Supabase returns UTC created_at (e.g. 2026-08-22T08:00:00.000Z)
            // Convert to Jakarta time (UTC+7)
            const date = new Date(log.created_at);
            // Adjust to timezone +7 to get local hour
            const localHour = (date.getUTCHours() + 7) % 24;
            const hourStr = `${localHour.toString().padStart(2, '0')}:00`;
            hourCounts[hourStr] = (hourCounts[hourStr] || 0) + 1;
        });
        const topHours = Object.entries(hourCounts)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 3)
            .map(e => ({ hour: e[0], count: e[1] }));

        res.json({
            rooms: topRooms,
            users: topUsers,
            hours: topHours
        });
    } catch (error) {
        console.error('Error getting analytics:', error);
        res.status(500).json({ error: error.message });
    }
};
