const express = require('express');
const cors = require('cors');
const msal = require('@azure/msal-node');
const { Client } = require('@microsoft/microsoft-graph-client');
require('isomorphic-fetch');
require('dotenv').config();

const app = express();
app.use((req, res, next) => {
    const auth = req.headers.authorization;
    if (auth === 'Basic YWRtaW46MTIz') {
        return next();
    }
    res.setHeader('WWW-Authenticate', 'Basic realm="Aman"');
    res.status(401).send('Butuh Login');
});
app.use(cors());
app.use(express.json());
const path = require('path');
app.use(express.static(path.join(__dirname, 'public')));

const config = {
    auth: {
        clientId: process.env.CLIENT_ID,
        authority: `https://login.microsoftonline.com/${process.env.TENANT_ID}`,
        clientSecret: process.env.CLIENT_SECRET
    }
};

const cca = new msal.ConfidentialClientApplication(config);

async function getGraphClient() {
    const authResponse = await cca.acquireTokenByClientCredential({
        scopes: ['https://graph.microsoft.com/.default'],
    });

    return Client.init({
        authProvider: (done) => {
            done(null, authResponse.accessToken);
        }
    });
}

// Ganti email di bawah ini dengan email asli untuk Room A, B, C, D di tenant Anda
const rooms = [
    { id: 'A', name: 'Ruang Kuah LT 1', email: process.env.ROOM_A_EMAIL || 'RM.Kuah@citarasakuliner.com' },
    { id: 'B', name: 'Ruang Beef LT 2', email: process.env.ROOM_B_EMAIL || 'RM.Beef@citarasakuliner.com' },
    { id: 'C', name: 'Ruang Bojot LT 3', email: process.env.ROOM_C_EMAIL || 'RM.Bojot@citarasakuliner.com' },
    { id: 'D', name: 'Ruang Mozza LT 3', email: process.env.ROOM_D_EMAIL || 'RM.Mozza@citarasakuliner.com' },
];

app.get('/api/rooms', (req, res) => {
    res.json(rooms);
});

// Mendapatkan kalender events untuk sebuah room
app.get('/api/rooms/:id/events', async (req, res) => {
    try {
        const room = rooms.find(r => r.id === req.params.id);
        if (!room) return res.status(404).send('Room not found');

        const client = await getGraphClient();
        
        const now = new Date();
        const endOfWeek = new Date();
        endOfWeek.setDate(now.getDate() + 7);

        // Uses application permissions to read calendars
        const response = await client.api(`/users/${room.email}/calendarView`)
            .query({
                startDateTime: now.toISOString(),
                endDateTime: endOfWeek.toISOString()
            })
            .select('subject,start,end,organizer')
            .orderby('start/dateTime')
            .get();

        res.json(response.value);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: error.message });
    }
});

// Mendapatkan semua events dari SEMUA room untuk Calendar View
app.get('/api/events', async (req, res) => {
    try {
        const client = await getGraphClient();
        const start = new Date(req.query.start || Date.now()).toISOString();
        const end = new Date(req.query.end || Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

        let allEvents = [];
        
        // Fetch dari semua room secara paralel
        await Promise.all(rooms.map(async (room) => {
            try {
                const response = await client.api(`/users/${room.email}/calendarView`)
                    .query({
                        startDateTime: start,
                        endDateTime: end
                    })
                    .select('subject,start,end,organizer')
                    .get();

                const formattedEvents = response.value.map(e => ({
                    id: e.id,
                    resourceId: room.id, // Untuk FullCalendar Resource View
                    roomEmail: room.email,
                    title: e.subject || 'Busy',
                    start: e.start.dateTime + 'Z', // Convert to UTC ISO
                    end: e.end.dateTime + 'Z',
                    organizer: e.organizer?.emailAddress?.name || e.organizer?.emailAddress?.address || '',
                    organizerEmail: e.organizer?.emailAddress?.address || ''
                }));
                allEvents = allEvents.concat(formattedEvents);
            } catch (err) {
                console.error(`Failed to fetch for ${room.email}:`, err.message);
            }
        }));

        res.json(allEvents);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: error.message });
    }
});

// Membooking ruang
app.post('/api/rooms/:id/book', async (req, res) => {
    try {
        const { subject, start, end, organizerEmail, attendees, isOnline } = req.body;
        const room = rooms.find(r => r.id === req.params.id);
        if (!room) return res.status(404).send('Room not found');

        const client = await getGraphClient();
        
        // Cek overlap booking
        const overlapRes = await client.api(`/users/${room.email}/calendarView`)
            .query({ startDateTime: start, endDateTime: end })
            .select('subject,organizer')
            .get();

        if (overlapRes && overlapRes.value && overlapRes.value.length > 0) {
            return res.status(400).json({ error: `${room.name} telah digunakan. Silahkan gunakan ruangan lain yang tersedia` });
        }

        let attendeeList = [
            {
                emailAddress: {
                    address: room.email,
                    name: room.name
                },
                type: 'resource'
            }
        ];

        if (attendees) {
            const extraEmails = attendees.split(',').map(e => e.trim()).filter(e => e);
            extraEmails.forEach(email => {
                if (email !== organizerEmail && email !== room.email) {
                    attendeeList.push({
                        emailAddress: { address: email },
                        type: 'required'
                    });
                }
            });
        }
        
        const event = {
            subject: subject,
            start: {
                dateTime: start,
                timeZone: 'UTC' 
            },
            end: {
                dateTime: end,
                timeZone: 'UTC'
            },
            location: {
                displayName: room.name,
                locationEmailAddress: room.email
            },
            attendees: attendeeList
        };

        if (isOnline) {
            event.isOnlineMeeting = true;
            event.onlineMeetingProvider = 'teamsForBusiness';
        }

        const response = await client.api(`/users/${organizerEmail}/events`)
            .post(event);

        res.status(201).json({ message: 'Booking successful', event: response });
    } catch (error) {
        console.error('Error booking room:', error.message);
        res.status(500).send(error.message);
    }
});

// Endpoint untuk autocomplete email
app.get('/api/users/search', async (req, res) => {
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
            console.error("Graph API search error (might lack User.Read.All):", graphError.message);
            // Fallback mock data jika belum ada permission User.Read.All di Azure AD
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
});

app.delete('/api/events/:roomEmail/:eventId', async (req, res) => {
    try {
        const client = await getGraphClient();
        await client.api(`/users/${req.params.roomEmail}/events/${req.params.eventId}`).delete();
        res.status(200).json({ message: 'Event canceled successfully' });
    } catch (error) {
        console.error('Error canceling event:', error.message);
        res.status(500).send(error.message);
    }
});

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const PORT = process.env.PORT || 3000;
if (require.main === module) {
    app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
}

module.exports = app;
