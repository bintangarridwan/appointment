const fs = require('fs');
const path = require('path');
const { getGraphClient } = require('../services/graphService');
const { writeLog } = require('../services/logService');
const rooms = require('../services/roomService');
const supabase = require('../services/supabaseService');

exports.getRooms = (req, res) => {
    res.json(rooms);
};

exports.getConfig = (req, res) => {
    res.json({
        clientId: process.env.CLIENT_ID,
        tenantId: process.env.TENANT_ID
    });
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
                    .select('subject,start,end,organizer,attendees,type,seriesMasterId')
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
                            email: a.emailAddress.address,
                            status: a.status ? a.status.response : 'unknown'
                        })) : [],
                        type: e.type,
                        seriesMasterId: e.seriesMasterId || null
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

function generateInstances(startIso, endIso, recurrence) {
    const instances = [];
    const s = new Date(startIso);
    const e = new Date(endIso);
    const duration = e.getTime() - s.getTime();
    
    if (!recurrence) {
        instances.push({ start: s, end: e });
        return instances;
    }
    
    const pattern = recurrence.pattern;
    const range = recurrence.range;
    const endDate = new Date(range.endDate + 'T23:59:59Z'); 
    let current = new Date(s.getTime());
    
    if (pattern.type === 'daily') {
        const interval = pattern.interval || 1;
        while (current <= endDate) {
            instances.push({ start: new Date(current), end: new Date(current.getTime() + duration) });
            current.setUTCDate(current.getUTCDate() + interval);
        }
    } else if (pattern.type === 'weekly') {
        const interval = pattern.interval || 1;
        const dayMap = { 'sunday':0, 'monday':1, 'tuesday':2, 'wednesday':3, 'thursday':4, 'friday':5, 'saturday':6 };
        const allowedDays = pattern.daysOfWeek.map(d => dayMap[d.toLowerCase()]);
        let weekStart = new Date(current);
        weekStart.setUTCDate(weekStart.getUTCDate() - weekStart.getUTCDay());
        while (weekStart <= endDate) {
            for (let i = 0; i < 7; i++) {
                let day = new Date(weekStart);
                day.setUTCDate(day.getUTCDate() + i);
                if (day >= s && day <= endDate && allowedDays.includes(day.getUTCDay())) {
                    let instStart = new Date(day);
                    instStart.setUTCHours(s.getUTCHours(), s.getUTCMinutes(), s.getUTCSeconds());
                    instances.push({ start: instStart, end: new Date(instStart.getTime() + duration) });
                }
            }
            weekStart.setUTCDate(weekStart.getUTCDate() + (7 * interval));
        }
    } else if (pattern.type === 'absoluteMonthly') {
        const interval = pattern.interval || 1;
        const targetDay = pattern.dayOfMonth || 1;
        current.setUTCDate(1);
        while (current <= endDate) {
            let instStart = new Date(current);
            instStart.setUTCDate(targetDay);
            if (instStart.getUTCDate() === targetDay && instStart >= s && instStart <= endDate) {
                instStart.setUTCHours(s.getUTCHours(), s.getUTCMinutes(), s.getUTCSeconds());
                instances.push({ start: instStart, end: new Date(instStart.getTime() + duration) });
            }
            current.setUTCMonth(current.getUTCMonth() + interval);
        }
    }
    return instances;
}

