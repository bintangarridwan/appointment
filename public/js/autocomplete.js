// Organizer Autocomplete
const organizerInput = document.getElementById('organizer');
const autoList = document.getElementById('autocomplete-list');
let debounceTimer;

organizerInput.addEventListener('input', function() {
    clearTimeout(debounceTimer);
    const val = this.value;
    if (!val || val.length < 2) {
        autoList.style.display = 'none';
        return;
    }
    
    debounceTimer = setTimeout(async () => {
        try {
            const res = await fetch(`/api/users/search?q=${encodeURIComponent(val)}`);
            const users = await res.json();
            autoList.innerHTML = '';
            
            if (users.length > 0) {
                users.forEach(u => {
                    const div = document.createElement('div');
                    div.innerHTML = `<b>${u.name}</b><small>${u.email}</small>`;
                    div.addEventListener('click', () => {
                        organizerInput.value = u.email;
                        autoList.style.display = 'none';
                    });
                    autoList.appendChild(div);
                });
                autoList.style.display = 'block';
            } else {
                autoList.style.display = 'none';
            }
        } catch (err) {
            console.error(err);
        }
    }, 300);
});

document.addEventListener('click', (e) => {
    if (e.target !== organizerInput) {
        autoList.style.display = 'none';
    }
});

// Attendees Autocomplete
const attendeesInput = document.getElementById('attendees');
const attAutoList = document.getElementById('attendees-autocomplete-list');
let attDebounceTimer;

attendeesInput.addEventListener('input', function() {
    clearTimeout(attDebounceTimer);
    const fullVal = this.value;
    const parts = fullVal.split(',');
    const currentQuery = parts[parts.length - 1].trim();

    if (!currentQuery || currentQuery.length < 2) {
        attAutoList.style.display = 'none';
        return;
    }
    
    attDebounceTimer = setTimeout(async () => {
        try {
            const dateStr = document.getElementById('date').value;
            const startTimeStr = document.getElementById('start').value;
            const endTimeStr = document.getElementById('end').value;

            const res = await authFetch(`/api/users/search?q=${encodeURIComponent(currentQuery)}`);
            const users = await res.json();
            
            if (users.length > 0 && dateStr && startTimeStr && endTimeStr) {
                const start = new Date(`${dateStr}T${startTimeStr}`).toISOString();
                const end = new Date(`${dateStr}T${endTimeStr}`).toISOString();
                const emails = users.map(u => u.email);
                
                try {
                    const schedRes = await authFetch('/api/users/schedule', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ emails, startTime: start, endTime: end })
                    });
                    if (schedRes.ok) {
                        const schedData = await schedRes.json();
                        users.forEach(u => {
                            const userSched = schedData.find(s => s.scheduleId.toLowerCase() === u.email.toLowerCase());
                            if (userSched && userSched.scheduleItems && userSched.scheduleItems.length > 0) {
                                u.status = userSched.scheduleItems[0].status; // busy, tentative, dll
                            } else {
                                u.status = 'free';
                            }
                        });
                    }
                } catch (e) {
                    console.error('Schedule fetch error:', e);
                }
            }

            attAutoList.innerHTML = '';
            
            if (users.length > 0) {
                users.forEach(u => {
                    const div = document.createElement('div');
                    let statusHtml = '';
                    if (u.status) {
                        const color = u.status === 'free' ? '#10b981' : (u.status === 'busy' ? '#ef4444' : '#f59e0b');
                        statusHtml = `<span style="float:right; font-size:11px; font-weight:bold; color:${color}; padding:2px 6px; border-radius:4px; background:${color}20;">${u.status.toUpperCase()}</span>`;
                    }
                    div.innerHTML = `<b>${u.name}</b> ${statusHtml}<br><small>${u.email}</small>`;
                    div.addEventListener('click', () => {
                        parts[parts.length - 1] = ' ' + u.email;
                        attendeesInput.value = parts.join(',').trim() + ', ';
                        attAutoList.style.display = 'none';
                        attendeesInput.focus();
                    });
                    attAutoList.appendChild(div);
                });
                attAutoList.style.display = 'block';
            } else {
                attAutoList.style.display = 'none';
            }
        } catch (err) {
            console.error(err);
        }
    }, 300);
});

document.addEventListener('click', (e) => {
    if (e.target !== attendeesInput) {
        attAutoList.style.display = 'none';
    }
});
