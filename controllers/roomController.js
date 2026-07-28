const { getGraphClient } = require('../services/graphService');
const rooms = require('../services/roomService');

exports.getRooms = (req, res) => {
    res.json(rooms);
};

exports.getConfig = (req, res) => {
    res.json({
        clientId: process.env.CLIENT_ID,
        tenantId: process.env.TENANT_ID
    });
};

exports.getRoomEvents = async (req, res) => {
    try {
        const room = rooms.find(r => r.id === req.params.id);
        if (!room) return res.status(404).send('Room not found');

        const client = await getGraphClient();
        
        const now = new Date();
        const endOfWeek = new Date();
        endOfWeek.setDate(now.getDate() + 7);

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
};

exports.getAllEvents = async (req, res) => {
    try {
        const client = await getGraphClient();
        const start = new Date(req.query.start || Date.now()).toISOString();
        const end = new Date(req.query.end || Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

        let allEvents = [];
        
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
                    
                    if (orgEmail.toLowerCase() === room.email.toLowerCase()) {
                        const firstHuman = e.attendees?.find(a => a.type !== 'resource' && a.emailAddress?.address?.toLowerCase() !== room.email.toLowerCase());
                        if (firstHuman) {
                            orgName = firstHuman.emailAddress.name || firstHuman.emailAddress.address;
                            orgEmail = firstHuman.emailAddress.address;
                        }
                    }

                    return {
                        id: e.id,
                        resourceId: room.id,
                        roomEmail: room.email,
                        title: e.subject || 'Busy',
                        start: e.start.dateTime + 'Z',
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
};

exports.bookRoom = async (req, res) => {
    try {
        const { subject, start, end, organizerEmail, attendees, isOnline } = req.body;
        const room = rooms.find(r => r.id === req.params.id);
        if (!room) return res.status(404).send('Room not found');

        const client = await getGraphClient();
        
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
        
        const startNoZ = start.replace('Z', '');
        const endNoZ = end.replace('Z', '');

        const event = {
            subject: subject,
            start: { dateTime: startNoZ, timeZone: 'UTC' },
            end: { dateTime: endNoZ, timeZone: 'UTC' },
            attendees: attendeeList
        };

        if (isOnline) {
            event.isOnlineMeeting = true;
            event.onlineMeetingProvider = 'teamsForBusiness';
        }

        const response = await client.api(`/users/${organizerEmail}/events`).post(event);

        res.status(201).json({ message: 'Booking successful', event: response });
    } catch (error) {
        console.error('Error booking room:', error.message);
        res.status(500).send(error.message);
    }
};

exports.deleteEvent = async (req, res) => {
    try {
        const userEmail = req.user.preferred_username;
        const client = await getGraphClient();

        const event = await client.api(`/users/${req.params.roomEmail}/events/${req.params.eventId}`)
            .select('organizer,attendees,body,iCalUId')
            .get();

        const actualOrganizer = event.organizer?.emailAddress?.address?.toLowerCase();

        if (actualOrganizer !== userEmail.toLowerCase()) {
            return res.status(403).json({ error: 'Hanya organizer yang bisa membatalkan meeting ini' });
        }

        if (actualOrganizer && event.iCalUId) {
            // Cari event asli di kalender organizer pakai iCalUId
            const orgEventRes = await client.api(`/users/${actualOrganizer}/events`)
                .filter(`iCalUId eq '${event.iCalUId}'`)
                .select('id')
                .get();

            if (orgEventRes.value && orgEventRes.value.length > 0) {
                const orgEventId = orgEventRes.value[0].id;
                // Cancel event dari organizer agar terhapus di kalender semua orang
                await client.api(`/users/${actualOrganizer}/events/${orgEventId}/cancel`).post({
                    Comment: "Dibatalkan melalui sistem booking ruangan."
                });
                return res.status(200).json({ message: 'Event canceled successfully for all attendees' });
            }
        }

        // Fallback jika tidak nemu di organizer: hapus dari kalender ruangan saja
        await client.api(`/users/${req.params.roomEmail}/events/${req.params.eventId}`).delete();
        res.status(200).json({ message: 'Event removed from room successfully' });
    } catch (error) {
        console.error('Error canceling event:', error.message);
        res.status(500).send(error.message);
    }
};