exports.bookRoom = async (req, res) => {
    try {
        const { subject, start, end, organizerEmail, attendees, isOnline, recurrence } = req.body;
        const room = rooms.find(r => r.id === req.params.id);
        if (!room) return res.status(404).send('Room not found');

        const instances = generateInstances(start, end, recurrence);

        // TASK 3: Cek Blokir Akhir Pekan (Weekend Block)
        const { data: settingData } = await supabase
            .from('app_settings')
            .select('value')
            .eq('key', 'allow_weekend_booking')
            .single();
            
        const allowWeekend = settingData ? (settingData.value === true || settingData.value === 'true') : true;

        if (!allowWeekend) {
            for (let inst of instances) {
                const day = inst.start.getDay(); // 0 = Sunday, 6 = Saturday
                if (day === 0 || day === 6) {
                    const errorMsg = "Pemesanan dibatalkan: Admin sedang menutup akses pemesanan untuk hari Sabtu dan Minggu.";
                    writeLog(organizerEmail, "BOOKING", "FAILED", errorMsg);
                    return res.status(400).json({ error: errorMsg });
                }
            }
        }

        // TASK 4: Cek Kunci Ruangan (Blackout Dates)
        // Kita ambil semua kunci untuk ruangan ini yang waktunya bersinggungan dengan checkStart dan checkEnd
        let checkStart = start;
        let checkEnd = end;
        if (recurrence) {
            checkEnd = new Date(recurrence.range.endDate + "T23:59:59Z").toISOString();
        }

        const { data: locks, error: lockErr } = await supabase
            .from('room_locks')
            .select('*')
            .eq('room_email', room.email)
            // Kunci ruangan tumpang tindih jika: lock.start < checkEnd AND lock.end > checkStart
            .lt('start_time', checkEnd)
            .gt('end_time', checkStart);

        if (!lockErr && locks && locks.length > 0) {
            // Karena ini recurrence, kita cek lebih detail per instance apakah benar-benar nabrak
            for (let inst of instances) {
                const instStart = inst.start.getTime();
                const instEnd = inst.end.getTime();
                
                for (let lock of locks) {
                    const lockStart = new Date(lock.start_time).getTime();
                    const lockEnd = new Date(lock.end_time).getTime();
                    
                    // Cek overlap
                    if (instStart < lockEnd && instEnd > lockStart) {
                        const errorMsg = `Pemesanan dibatalkan: Ruangan sedang dikunci oleh Admin. Alasan: ${lock.reason}`;
                        writeLog(organizerEmail, "BOOKING", "FAILED", errorMsg);
                        return res.status(400).json({ error: errorMsg });
                    }
                }
            }
        }

        const client = await getGraphClient();
        
        const overlapRes = await client.api(`/users/${room.email}/calendarView`)
            .query({ startDateTime: checkStart, endDateTime: checkEnd })
            .select('subject,start,end')
            .top(999)
            .get();

        const existingEvents = overlapRes.value || [];
        const conflicts = [];
        
        for (let inst of instances) {
            for (let ev of existingEvents) {
                const evStart = new Date(ev.start.dateTime + 'Z');
                const evEnd = new Date(ev.end.dateTime + 'Z');
                if (inst.start < evEnd && inst.end > evStart) {
                    conflicts.push({ date: inst.start, subject: ev.subject });
                    break;
                }
            }
        }

        if (conflicts.length > 0) {
            const conflictDates = conflicts.slice(0, 3).map(c => c.date.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long' })).join(', ');
            const more = conflicts.length > 3 ? ` dan ${conflicts.length - 3} hari lainnya` : '';
            const errorMsg = `Pemesanan dibatalkan: ${room.name} sudah terpakai pada ${conflictDates}${more}. Silakan ubah jadwal Anda.`;
            writeLog(organizerEmail, "BOOKING", "FAILED", errorMsg);
            return res.status(400).json({ error: errorMsg });
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
        
        if (recurrence) {
            event.recurrence = recurrence;
        }

        const response = await client.api(`/users/${organizerEmail}/events`).post(event);

        writeLog(organizerEmail, "BOOKING", "SUCCESS", `Berhasil booking ${room.name}`);
        res.status(201).json({ message: 'Booking successful', event: response });
    } catch (error) {
        console.error('Error booking room:', error.message);
        const organizerEmail = req.body.organizerEmail || 'Unknown';
        writeLog(organizerEmail, "BOOKING", "FAILED", error.message);
        res.status(500).send(error.message);
    }
};

exports.deleteEvent = async (req, res) => {
    try {
        const userEmail = req.user ? (req.user.preferred_username || req.user.upn || req.user.email || '') : '';
        if (!userEmail) {
            return res.status(401).json({ error: 'Unauthorized: User email not found in token' });
        }
        const client = await getGraphClient();


        const event = await client.api(`/users/${req.params.roomEmail}/events/${req.params.eventId}`)
            .select('organizer,attendees,body,iCalUId,subject')
            .get();

        const actualOrganizer = event.organizer?.emailAddress?.address?.toLowerCase();
        const isAdmin = userEmail.toLowerCase() === 'bintang.arridwan@citarasakuliner.com';

        if (actualOrganizer !== userEmail.toLowerCase() && !isAdmin) {
            return res.status(403).json({ error: 'Hanya organizer atau Admin yang bisa membatalkan meeting ini' });
        }

        const subjectTitle = event.subject || 'Meeting';

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
                writeLog(userEmail, "CANCEL", "SUCCESS", `Membatalkan '${subjectTitle}' di ${req.params.roomEmail}`);
                return res.status(200).json({ message: 'Event canceled successfully for all attendees' });
            }
        }

        // Fallback jika tidak nemu di organizer: hapus dari kalender ruangan saja
        await client.api(`/users/${req.params.roomEmail}/events/${req.params.eventId}`).delete();
        writeLog(userEmail, "CANCEL", "SUCCESS", `Membatalkan '${subjectTitle}' di ${req.params.roomEmail}`);
        res.status(200).json({ message: 'Event removed from room successfully' });
    } catch (error) {
        console.error('Error canceling event:', error.message);
        const userEmail = req.user ? (req.user.preferred_username || req.user.email) : 'Unknown';
        writeLog(userEmail, "CANCEL", "FAILED", error.message);
        res.status(500).send(error.message);
    }
};

