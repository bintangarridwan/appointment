let calendar;
let monthCalendar;
let currentEventContext = null;
const colors = ['#6366f1', '#0ea5e9', '#10b981', '#f59e0b', '#ec4899'];

function closeEventModal() {
    document.getElementById('eventModal').classList.remove('modal-open');
}

function updateRoomStatusLogs(events, resources) {
    const wrapper = document.getElementById('active-logs-wrapper');
    const container = document.getElementById('active-logs');
    if (!events || events.length === 0) {
        wrapper.style.display = 'none';
        return;
    }
    wrapper.style.display = 'block';
    container.innerHTML = '';
    
    const now = new Date();
    
    resources.forEach(room => {
        const roomEvents = events.filter(e => e.resourceId === room.id).map(e => ({
            ...e,
            startObj: new Date(e.start),
            endObj: new Date(e.end)
        })).sort((a, b) => a.startObj - b.startObj);
        
        let activeEvent = null;
        let nextEvent = null;
        
        for (let i = 0; i < roomEvents.length; i++) {
            const ev = roomEvents[i];
            if (now >= ev.startObj && now <= ev.endObj) {
                activeEvent = ev;
            } else if (ev.startObj > now && !nextEvent) {
                nextEvent = ev;
            }
        }
        
        let statusClass = 'inactive';
        let statusText = 'Available';
        if (activeEvent) {
            statusClass = 'active';
            statusText = 'In Use';
        } else if (nextEvent && nextEvent.startObj.toDateString() === now.toDateString()) {
            statusClass = 'upcoming';
            statusText = 'Upcoming';
        }
        
        const card = document.createElement('div');
        card.className = `log-card ${statusClass}`;
        
        let html = `
            <div class="log-room-name">${room.title}</div>
            <div class="log-status ${statusClass}">${statusText}</div>
        `;
        
        const timeOpts = {hour: '2-digit', minute:'2-digit'};
        
        if (activeEvent) {
            html += `
                <div class="log-detail"><i data-lucide="clock"></i> <span>${activeEvent.startObj.toLocaleTimeString([], timeOpts)} - ${activeEvent.endObj.toLocaleTimeString([], timeOpts)}</span></div>
                <div class="log-detail"><i data-lucide="file-text"></i> <span class="log-title">${activeEvent.title}</span></div>
                <div class="log-detail"><i data-lucide="user"></i> <span>${activeEvent.organizer || activeEvent.organizerEmail || '-'}</span></div>
                <div class="log-detail"><i data-lucide="users"></i> <span>${activeEvent.attendeeCount || 0} Attendees</span></div>
            `;
        } else if (statusClass === 'inactive') {
            html += `
                <div class="log-detail" style="opacity:0.6;"><i data-lucide="info"></i> <span>Room is currently empty</span></div>
            `;
        }
        
        if (nextEvent) {
            const isToday = nextEvent.startObj.toDateString() === now.toDateString();
            const dayStr = isToday ? 'Today' : nextEvent.startObj.toLocaleDateString();
            html += `
                <div class="next-booking">
                    Next: <strong>${nextEvent.title}</strong><br>
                    ${dayStr}, ${nextEvent.startObj.toLocaleTimeString([], timeOpts)} - ${nextEvent.endObj.toLocaleTimeString([], timeOpts)}
                </div>
            `;
        }
        
        card.innerHTML = html;
        container.appendChild(card);
    });
    
    lucide.createIcons({ root: container });
}

