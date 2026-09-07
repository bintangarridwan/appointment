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
    
    // Selalu tampilkan, pastikan tidak hidden
    wrapper.classList.remove('hidden');
    container.innerHTML = '';
    
    if (!events) events = []; // Fallback kosong
    
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
            <div class="log-room-name">${room.originalTitle || room.title}</div>
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
        
        const capacities = {
            "Ruang Kuah LT 1": " (Maks.6 org)",
            "Ruang Beef LT 2": " (Maks.7 org)",
            "Ruang Bojot LT 3": " (Maks.7 org)",
            "Ruang Mozza LT 3": " (Maks.25 org)"
        };
        
        const resources = rooms.map((room, index) => {
            const displayName = room.name + (capacities[room.name] || "");
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
                title: displayName,
                originalTitle: room.name,
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

                const activeAccount = typeof myMSALObj !== 'undefined' ? myMSALObj.getActiveAccount() : null;
                const currentUserEmail = activeAccount ? activeAccount.username.toLowerCase() : '';
                const organizerEmail = event.extendedProps.organizerEmail?.toLowerCase() || '';

                if (currentUserEmail === organizerEmail || window.isAdmin) {
                    document.getElementById('btnEditMenu').parentElement.style.display = '';
                    document.getElementById('btnCancelMeeting').style.display = '';
                } else {
                    document.getElementById('btnEditMenu').parentElement.style.display = 'none';
                    document.getElementById('btnCancelMeeting').style.display = 'none';
                }

                if (window.isAdmin) {
                    document.getElementById('btnEditSubjectOption').parentElement.classList.remove('hidden');
                    document.getElementById('btnEditSubjectOption').classList.remove('hidden');
                } else {
                    document.getElementById('btnEditSubjectOption').parentElement.classList.add('hidden');
                    document.getElementById('btnEditSubjectOption').classList.add('hidden');
                }
                
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
            .then(async res => {
                if (res.status === 403) {
                    const data = await res.json().catch(() => ({}));
                    showToast(data.error || "Akses ditolak! Hanya Requester atau Admin yang dapat membatalkan meeting ini.", "error");
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

        let editAttendeesList = [];
        
        function renderEditChips() {
            const container = document.getElementById('edit-attendees-chips');
            container.innerHTML = '';
            editAttendeesList.forEach((att, index) => {
                let displayName = att.name && att.name !== att.email ? att.name : att.email;
                if (displayName && displayName.includes('@')) {
                    displayName = displayName.split('@')[0];
                }
                const wrapper = document.createElement('div');
                wrapper.className = 'indicator mr-2 mb-2 mt-1';
                wrapper.innerHTML = `
                    <button type="button" class="indicator-item indicator-top indicator-end badge badge-error badge-sm w-4 h-4 p-0 text-white border-none cursor-pointer" data-index="${index}">
                        <i data-lucide="x" class="w-3 h-3"></i>
                    </button>
                    <div class="badge badge-outline border-black text-black p-3 text-xs" title="${att.email}">${displayName}</div>
                `;
                container.appendChild(wrapper);
            });
            
            container.querySelectorAll('button').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    const idx = e.currentTarget.getAttribute('data-index');
                    editAttendeesList.splice(idx, 1);
                    renderEditChips();
                });
            });
            if (window.lucide) { lucide.createIcons(); }
        }

        const editInput = document.getElementById('editAttendeesInput');

        let editAttDebounceTimer;
        const editAttAutoList = document.getElementById('edit-attendees-autocomplete');

        if (editInput && editAttAutoList) {
            editInput.addEventListener('input', function() {
                clearTimeout(editAttDebounceTimer);
                const currentQuery = this.value.trim();

                if (!currentQuery || currentQuery.length < 2) {
                    editAttAutoList.style.display = 'none';
                    editAttAutoList.classList.add('hidden');
                    return;
                }
                
                editAttDebounceTimer = setTimeout(async () => {
                    try {
                        const res = await authFetch(`/api/users/search?q=${encodeURIComponent(currentQuery)}`);
                        const users = await res.json();
                        
                        editAttAutoList.innerHTML = '';
                        
                        if (users.length > 0) {
                            users.forEach(u => {
                                const div = document.createElement('div');
                                div.className = 'p-2 border-b cursor-pointer hover:bg-base-200 text-sm';
                                div.innerHTML = `<b>${u.name}</b><br><small>${u.email}</small>`;
                                div.addEventListener('click', () => {
                                    const isDuplicate = editAttendeesList.some(e => {
                                        const existingEmail = (e.email || e.name || '').toLowerCase();
                                        const existingName = (e.name || '').toLowerCase();
                                        const newEmail = (u.email || '').toLowerCase();
                                        const newName = (u.name || '').toLowerCase();
                                        return (existingEmail === newEmail) || (existingName && newName && existingName === newName);
                                    });
                                    const orgEmail = (currentEventContext && currentEventContext.extendedProps.organizerEmail) ? currentEventContext.extendedProps.organizerEmail.toLowerCase() : '';
                                    if (orgEmail === (u.email || '').toLowerCase()) {
                                        if (typeof showToast !== 'undefined') showToast("Organizer sudah ada di meeting ini", "error");
                                    } else if (!isDuplicate) {
                                        editAttendeesList.push({ email: u.email, name: u.name });
                                        renderEditChips();
                                    } else {
                                        if (typeof showToast !== 'undefined') showToast("Orang ini sudah ada di daftar attendees", "error");
                                    }
                                    editInput.value = '';
                                    editAttAutoList.style.display = 'none';
                                    editAttAutoList.classList.add('hidden');
                                    editInput.focus();
                                });
                                editAttAutoList.appendChild(div);
                            });
                            editAttAutoList.style.display = 'block';
                            editAttAutoList.classList.remove('hidden');
                            
                            const container = document.getElementById('edit-attendees-container');
                            if (container) {
                                editAttAutoList.style.width = container.offsetWidth + 'px';
                                editAttAutoList.style.top = (container.offsetTop + container.offsetHeight) + 'px';
                                editAttAutoList.style.left = container.offsetLeft + 'px';
                            }
                        } else {
                            editAttAutoList.style.display = 'none';
                            editAttAutoList.classList.add('hidden');
                        }
                    } catch (err) {
                        console.error(err);
                    }
                }, 300);
            });

            document.addEventListener('click', (e) => {
                if (e.target !== editInput) {
                    editAttAutoList.style.display = 'none';
                    editAttAutoList.classList.add('hidden');
                }
            });
        }

        editInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ',') {
                e.preventDefault();
                const val = editInput.value.trim().replace(/,$/, '');
                if (val && validateEmail(val)) {
                    const isDuplicate = editAttendeesList.some(e => {
                        const existingEmail = (e.email || e.name || '').toLowerCase();
                        const existingName = (e.name || '').toLowerCase();
                        const newVal = val.toLowerCase();
                        return (existingEmail === newVal) || (existingName === newVal);
                    });
                    const orgEmail = (currentEventContext && currentEventContext.extendedProps.organizerEmail) ? currentEventContext.extendedProps.organizerEmail.toLowerCase() : '';
                    if (orgEmail === val.toLowerCase()) {
                        if (typeof showToast !== 'undefined') showToast("Organizer sudah ada di meeting ini", "error");
                    } else if (!isDuplicate) {
                        editAttendeesList.push({ email: val, name: val });
                        editInput.value = '';
                        renderEditChips();
                    } else {
                        if (typeof showToast !== 'undefined') showToast("Email sudah ada di daftar attendees", "error");
                    }
                } else if (val && !validateEmail(val)) {
                    if (typeof showToast !== 'undefined') showToast("Email tidak valid", "error");
                }
            } else if (e.key === 'Backspace' && editInput.value === '' && editAttendeesList.length > 0) {
                editAttendeesList.pop();
                renderEditChips();
            }
        });
        
        function validateEmail(email) {
            const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            return re.test(String(email).toLowerCase());
        }

        document.getElementById('btnEditMenu').addEventListener('click', () => {
            document.getElementById('eventModal').classList.remove('modal-open');
            document.getElementById('editChoiceModal').classList.add('modal-open');
        });

        document.getElementById('btnEditAttendeesOption').addEventListener('click', () => {
            if (!currentEventContext) return;
            const event = currentEventContext;
            
            document.getElementById('editChoiceModal').classList.remove('modal-open');
            
            // Extract current attendees
            const attendeesList = event.extendedProps.attendeesList || [];
            const roomEmail = event.extendedProps.roomEmail;
            const organizerEmail = event.extendedProps.organizerEmail;
            
            // Filter out room and organizer to get only extra attendees
            const extraEmails = attendeesList
                .filter(a => {
                    const e = a.email || a.name;
                    return e.toLowerCase() !== roomEmail.toLowerCase() && e.toLowerCase() !== organizerEmail?.toLowerCase();
                })
                .map(a => ({ email: a.email, name: a.name || a.email }));
            
            editAttendeesList = [...extraEmails];
            renderEditChips();
            editInput.value = '';
            
            document.getElementById('editAttendeesModal').classList.add('modal-open');
        });

        document.getElementById('btnSaveAttendees').addEventListener('click', () => {
            if (!currentEventContext) return;
            // Also grab any lingering text in the input
            const lingering = editInput.value.trim();
            const isDuplicate = editAttendeesList.some(e => {
                const existingEmail = (e.email || e.name || '').toLowerCase();
                const existingName = (e.name || '').toLowerCase();
                const newVal = lingering.toLowerCase();
                return (existingEmail === newVal) || (existingName === newVal);
            });
            const orgEmail = (currentEventContext && currentEventContext.extendedProps.organizerEmail) ? currentEventContext.extendedProps.organizerEmail.toLowerCase() : '';
            if (lingering && validateEmail(lingering) && orgEmail !== lingering.toLowerCase() && !isDuplicate) {
                editAttendeesList.push({ email: lingering, name: lingering });
                editInput.value = '';
                renderEditChips();
            }

            const event = currentEventContext;
            const eventId = event.extendedProps.seriesMasterId || event.id;
            const roomEmail = event.extendedProps.roomEmail;
            const attendeesStr = editAttendeesList.map(a => a.email || a.name).join(', ');

            document.getElementById('editAttendeesModal').classList.remove('modal-open');
            document.getElementById('process-loader').classList.add('modal-open');

            authFetch(`/api/events/${encodeURIComponent(roomEmail)}/${encodeURIComponent(eventId)}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ attendees: attendeesStr })
            })
            .then(async res => {
                document.getElementById('process-loader').classList.remove('modal-open');
                if (res.status === 403) {
                    const data = await res.json().catch(() => ({}));
                    showToast(data.error || "Akses ditolak! Hanya Organizer yang dapat mengedit meeting ini.", "error");
                    return;
                }
                if (!res.ok) {
                    return res.text().then(text => { throw new Error(text) });
                }
                showToast("Attendees berhasil diperbarui! Sedang sinkronisasi...", "success");
                setTimeout(() => {
                    calendar.refetchEvents();
                }, 3000);
            })
            .catch(err => {
                document.getElementById('process-loader').classList.remove('modal-open');
                console.error(err);
                showToast(err.message, "error");
            });
        });

        document.getElementById('btnEditTimeOption').addEventListener('click', () => {
            if (!currentEventContext) return;
            const event = currentEventContext;
            document.getElementById('editChoiceModal').classList.remove('modal-open');
            
            const startDate = new Date(event.start);
            const endDate = event.end ? new Date(event.end) : new Date(startDate.getTime() + 60*60*1000);
            
            const pad = (n) => n.toString().padStart(2, '0');
            const dateStr = `${startDate.getFullYear()}-${pad(startDate.getMonth()+1)}-${pad(startDate.getDate())}`;
            const startTimeStr = `${pad(startDate.getHours())}:${pad(startDate.getMinutes())}`;
            const endTimeStr = `${pad(endDate.getHours())}:${pad(endDate.getMinutes())}`;
            
            document.getElementById('editDate').value = dateStr;
            document.getElementById('editStartTime').value = startTimeStr;
            document.getElementById('editEndTime').value = endTimeStr;
            
            document.getElementById('editTimeModal').classList.add('modal-open');
        });

        document.getElementById('btnSaveTime').addEventListener('click', () => {
            if (!currentEventContext) return;
            const event = currentEventContext;
            const eventId = event.extendedProps.seriesMasterId || event.id;
            const roomEmail = event.extendedProps.roomEmail;
            
            const dateStr = document.getElementById('editDate').value;
            const startStr = document.getElementById('editStartTime').value;
            const endStr = document.getElementById('editEndTime').value;
            
            if (!dateStr || !startStr || !endStr) {
                showToast("Tanggal dan jam harus diisi", "error");
                return;
            }
            
            const startIso = new Date(`${dateStr}T${startStr}:00`).toISOString();
            const endIso = new Date(`${dateStr}T${endStr}:00`).toISOString();
            
            document.getElementById('editTimeModal').classList.remove('modal-open');
            document.getElementById('process-loader').classList.add('modal-open');
            
            authFetch(`/api/events/${encodeURIComponent(roomEmail)}/${encodeURIComponent(eventId)}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ start: startIso, end: endIso })
            })
            .then(async res => {
                document.getElementById('process-loader').classList.remove('modal-open');
                if (res.status === 403) {
                    const data = await res.json().catch(() => ({}));
                    showToast(data.error || "Akses ditolak!", "error");
                    return;
                }
                if (!res.ok) {
                    const data = await res.json().catch(() => ({}));
                    throw new Error(data.error || "Gagal mengupdate waktu");
                }
                showToast("Waktu meeting berhasil diperbarui! Sedang sinkronisasi...", "success");
                setTimeout(() => {
                    calendar.refetchEvents();
                }, 3000);
            })
            .catch(err => {
                document.getElementById('process-loader').classList.remove('modal-open');
                console.error(err);
                showToast(err.message, "error");
            });
        });

        document.getElementById('btnEditSubjectOption').addEventListener('click', () => {
            if (!currentEventContext) return;
            const event = currentEventContext;
            document.getElementById('editChoiceModal').classList.remove('modal-open');
            document.getElementById('editSubjectInput').value = event.title;
            document.getElementById('editSubjectModal').classList.add('modal-open');
        });

        document.getElementById('btnSaveSubject').addEventListener('click', () => {
            if (!currentEventContext) return;
            const event = currentEventContext;
            const eventId = event.extendedProps.seriesMasterId || event.id;
            const roomEmail = event.extendedProps.roomEmail;
            
            const newSubject = document.getElementById('editSubjectInput').value.trim();
            
            if (!newSubject) {
                showToast("Subject tidak boleh kosong", "error");
                return;
            }
            
            document.getElementById('editSubjectModal').classList.remove('modal-open');
            document.getElementById('process-loader').classList.add('modal-open');
            
            authFetch(`/api/events/${encodeURIComponent(roomEmail)}/${encodeURIComponent(eventId)}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ subject: newSubject })
            })
            .then(async res => {
                document.getElementById('process-loader').classList.remove('modal-open');
                if (res.status === 403) {
                    const data = await res.json().catch(() => ({}));
                    showToast(data.error || "Akses ditolak!", "error");
                    return;
                }
                if (!res.ok) {
                    const data = await res.json().catch(() => ({}));
                    throw new Error(data.error || "Gagal mengupdate subject");
                }
                showToast("Subject meeting berhasil diperbarui! Sedang sinkronisasi...", "success");
                setTimeout(() => {
                    calendar.refetchEvents();
                }, 3000);
            })
            .catch(err => {
                document.getElementById('process-loader').classList.remove('modal-open');
                console.error(err);
                showToast(err.message, "error");
            });
        });
    } catch (err) {
        console.error("Gagal inisialisasi kalender:", err);
    }
});
