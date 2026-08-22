let allLogs = [];
let currentLogFilter = 'ALL';
let logFileSize = '';

function formatBytes(bytes) {
    if (bytes === 0 || !bytes) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

async function fetchAdminLogs() {
    const logsWrapper = document.getElementById('admin-logs-wrapper');
    const logsBody = document.getElementById('admin-logs-body');
    const loading = document.getElementById('admin-logs-loading');
    const errorDiv = document.getElementById('admin-logs-error');

    // Only fetch if admin
    if (typeof authReadyPromise !== 'undefined') {
        await authReadyPromise;
    }
    const account = typeof myMSALObj !== 'undefined' ? myMSALObj.getActiveAccount() : null;
    if (!account) return;
    // Fetch admin status from server
    try {
        const response = await authFetch('/api/settings/admins/check');
        const data = await response.json();
        if (!data.isAdmin) return;
    } catch (error) {
        console.error("Admin check failed", error);
        return;
    }

    logsWrapper.classList.remove('hidden');
    
    const analyticsWrapper = document.getElementById('admin-analytics-wrapper');
    if (analyticsWrapper) analyticsWrapper.classList.remove('hidden');
    
    const settingsBtn = document.getElementById('admin-settings-btn');
    if (settingsBtn) settingsBtn.classList.remove('hidden');
    
    loading.classList.remove('hidden');
    logsBody.innerHTML = '';
    errorDiv.classList.add('hidden');

    try {
        fetchAnalytics(); // Panggil fetch analytics secara asinkron
        const res = await authFetch('/api/logs');
        if (!res.ok) throw new Error('Gagal memuat log');
        
        const data = await res.json();
        if (Array.isArray(data)) {
            allLogs = data;
            logFileSize = '';
        } else {
            allLogs = data.logs || [];
            logFileSize = data.size ? formatBytes(data.size) : '';
        }
        renderLogs();
    } catch (error) {
        loading.classList.add('hidden');
        errorDiv.classList.remove('hidden');
        errorDiv.innerText = error.message;
    }
}

let currentPage = 1;
const itemsPerPage = 10;

function filterLogs(filter) {
    currentLogFilter = filter;
    currentPage = 1;
    
    // Update button active states
    ['all', 'login', 'success', 'cancel', 'failed'].forEach(f => {
        const btn = document.getElementById('filter-' + f);
        if (btn) btn.classList.remove('btn-active');
    });
    const activeBtn = document.getElementById('filter-' + filter.toLowerCase());
    if (activeBtn) activeBtn.classList.add('btn-active');

    renderLogs();
}

function changePage(delta) {
    currentPage += delta;
    renderLogs();
}

function renderLogs() {
    const logsBody = document.getElementById('admin-logs-body');
    const loading = document.getElementById('admin-logs-loading');
    const pagination = document.getElementById('admin-logs-pagination');
    const info = document.getElementById('admin-logs-info');
    loading.classList.add('hidden');

    let filtered = allLogs;
    if (currentLogFilter === 'LOGIN') {
        filtered = allLogs.filter(l => l.action === 'LOGIN');
    } else if (currentLogFilter === 'SUCCESS') {
        filtered = allLogs.filter(l => l.status === 'SUCCESS' && l.action === 'BOOKING');
    } else if (currentLogFilter === 'CANCEL') {
        filtered = allLogs.filter(l => l.action === 'CANCEL');
    } else if (currentLogFilter === 'FAILED') {
        filtered = allLogs.filter(l => l.status === 'FAILED');
    }

    logsBody.innerHTML = '';
    
    if (filtered.length === 0) {
        logsBody.innerHTML = `<tr><td colspan="5" class="text-center py-4">Tidak ada data</td></tr>`;
        if (info) info.innerText = '0 data';
        if (pagination) pagination.innerHTML = '';
        return;
    }

    const totalPages = Math.ceil(filtered.length / itemsPerPage);
    if (currentPage > totalPages) currentPage = totalPages;
    if (currentPage < 1) currentPage = 1;

    const startIdx = (currentPage - 1) * itemsPerPage;
    const endIdx = startIdx + itemsPerPage;
    const paginatedLogs = filtered.slice(startIdx, endIdx);

    if (info) {
        let text = `Menampilkan ${startIdx + 1}-${Math.min(endIdx, filtered.length)} dari ${filtered.length} log`;
        if (logFileSize) text += ` | File size: ${logFileSize}`;
        info.innerText = text;
    }

    if (pagination) {
        pagination.innerHTML = `
            <button class="join-item btn btn-sm" onclick="changePage(-1)" ${currentPage === 1 ? 'disabled' : ''}>«</button>
            <button class="join-item btn btn-sm no-animation">Hal ${currentPage} / ${totalPages}</button>
            <button class="join-item btn btn-sm" onclick="changePage(1)" ${currentPage === totalPages ? 'disabled' : ''}>»</button>
        `;
    }

    paginatedLogs.forEach(log => {
        let statusBadge = '';
        if (log.status === 'SUCCESS') {
            statusBadge = '<span class="badge badge-success badge-sm text-white">SUCCESS</span>';
        } else if (log.status === 'FAILED') {
            statusBadge = '<span class="badge badge-error badge-sm text-white">FAILED</span>';
        } else {
            statusBadge = `<span class="badge badge-ghost badge-sm">${log.status}</span>`;
        }

        const d = new Date(log.time);
        const day = d.getDate();
        const months = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
        const monthStr = months[d.getMonth()];
        const year = d.getFullYear();
        let timeStr = d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
        
        // Memaksa format 24 jam dengan AM/PM (sesuai request) walau agak unik
        let hours24 = d.getHours().toString().padStart(2, '0');
        let mins = d.getMinutes().toString().padStart(2, '0');
        let ampm = d.getHours() >= 12 ? 'PM' : 'AM';
        const dateStr = `${day} ${monthStr} ${year} ${hours24}:${mins} ${ampm}`;

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td class="whitespace-nowrap">${dateStr}</td>
            <td>${log.email}</td>
            <td><b>${log.action}</b></td>
            <td>${statusBadge}</td>
            <td class="text-xs whitespace-normal break-words min-w-[200px] max-w-sm">${log.message}</td>
        `;
        logsBody.appendChild(tr);
    });
}

// Call fetchAdminLogs after a short delay to not block page load
setTimeout(fetchAdminLogs, 2000);

async function fetchAnalytics() {
    try {
        const res = await authFetch('/api/analytics');
        if (res.ok) {
            const data = await res.json();
            
            // Render Rooms
            const roomsContainer = document.getElementById('analytics-rooms');
            if (data.rooms && data.rooms.length > 0) {
                roomsContainer.innerHTML = data.rooms.map((r, i) => `
                    <div class="flex justify-between items-center">
                        <span class="truncate pr-2 font-medium">${i+1}. ${r.name}</span>
                        <span class="badge badge-sm badge-primary">${r.count}x</span>
                    </div>
                `).join('');
            } else {
                roomsContainer.innerHTML = '<span class="opacity-50 text-xs">Belum ada data</span>';
            }

            // Render Hours
            const hoursContainer = document.getElementById('analytics-hours');
            if (data.hours && data.hours.length > 0) {
                hoursContainer.innerHTML = data.hours.map((h, i) => `
                    <div class="flex justify-between items-center">
                        <span class="font-medium">${i+1}. Jam ${h.hour}</span>
                        <span class="badge badge-sm badge-secondary">${h.count}x</span>
                    </div>
                `).join('');
            } else {
                hoursContainer.innerHTML = '<span class="opacity-50 text-xs">Belum ada data</span>';
            }

            // Render Users
            const usersContainer = document.getElementById('analytics-users');
            if (data.users && data.users.length > 0) {
                usersContainer.innerHTML = data.users.map((u, i) => `
                    <div class="flex justify-between items-center">
                        <span class="truncate pr-2 font-medium" title="${u.email}">${i+1}. ${u.email.split('@')[0]}</span>
                        <span class="badge badge-sm badge-accent">${u.count}x</span>
                    </div>
                `).join('');
            } else {
                usersContainer.innerHTML = '<span class="opacity-50 text-xs">Belum ada data</span>';
            }
        }
    } catch (e) {
        console.error('Error fetching analytics:', e);
    }
}
