let allAddressBookUsers = [];
let filteredAddressBookUsers = [];
let addressBookPage = 1;
const addressBookPageSize = 10;

function closeAddressBook() {
    document.getElementById('addressBookModal').classList.remove('show');
}

async function openAddressBook() {
    document.getElementById('addressBookModal').classList.add('show');
    document.getElementById('addressBookLoading').style.display = 'block';
    document.getElementById('addressBookTable').style.display = 'none';

    try {
        const dateStr = document.getElementById('date').value;
        const startTimeStr = document.getElementById('start').value;
        const endTimeStr = document.getElementById('end').value;

        const res = await fetch('/api/users/directory');
        let allUsers = await res.json();
        
        // Filter hanya email @citarasakuliner.com
        let users = allUsers.filter(u => u.email && u.email.toLowerCase().endsWith('@citarasakuliner.com'));
        
        // Default status
        users.forEach(u => u.status = 'unknown');

        if (users.length > 0 && dateStr && startTimeStr && endTimeStr) {
            const start = new Date(`${dateStr}T${startTimeStr}`).toISOString();
            const end = new Date(`${dateStr}T${endTimeStr}`).toISOString();
            const emails = users.map(u => u.email);
            
            // Chunk requests to 20 emails per batch (Graph API limit)
            const chunkSize = 20;
            for (let i = 0; i < emails.length; i += chunkSize) {
                const chunk = emails.slice(i, i + chunkSize);
                try {
                    const schedRes = await authFetch('/api/users/schedule', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ emails: chunk, startTime: start, endTime: end })
                    });
                    if (schedRes.ok) {
                        const schedData = await schedRes.json();
                        users.forEach(u => {
                            const userSched = schedData.find(s => s.scheduleId.toLowerCase() === u.email.toLowerCase());
                            if (userSched) {
                                if (userSched.scheduleItems && userSched.scheduleItems.length > 0) {
                                    u.status = userSched.scheduleItems[0].status; // busy, tentative
                                } else {
                                    u.status = 'free';
                                }
                            }
                        });
                    }
                } catch(e) { console.error('Schedule fetch failed for chunk', e); }
            }
        }

        allAddressBookUsers = users;
        filteredAddressBookUsers = [...users];
        addressBookPage = 1;
        
        document.getElementById('addressBookLoading').style.display = 'none';
        document.getElementById('addressBookTable').style.display = 'table';
        document.getElementById('addressBookPagination').style.display = 'flex';
        
        renderAddressBookPage();
        
    } catch (error) {
        document.getElementById('addressBookLoading').innerHTML = 'Failed to load address book.';
    }
}

function addFromAddressBook(email) {
    const inp = document.getElementById('attendees');
    let current = inp.value.trim();
    if (current.length > 0 && !current.endsWith(',')) {
        current += ', ';
    }
    if (!current.includes(email)) {
        inp.value = current + email + ', ';
        showToast(email + ' ditambahkan', 'success');
    }
}

function changeAddressBookPage(delta) {
    const maxPage = Math.ceil(filteredAddressBookUsers.length / addressBookPageSize) || 1;
    addressBookPage += delta;
    if (addressBookPage < 1) addressBookPage = 1;
    if (addressBookPage > maxPage) addressBookPage = maxPage;
    renderAddressBookPage();
}

function renderAddressBookPage() {
    const tbody = document.getElementById('addressBookList');
    tbody.innerHTML = '';
    
    const maxPage = Math.ceil(filteredAddressBookUsers.length / addressBookPageSize) || 1;
    document.getElementById('addressBookPageInfo').innerText = `Page ${addressBookPage} / ${maxPage}`;
    
    document.getElementById('btnPrevPage').disabled = addressBookPage === 1;
    document.getElementById('btnNextPage').disabled = addressBookPage === maxPage;

    const startIdx = (addressBookPage - 1) * addressBookPageSize;
    const endIdx = startIdx + addressBookPageSize;
    const pageUsers = filteredAddressBookUsers.slice(startIdx, endIdx);
    
    pageUsers.forEach(u => {
        const tr = document.createElement('tr');
        tr.style.borderBottom = '1px solid #f1f5f9';
        
        let statusHtml = '-';
        if (u.status) {
            const color = u.status === 'free' ? '#10b981' : (u.status === 'busy' ? '#ef4444' : (u.status === 'unknown' ? '#94a3b8' : '#f59e0b'));
            statusHtml = `<span style="font-size:11px; font-weight:bold; color:${color}; padding:2px 6px; border-radius:4px; background:${color}20;">${u.status.toUpperCase()}</span>`;
        }

        tr.innerHTML = `
            <td style="padding: 10px;"><b>${u.name}</b><br><span style="color:#64748b; font-size: 11px;">${u.email}</span></td>
            <td style="padding: 10px;">${u.title}<br><span style="color:#64748b; font-size: 11px;">${u.department}</span></td>
            <td style="padding: 10px;">${statusHtml}</td>
            <td style="padding: 10px; text-align: center;">
                <button type="button" style="background:#3b82f6; color:white; border:none; padding:4px 8px; border-radius:4px; cursor:pointer;" onclick="addFromAddressBook('${u.email}')">Add</button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

function filterAddressBook() {
    const input = document.getElementById('addressBookSearch');
    const filter = input.value.toLowerCase();
    
    filteredAddressBookUsers = allAddressBookUsers.filter(u => 
        (u.name && u.name.toLowerCase().includes(filter)) || 
        (u.email && u.email.toLowerCase().includes(filter))
    );
    
    addressBookPage = 1;
    renderAddressBookPage();
}
