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
        console.error('Error deleting room lock:', error);
        res.status(500).json({ error: error.message });
    }
};