exports.updateEvent = async (req, res) => {
    try {
        const userEmail = req.user ? (req.user.preferred_username || req.user.upn || req.user.email || '') : '';
        if (!userEmail) {
            return res.status(401).json({ error: 'Unauthorized: User email not found in token' });
        }
        const client = await getGraphClient();
        const { roomEmail, eventId } = req.params;
        const { attendees, start, end } = req.body;

        const event = await client.api(`/users/${roomEmail}/events/${eventId}`)
            .select('organizer,attendees,iCalUId,subject,start,end')
            .get();

        const actualOrganizer = event.organizer?.emailAddress?.address?.toLowerCase();

        if (actualOrganizer !== userEmail.toLowerCase()) {
            return res.status(403).json({ error: 'Hanya organizer yang bisa mengedit meeting ini' });
        }
        
        let patchData = {};

        // 1. Process attendees if provided (even empty string clears them)
        if (attendees !== undefined) {
            let newAttendees = [];
            const roomAttendee = event.attendees.find(a => a.type === 'resource' || a.emailAddress.address.toLowerCase() === roomEmail.toLowerCase());
            if (roomAttendee) newAttendees.push(roomAttendee);
            else newAttendees.push({ emailAddress: { address: roomEmail }, type: 'resource' });

            if (attendees) {
                const extraEmails = attendees.split(',').map(e => e.trim()).filter(e => e);
                extraEmails.forEach(email => {
                    if (email.toLowerCase() !== actualOrganizer && email.toLowerCase() !== roomEmail.toLowerCase()) {
                        newAttendees.push({
                            emailAddress: { address: email },
                            type: 'required'
                        });
                    }
                });
            }
            patchData.attendees = newAttendees;
        }

        // 2. Process time if provided
        if (start && end) {
            // Validate weekend
            const { data: settingData } = await supabase
                .from('app_settings')
                .select('value')
                .eq('key', 'allow_weekend_booking')
                .single();
            const allowWeekend = settingData ? (settingData.value === true || settingData.value === 'true') : true;

            const startDate = new Date(start);
            const endDate = new Date(end);
            
            if (!allowWeekend) {
                const day = startDate.getDay();
                if (day === 0 || day === 6) {
                    return res.status(400).json({ error: "Pemesanan dibatalkan: Admin sedang menutup akses pemesanan untuk hari Sabtu dan Minggu." });
                }
            }

            // Validate room locks
            const { data: locks, error: lockErr } = await supabase
                .from('room_locks')
                .select('*')
                .eq('room_email', roomEmail)
                .lt('start_time', end)
                .gt('end_time', start);

            if (!lockErr && locks && locks.length > 0) {
                const errorMsg = `Pemesanan dibatalkan: Ruangan sedang dikunci oleh Admin. Alasan: ${locks[0].reason}`;
                return res.status(400).json({ error: errorMsg });
            }

            // Validate overlaps
            const overlapRes = await client.api(`/users/${roomEmail}/calendarView`)
                .query({ startDateTime: start, endDateTime: end })
                .select('id,subject,start,end,seriesMasterId')
                .top(999)
                .get();

            const existingEvents = overlapRes.value || [];
            const conflicts = [];
            
            for (let ev of existingEvents) {
                if (ev.id === eventId || ev.seriesMasterId === eventId) continue;
                
                const evStart = new Date(ev.start.dateTime + 'Z');
                const evEnd = new Date(ev.end.dateTime + 'Z');
                
                if (startDate < evEnd && endDate > evStart) {
                    conflicts.push({ date: startDate, subject: ev.subject });
                }
            }

            if (conflicts.length > 0) {
                const errorMsg = `Gagal update: Ruangan sudah terpakai oleh meeting "${conflicts[0].subject}" pada waktu tersebut.`;
                return res.status(400).json({ error: errorMsg });
            }

            const startNoZ = start.replace('Z', '');
            const endNoZ = end.replace('Z', '');
            patchData.start = { dateTime: startNoZ, timeZone: 'UTC' };
            patchData.end = { dateTime: endNoZ, timeZone: 'UTC' };
        }

        if (Object.keys(patchData).length === 0) {
            return res.status(400).json({ error: "Tidak ada data yang diubah" });
        }

        if (actualOrganizer && event.iCalUId) {
            const orgEventRes = await client.api(`/users/${actualOrganizer}/events`)
                .filter(`iCalUId eq '${event.iCalUId}'`)
                .select('id')
                .get();

            if (orgEventRes.value && orgEventRes.value.length > 0) {
                const orgEventId = orgEventRes.value[0].id;
                try {
                    await client.api(`/users/${actualOrganizer}/events/${orgEventId}`).patch(patchData);
                } catch (e) {
                    console.log("Failed to patch organizer event:", e.message);
                }
            }
        }

        try {
            await client.api(`/users/${roomEmail}/events/${eventId}`).patch(patchData);
        } catch (e) {
            console.log("Failed to patch room event:", e.message);
        }
        
        writeLog(userEmail, "UPDATE", "SUCCESS", `Memperbarui event '${event.subject}' di ${roomEmail}`);
        res.status(200).json({ message: 'Event updated successfully' });

    } catch (error) {
        console.error('Error updating event:', error.message);
        const userEmail = req.user ? (req.user.preferred_username || req.user.email) : 'Unknown';
        writeLog(userEmail, "UPDATE", "FAILED", error.message);
        res.status(500).send(error.message);
    }
};

