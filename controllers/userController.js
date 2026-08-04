const { getGraphClient } = require('../services/graphService');
const rooms = require('../services/roomService');

exports.searchUsers = async (req, res) => {
    try {
        const query = (req.query.q || '').toLowerCase();
        if (!query || query.length < 2) return res.json([]);

        let users = [];
        try {
            const client = await getGraphClient();
            const response = await client.api('/users')
                .filter(`startswith(mail,'${query}') or startswith(displayName,'${query}')`)
                .select('displayName,mail')
                .top(10)
                .get();
            
            users = response.value.filter(u => u.mail).map(u => ({
                name: u.displayName,
                email: u.mail
            }));
        } catch (graphError) {
            console.error("Graph API search error:", graphError.message);
            const mockUsers = [
                { name: 'Bintang Arridwan', email: 'bintang.arridwan@citarasakuliner.com' },
                { name: 'Admin Room', email: 'admin@citarasakuliner.com' }
            ];
            users = mockUsers.filter(u => 
                u.email.toLowerCase().includes(query) || 
                u.name.toLowerCase().includes(query)
            );
        }

        res.json(users);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: error.message });
    }
};

exports.getSchedule = async (req, res) => {
    try {
        const { emails, startTime, endTime } = req.body;
        if (!emails || !emails.length || !startTime || !endTime) {
            return res.status(400).json({ error: 'Missing emails, startTime, or endTime' });
        }

        const client = await getGraphClient();
        
        const scheduleRequest = {
            schedules: emails,
            startTime: { dateTime: startTime, timeZone: 'UTC' },
            endTime: { dateTime: endTime, timeZone: 'UTC' },
            availabilityViewInterval: 30
        };

        const response = await client.api(`/users/${rooms[0].email}/calendar/getSchedule`)
            .post(scheduleRequest);

        res.json(response.value);
    } catch (error) {
        console.error('Error getSchedule:', error.message);
        res.status(500).json({ error: error.message });
    }
};

exports.getDirectory = async (req, res) => {
    try {
        const client = await getGraphClient();
        const response = await client.api('/users')
            .select('displayName,mail,jobTitle,department')
            .top(999)
            .get();
        
        const users = response.value
            .filter(u => u.mail)
            .map(u => ({
                name: u.displayName || '-',
                email: u.mail || '-',
                title: u.jobTitle || '-',
                department: u.department || '-'
            }));
        res.json(users);
    } catch (error) {
        console.error("Directory error:", error.message);
        res.status(500).json({ error: error.message });
    }
};
