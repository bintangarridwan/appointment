let allLogs = [];
let currentLogFilter = 'ALL';

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
    const email = (account.preferred_username || account.username || '').toLowerCase();
    if (email !== 'bintang.arridwan@citarasakuliner.com') {
        return;
    }

    logsWrapper.classList.remove('hidden');
    loading.classList.remove('hidden');
    logsBody.innerHTML = '';
    errorDiv.classList.add('hidden');

    try {
        const res = await authFetch('/api/logs');
        if (!res.ok) throw new Error('Gagal memuat log');
        
        allLogs = await res.json();
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
    ['all', 'login', 'success', 'failed'].forEach(f => {
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
        info.innerText = `Menampilkan ${startIdx + 1}-${Math.min(endIdx, filtered.length)} dari ${filtered.length} log`;
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
        const day = String(d.getDate()).padStart(2, '0');
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const year = d.getFullYear();
        let timeStr = d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
        // timeStr might be "01:00 AM", replace colon with dot
        timeStr = timeStr.replace(':', '.');
        const dateStr = `${day}/${month}/${year} Jam ${timeStr}`;

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td class="whitespace-nowrap">${dateStr}</td>
            <td>${log.email}</td>
            <td><b>${log.action}</b></td>
            <td>${statusBadge}</td>
            <td class="text-xs">${log.message}</td>
        `;
        logsBody.appendChild(tr);
    });
}

// Call fetchAdminLogs after a short delay to not block page load
setTimeout(fetchAdminLogs, 2000);