document.addEventListener('DOMContentLoaded', async function() {
    try {
        // Load Rooms
        const res = await fetch('/api/rooms');
        if (!res.ok) throw new Error("Gagal mengambil data ruang");
        const rooms = await res.json();
        
        document.getElementById('stat-rooms').innerText = rooms.length;

        const hiddenInput = document.getElementById('room-select');
        const menu = document.getElementById('room-select-menu');
        const btn = document.getElementById('room-select-btn');
        
        const resources = rooms.map((room, index) => {
            const li = document.createElement('li');
            const a = document.createElement('a');
            a.innerText = room.name;
            a.onclick = (e) => {
                e.preventDefault();
                hiddenInput.value = room.id;
                btn.innerHTML = `${room.name} <i data-lucide="chevron-down" class="w-4 h-4"></i>`;
                if (window.lucide) lucide.createIcons();
                document.activeElement.blur();
            };
            li.appendChild(a);
            menu.appendChild(li);

            return {
                id: room.id,
                title: room.name,
                eventColor: colors[index % colors.length]
            };
        });

        // Initialize Calendar
        const calendarEl = document.getElementById('calendar');
        calendar = new FullCalendar.Calendar(calendarEl, {
            schedulerLicenseKey: 'CC-Attribution-NonCommercial-NoDerivatives',
            initialView: 'resourceTimelineDay',
            customButtons: {
                refreshBtn: {
                    text: 'Refresh',
                    click: function() {
                        calendar.refetchEvents();
                        if (typeof showToast !== 'undefined') showToast("Kalender diperbarui", "success");
                    }
                }
            },
            headerToolbar: {
                left: 'prev,next today',
                center: 'title',
                right: 'refreshBtn'
            },
            height: 'auto',
            stickyHeaderDates: false,
            buttonText: {
                today: 'Today',
                resourceTimelineDay: 'Timeline'
            },
            slotMinTime: '07:00:00',
            slotMaxTime: '20:00:00',
            slotDuration: '01:00:00',
            resourceAreaWidth: '20%',
            resourceAreaHeaderContent: 'Rooms',
            resources: resources,
            events: function(info, successCallback, failureCallback) {
                fetch(`/api/events?start=${encodeURIComponent(info.startStr)}&end=${encodeURIComponent(info.endStr)}`)
                    .then(response => response.json())
                    .then(data => {
                        successCallback(data);
                        updateRoomStatusLogs(data, resources);
                        const todayStr = new Date().toDateString();
                        
                        let todayCount = 0;
                        data.forEach(e => {
                            if (new Date(e.start).toDateString() === todayStr) {
                                todayCount++;
                            }
                        });
                        
                        document.getElementById('today-meetings-count').innerText = todayCount;
                    })
                    .catch(err => failureCallback(err));
            },
            eventContent: function(arg) {
                return {
                    html: `<div style="display:flex; flex-direction:column; gap:2px; width:100%; padding:0 2px;">
                             <div style="font-size: 11px; opacity: 0.9; display:flex; align-items:center; gap:4px; line-height: 1.2; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${arg.event.extendedProps.organizer || arg.event.extendedProps.organizerEmail || 'N/A'}">
                                 <i data-lucide="user" style="width:10px; height:10px; flex-shrink: 0;"></i>
                                 <span style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${arg.event.extendedProps.organizer || arg.event.extendedProps.organizerEmail || 'N/A'}</span>
                             </div>
                             <div style="font-size: 13px; font-weight: 600; line-height: 1.2; white-space: normal; overflow: hidden; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical;" title="${arg.event.title}">${arg.event.title}</div>
                           </div>`
                };
            },
            eventDidMount: function(arg) {
                lucide.createIcons({ root: arg.el });
            },
            eventClick: function(arg) {
                const event = arg.event;
                currentEventContext = event;
                
                const dateOptions = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
                document.getElementById('modalDate').innerText = event.start.toLocaleDateString(undefined, dateOptions);
                
                const startStr = event.start.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
                const endStr = event.end ? event.end.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : '';
                document.getElementById('modalTime').innerText = startStr + ' - ' + endStr;
                
                document.getElementById('modalSubject').innerText = event.title;
                
                const resource = event.getResources()[0];
                document.getElementById('modalRoom').innerText = resource ? resource.title : (event.extendedProps.roomEmail || 'N/A');
                
                const attendees = event.extendedProps.attendeesList || [];
                let attendeesHtml = 'None';
                if (attendees.length > 0) {
                    attendeesHtml = attendees.map(a => {
                        let badgeColor = '#6b7280';
                        let statusText = a.status || 'unknown';
                        if (statusText === 'accepted' || statusText === 'busy') badgeColor = '#10b981';
                        else if (statusText === 'declined') badgeColor = '#ef4444';
                        else if (statusText === 'tentativelyAccepted') { badgeColor = '#f59e0b'; statusText = 'tentative'; }
                        else if (statusText === 'organizer') badgeColor = '#3b82f6';
                        return `<div>${a.name} <span style="font-size:10px; font-weight:bold; color:${badgeColor}; padding:2px 6px; border-radius:4px; background:${badgeColor}20; margin-left:4px;">${statusText.toUpperCase()}</span></div>`;
                    }).join('');
                }
                document.getElementById('modalAttendees').innerHTML = attendeesHtml;
                
                document.getElementById('eventModal').classList.add('modal-open');
            },
            nowIndicator: true,
        });
        calendar.render();
        
        const monthCalendarEl = document.getElementById('month-calendar');
        if (monthCalendarEl) {
            monthCalendar = new FullCalendar.Calendar(monthCalendarEl, {
                schedulerLicenseKey: 'CC-Attribution-NonCommercial-NoDerivatives',
                initialView: 'dayGridMonth',
                height: 'auto',
                headerToolbar: {
                    left: 'prev,next today',
                    center: 'title',
                    right: ''
                },
                stickyHeaderDates: false,
                dateClick: function(info) {
                    calendar.gotoDate(info.dateStr);
                    
                    // Remove highlight from all cells
                    document.querySelectorAll('#month-calendar .fc-daygrid-day').forEach(el => {
                        el.style.backgroundColor = '';
                    });
                    // Add highlight to clicked cell
                    info.dayEl.style.backgroundColor = 'rgba(59, 130, 246, 0.2)';
                    
                    monthCalendar.gotoDate(info.dateStr);
                }
            });
            monthCalendar.render();
        }

        document.getElementById('btnCancelMeeting').addEventListener('click', () => {
            if (!currentEventContext) return;
            const event = currentEventContext;
            const roomEmail = event.extendedProps.roomEmail;

            closeEventModal();

            if (!roomEmail) {
                showToast("Cannot delete: Room Email is missing.", "error");
                return;
            }

            document.getElementById('confirmCancelText').textContent = `Anda yakin membatalkan meeting "${event.title}"?`;
            document.getElementById('confirmCancelModal').classList.add('modal-open');
        });

        document.getElementById('btnConfirmYes').addEventListener('click', () => {
            if (!currentEventContext) return;
            const event = currentEventContext;
            const eventId = event.extendedProps.seriesMasterId || event.id;
            const roomEmail = event.extendedProps.roomEmail;
            
            document.getElementById('confirmCancelModal').classList.remove('modal-open');

            authFetch(`/api/events/${encodeURIComponent(roomEmail)}/${encodeURIComponent(eventId)}`, {
                method: 'DELETE'
            })
            .then(res => {
                if (res.status === 403) {
                    showToast("Akses ditolak! Hanya Requester yang dapat membatalkan meeting ini.", "error");
                    return;
                }
                if (!res.ok) {
                    return res.text().then(text => { throw new Error(text) });
                }
                showToast("Meeting berhasil dibatalkan!", "success");
                setTimeout(() => { window.location.reload(); }, 1500);
            })
            .catch(err => {
                console.error(err);
                showToast(err.message, "error");
            });
        });
    } catch (err) {
        console.error("Gagal inisialisasi kalender:", err);
    }
});
