async function fetchAdminSettings() {
    try {
        const response = await authFetch('/api/settings/weekend');
        const data = await response.json();
        
        const toggle = document.getElementById('toggle-weekend');
        if (toggle) {
            toggle.checked = data.allow_weekend_booking;
        }
        
        // Also fetch locks
        fetchRoomLocks();
    } catch (e) {
        console.error("Failed to fetch admin settings", e);
    }
}

async function toggleWeekendSetting() {
    const toggle = document.getElementById('toggle-weekend');
    const newValue = toggle.checked;
    
    try {
        const response = await authFetch('/api/settings/weekend', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ allow_weekend_booking: newValue })
        });
        
        const data = await response.json();
        if (data.success) {
            if (typeof showToast !== 'undefined') showToast("Pengaturan akhir pekan disimpan.", "success");
        } else {
            throw new Error(data.error);
        }
    } catch (e) {
        console.error("Failed to toggle setting", e);
        toggle.checked = !newValue;
        if (typeof showToast !== 'undefined') showToast("Gagal menyimpan: " + e.message, "error");
    }
}

async function fetchRoomLocks() {
    try {
        const response = await authFetch('/api/settings/locks');
        const locks = await response.json();
        
        const list = document.getElementById('active-locks-list');
        if (!list) return;
        
        list.innerHTML = '';
        if (locks.length === 0) {
            list.innerHTML = '<li class="text-xs opacity-50 text-center">No active locks.</li>';
            return;
        }
        
        locks.forEach(lock => {
            const start = new Date(lock.start_time).toLocaleString('id-ID', { dateStyle: 'short', timeStyle: 'short' });
            const end = new Date(lock.end_time).toLocaleString('id-ID', { dateStyle: 'short', timeStyle: 'short' });
            const roomName = lock.room_email.split('@')[0];
            
            const li = document.createElement('li');
            li.className = "flex justify-between items-center bg-base-100 p-2 rounded border border-base-300";
            li.innerHTML = `
                <div>
                    <div class="font-bold text-xs">${roomName}</div>
                    <div class="text-[10px] opacity-70">${start} - ${end}</div>
                    <div class="text-[10px] text-error">${lock.reason}</div>
                </div>
                <button class="btn btn-xs btn-ghost text-error" onclick="deleteRoomLock('${lock.id}')">✕</button>
            `;
            list.appendChild(li);
        });
    } catch (e) {
        console.error("Failed to fetch locks", e);
    }
}

function selectLockRoom(email, name) {
    document.getElementById('lock-room').value = email;
    document.getElementById('lock-room-display').innerHTML = `${name} <i data-lucide="chevron-down" class="w-4 h-4 opacity-50"></i>`;
    if (window.lucide) window.lucide.createIcons();
    document.getElementById('lock-room-dropdown').removeAttribute('open');
}

async function addRoomLock() {
    const room = document.getElementById('lock-room').value;
    const start = document.getElementById('lock-start').value;
    const end = document.getElementById('lock-end').value;
    const reason = document.getElementById('lock-reason').value;
    
    if (!room || room === 'Select Room' || !start || !end || !reason) {
        if (typeof showToast !== 'undefined') showToast("Mohon lengkapi semua form kunci ruangan.", "error");
        return;
    }
    
    try {
        const response = await authFetch('/api/settings/locks', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                room_email: room,
                start_time: new Date(start).toISOString(),
                end_time: new Date(end).toISOString(),
                reason: reason
            })
        });
        
        const data = await response.json();
        if (data.success) {
            if (typeof showToast !== 'undefined') showToast("Ruangan berhasil dikunci.", "success");
            document.getElementById('lock-reason').value = '';
            document.getElementById('lock-room').value = '';
            document.getElementById('lock-room-display').innerHTML = `Select Room to Lock <i data-lucide="chevron-down" class="w-4 h-4 opacity-50"></i>`;
            if (window.lucide) window.lucide.createIcons();
            fetchRoomLocks();
        } else {
            throw new Error(data.error);
        }
    } catch (e) {
        console.error("Failed to add lock", e);
        if (typeof showToast !== 'undefined') showToast("Gagal mengunci ruangan: " + e.message, "error");
    }
}

async function deleteRoomLock(id) {
    const modal = document.getElementById('confirmDeleteLockModal');
    modal.classList.add('modal-open');
    if (window.lucide) window.lucide.createIcons();
    
    return new Promise((resolve) => {
        const btnYes = document.getElementById('btnConfirmDeleteLock');
        
        // Remove old listeners to avoid multiple triggers
        const newBtnYes = btnYes.cloneNode(true);
        btnYes.parentNode.replaceChild(newBtnYes, btnYes);
        
        newBtnYes.onclick = async () => {
            modal.classList.remove('modal-open');
            try {
                const response = await authFetch('/api/settings/locks/' + id, {
                    method: 'DELETE'
                });
                
                const data = await response.json();
                if (data.success) {
                    if (typeof showToast !== 'undefined') showToast("Kunci ruangan dilepas.", "success");
                    fetchRoomLocks();
                }
            } catch (e) {
                console.error("Failed to delete lock", e);
                if (typeof showToast !== 'undefined') showToast("Gagal melepas kunci: " + e.message, "error");
            }
            resolve();
        };
    });
}

function switchAdminTab(tabName) {
    const tabGeneral = document.getElementById('tab-general');
    const tabBlackout = document.getElementById('tab-blackout');
    const contentGeneral = document.getElementById('settings-general');
    const contentBlackout = document.getElementById('settings-blackout');
    
    if (tabName === 'general') {
        tabGeneral.classList.add('active');
        tabBlackout.classList.remove('active');
        contentGeneral.classList.remove('hidden');
        contentGeneral.classList.add('block');
        contentBlackout.classList.remove('block');
        contentBlackout.classList.add('hidden');
    } else {
        tabBlackout.classList.add('active');
        tabGeneral.classList.remove('active');
        contentBlackout.classList.remove('hidden');
        contentBlackout.classList.add('block');
        contentGeneral.classList.remove('block');
        contentGeneral.classList.add('hidden');
    }
}

// Call on load
setTimeout(fetchAdminSettings, 2000);
