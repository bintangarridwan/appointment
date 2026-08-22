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
    const tabs = ['general', 'blackout', 'admins'];
    
    tabs.forEach(tab => {
        const tabBtn = document.getElementById(`tab-${tab}`);
        const tabContent = document.getElementById(`settings-${tab}`);
        
        if (tab === tabName) {
            tabBtn.classList.add('active');
            tabContent.classList.remove('hidden');
            tabContent.classList.add('block');
        } else {
            tabBtn.classList.remove('active');
            tabContent.classList.remove('block');
            tabContent.classList.add('hidden');
        }
    });
}

async function fetchAdminUsers() {
    try {
        const response = await authFetch('/api/settings/admins');
        const data = await response.json();
        
        const list = document.getElementById('admin-users-list');
        if (data.admins && data.admins.length > 0) {
            list.innerHTML = data.admins.map(admin => `
                <li class="flex justify-between items-center p-3 bg-base-200 rounded-lg border border-base-300">
                    <div class="flex items-center gap-3">
                        <div class="avatar placeholder">
                            <div class="bg-neutral text-neutral-content rounded-full w-8">
                                <span class="text-xs">${admin.email.charAt(0).toUpperCase()}</span>
                            </div>
                        </div>
                        <div class="flex flex-col">
                            <span class="font-bold text-sm">${admin.email}</span>
                            <span class="text-[10px] opacity-50">Added on: ${new Date(admin.created_at).toLocaleDateString()}</span>
                        </div>
                    </div>
                    ${admin.email !== 'bintang.arridwan@citarasakuliner.com' ? 
                        `<button class="btn btn-xs btn-ghost text-error" onclick="deleteAdminUser('${admin.email}')"><i data-lucide="trash-2" class="w-4 h-4"></i></button>` : 
                        `<span class="badge badge-primary badge-sm">Super Admin</span>`
                    }
                </li>
            `).join('');
            if (window.lucide) window.lucide.createIcons();
        } else {
            list.innerHTML = `<li class="text-xs opacity-50 text-center py-4">Belum ada admin tambahan.</li>`;
        }
    } catch (e) {
        console.error("Failed to fetch admins", e);
    }
}

async function addAdminUser() {
    const emailInput = document.getElementById('new-admin-email');
    const email = emailInput.value.trim().toLowerCase();
    
    if (!email || !email.includes('@')) {
        if (typeof showToast !== 'undefined') showToast("Email tidak valid.", "error");
        return;
    }
    
    try {
        const response = await authFetch('/api/settings/admins', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: email })
        });
        
        const data = await response.json();
        if (data.success) {
            if (typeof showToast !== 'undefined') showToast("Admin berhasil ditambahkan.", "success");
            emailInput.value = '';
            fetchAdminUsers();
        } else {
            throw new Error(data.error);
        }
    } catch (e) {
        console.error("Failed to add admin", e);
        if (typeof showToast !== 'undefined') showToast("Gagal menambah admin: " + e.message, "error");
    }
}

async function deleteAdminUser(email) {
    const modal = document.getElementById('confirmDeleteAdminModal');
    const text = document.getElementById('confirmDeleteAdminText');
    text.innerHTML = `Apakah Anda yakin ingin mencabut hak akses admin dari <strong>${email}</strong>?`;
    
    modal.classList.add('modal-open');
    if (window.lucide) window.lucide.createIcons();
    
    return new Promise((resolve) => {
        const btnYes = document.getElementById('btnConfirmDeleteAdmin');
        
        // Remove old listeners
        const newBtnYes = btnYes.cloneNode(true);
        btnYes.parentNode.replaceChild(newBtnYes, btnYes);
        
        newBtnYes.onclick = async () => {
            modal.classList.remove('modal-open');
            try {
                const response = await authFetch('/api/settings/admins/' + encodeURIComponent(email), {
                    method: 'DELETE'
                });
                
                const data = await response.json();
                if (data.success) {
                    if (typeof showToast !== 'undefined') showToast("Admin berhasil dihapus.", "success");
                    fetchAdminUsers();
                }
            } catch (e) {
                console.error("Failed to delete admin", e);
                if (typeof showToast !== 'undefined') showToast("Gagal menghapus admin: " + e.message, "error");
            }
            resolve();
        };
    });
}

function initAdminAutocomplete() {
    const adminEmailInput = document.getElementById('new-admin-email');
    const adminAutoList = document.getElementById('admin-autocomplete-list');
    let adminDebounceTimer;

    if (adminEmailInput && adminAutoList) {
        adminEmailInput.addEventListener('input', function() {
            clearTimeout(adminDebounceTimer);
            const val = this.value;
            if (!val || val.length < 2) {
                adminAutoList.style.display = 'none';
                return;
            }
            
            adminDebounceTimer = setTimeout(async () => {
                adminAutoList.innerHTML = '<div class="p-3 text-sm opacity-50 text-center">Mencari...</div>';
                adminAutoList.style.display = 'block';
                
                try {
                    const res = await authFetch(`/api/users/search?q=${encodeURIComponent(val)}`);
                    const users = await res.json();
                    adminAutoList.innerHTML = '';
                    
                    if (users.length > 0) {
                        users.forEach(u => {
                            const div = document.createElement('div');
                            div.className = "p-3 hover:bg-base-200 cursor-pointer border-b border-base-200 last:border-0 font-bold text-sm";
                            div.innerHTML = u.name;
                            div.addEventListener('click', () => {
                                adminEmailInput.value = u.email;
                                adminAutoList.style.display = 'none';
                            });
                            adminAutoList.appendChild(div);
                        });
                        adminAutoList.style.display = 'block';
                    } else {
                        adminAutoList.innerHTML = '<div class="p-3 text-sm opacity-50 text-center">Tidak ditemukan.</div>';
                        adminAutoList.style.display = 'block';
                    }
                } catch (err) {
                    console.error("Admin search error:", err);
                    adminAutoList.innerHTML = '<div class="p-3 text-sm text-error text-center">Gagal mencari.</div>';
                    adminAutoList.style.display = 'block';
                }
            }, 300);
        });

        document.addEventListener('click', (e) => {
            if (e.target !== adminEmailInput && !adminAutoList.contains(e.target)) {
                adminAutoList.style.display = 'none';
            }
        });
    }
}

// Call on load
setTimeout(() => {
    fetchAdminSettings();
    fetchAdminUsers();
    initAdminAutocomplete();
}, 2000);
