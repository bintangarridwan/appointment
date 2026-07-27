const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const jwt = require('jsonwebtoken');
const jwksRsa = require('jwks-rsa');
const msal = require('@azure/msal-node');
const { Client } = require('@microsoft/microsoft-graph-client');
require('isomorphic-fetch');
require('dotenv').config();

const app = express();

app.use(cors({
    origin: process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(',') : false
}));
app.use(express.json());
const path = require('path');
app.use(express.static(path.join(__dirname, 'public')));

// Rate limiting
const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many requests, please try again later.' }
});

const bookingLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many booking attempts, please try again later.' }
});

app.use('/api', apiLimiter);

// JWT Auth middleware — validates Azure AD tokens
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

// Apply auth to all /api routes except GET requests (public)
app.use('/api', (req, res, next) => {
    if (req.method === 'GET') return next();
    authMiddleware(req, res, next);
});

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

// Room config dari rooms.json, email bisa di-override via env var
const rooms = require('./rooms.json').map(room => ({
    ...room,
    email: process.env[`ROOM_${room.id}_EMAIL`] || room.email
}));

app.get('/api/rooms', (req, res) => {
    res.json(rooms);
});

app.get('/api/config', (req, res) => {
    res.json({
        clientId: process.env.CLIENT_ID,
        tenantId: process.env.TENANT_ID
    });
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
                    .select('subject,start,end,organizer,attendees')
                    .get();

                const formattedEvents = response.value.map(e => {
                    let orgName = e.organizer?.emailAddress?.name || e.organizer?.emailAddress?.address || '';
                    let orgEmail = e.organizer?.emailAddress?.address || '';
                    
                    // Jika organizer adalah ruangan itu sendiri (karena bypass invite),
                    // anggap attendee manusia pertama sebagai requester sebenarnya
                    if (orgEmail.toLowerCase() === room.email.toLowerCase()) {
                        const firstHuman = e.attendees?.find(a => a.type !== 'resource' && a.emailAddress?.address?.toLowerCase() !== room.email.toLowerCase());
                        if (firstHuman) {
                            orgName = firstHuman.emailAddress.name || firstHuman.emailAddress.address;
                            orgEmail = firstHuman.emailAddress.address;
                        }
                    }

                    return {
                        id: e.id,
                        resourceId: room.id, // Untuk FullCalendar Resource View
                        roomEmail: room.email,
                        title: e.subject || 'Busy',
                        start: e.start.dateTime + 'Z', // Convert to UTC ISO
                        end: e.end.dateTime + 'Z',
                        organizer: orgName,
                        organizerEmail: orgEmail,
                    attendeeCount: e.attendees ? e.attendees.filter(a => a.type !== 'resource').length : 0,
                    attendeesList: e.attendees ? e.attendees.filter(a => a.type !== 'resource').map(a => ({
                        name: a.emailAddress.name || a.emailAddress.address,
                        status: a.status ? a.status.response : 'unknown'
                    })) : []
                    };
                });
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
app.post('/api/rooms/:id/book', bookingLimiter, async (req, res) => {
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
                emailAddress: { address: room.email },
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
        
        // Buat string datetime tanpa Z untuk Graph API
        const startNoZ = start.replace('Z', '');
        const endNoZ = end.replace('Z', '');

        const event = {
            subject: subject,
            start: {
                dateTime: startNoZ,
                timeZone: 'UTC' 
            },
            end: {
                dateTime: endNoZ,
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

        // POST ke kalender requester, meng-invite ruangan (room auto-accepts)
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

// Cek ketersediaan attendees
app.post('/api/users/schedule', async (req, res) => {
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

        // Gunakan salah satu email room sebagai base path endpoint
        const response = await client.api(`/users/${rooms[0].email}/calendar/getSchedule`)
            .post(scheduleRequest);

        res.json(response.value);
    } catch (error) {
        console.error('Error getSchedule:', error.message);
        res.status(500).json({ error: error.message });
    }
});

// Endpoint untuk Address Book
app.get('/api/users/directory', async (req, res) => {
    try {
        const client = await getGraphClient();
        const response = await client.api('/users')
            .select('displayName,mail,jobTitle,department')
            .top(100)
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
});

app.delete('/api/events/:roomEmail/:eventId', async (req, res) => {
    try {
        const userEmail = req.user.preferred_username;
        const client = await getGraphClient();

        // Fetch event to verify ownership before deleting
        const event = await client.api(`/users/${req.params.roomEmail}/events/${req.params.eventId}`)
            .select('organizer,attendees,body')
            .get();

        const actualOrganizer = event.organizer?.emailAddress?.address?.toLowerCase();
        const inBody = event.body?.content?.toLowerCase().includes(userEmail.toLowerCase());
        const isAttendee = event.attendees?.some(a => a.emailAddress?.address?.toLowerCase() === userEmail.toLowerCase());

        if (actualOrganizer !== userEmail.toLowerCase() && !inBody && !isAttendee) {
            return res.status(403).json({ error: 'Hanya requester yang bisa membatalkan meeting ini' });
        }

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
