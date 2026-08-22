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

// Attendees Autocomplete with Chips
const attendeesInput = document.getElementById('attendees');
const attAutoList = document.getElementById('attendees-autocomplete-list');
const chipsContainer = document.getElementById('attendees-chips');
let attDebounceTimer;
window.selectedAttendeesChips = [];

window.renderAttendeesChips = function() {
    chipsContainer.innerHTML = '';
    window.selectedAttendeesChips.forEach((chipData, index) => {
        const chip = document.createElement('div');
        chip.className = 'badge badge-primary gap-1 p-3 font-medium';
        const displayName = chipData.name || chipData.email.split('@')[0];
        chip.innerHTML = `
            <span title="${chipData.email}">${displayName}</span>
            <button type="button" class="btn btn-ghost btn-xs px-1 rounded-full hover:bg-primary-focus" onclick="removeAttendeeChip(${index})">
                <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
            </button>
        `;
        chipsContainer.appendChild(chip);
    });
}

window.removeAttendeeChip = function(index) {
    window.selectedAttendeesChips.splice(index, 1);
    window.renderAttendeesChips();
};

function addAttendeeChip(email, name = '') {
    email = email.trim();
    if (email && !window.selectedAttendeesChips.find(c => c.email === email)) {
        window.selectedAttendeesChips.push({ email, name });
        window.renderAttendeesChips();
    }
    attendeesInput.value = '';
    attAutoList.style.display = 'none';
}

attendeesInput.addEventListener('keydown', function(e) {
    if (e.key === 'Enter' || e.key === ',') {
        e.preventDefault();
        addAttendeeChip(this.value);
    } else if (e.key === 'Backspace' && this.value === '' && window.selectedAttendeesChips.length > 0) {
        window.selectedAttendeesChips.pop();
        window.renderAttendeesChips();
    }
});

attendeesInput.addEventListener('input', function() {
    clearTimeout(attDebounceTimer);
    const currentQuery = this.value.trim();

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
                    div.className = 'p-2 border-b cursor-pointer hover:bg-base-200';
                    let statusHtml = '';
                    if (u.status) {
                        const color = u.status === 'free' ? '#10b981' : (u.status === 'busy' ? '#ef4444' : '#f59e0b');
                        statusHtml = `<span style="float:right; font-size:11px; font-weight:bold; color:${color}; padding:2px 6px; border-radius:4px; background:${color}20;">${u.status.toUpperCase()}</span>`;
                    }
                    div.innerHTML = `<b>${u.name}</b> ${statusHtml}<br><small>${u.email}</small>`;
                    div.addEventListener('click', () => {
                        addAttendeeChip(u.email, u.name);
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
