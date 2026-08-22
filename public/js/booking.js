async function bookRoom() {
    const roomId = document.getElementById('room-select').value;
    const subject = document.getElementById('subject').value;
    const dateStr = document.getElementById('date').value;
    const startTimeStr = document.getElementById('start').value;
    const endTimeStr = document.getElementById('end').value;
    
    const start = (dateStr && startTimeStr) ? `${dateStr}T${startTimeStr}` : '';
    const end = (dateStr && endTimeStr) ? `${dateStr}T${endTimeStr}` : '';
    const organizerEmail = document.getElementById('organizer').value;
    const attendeesStr = window.selectedAttendeesChips ? window.selectedAttendeesChips.map(c => c.email).join(',') : '';
    const isOnline = document.getElementById('teams-toggle').classList.contains('active');
    
    // Recurring logic
    const recurType = document.getElementById('recurType') ? document.getElementById('recurType').value : '';
    let recurrence = null;
    
    if (recurType) {
        const recurEndDate = document.getElementById('recurEndDate').value;
        if (!recurEndDate) {
            document.getElementById('errorModalText').innerText = "Harap isi End Date untuk Meeting berulang";
            document.getElementById('errorModal').classList.add('modal-open');
            return;
        }
        
        let pattern = {};
        if (recurType === 'daily') {
            pattern.type = 'daily';
            pattern.interval = parseInt(document.getElementById('dailyDays').value) || 1;
        } else if (recurType === 'weekly') {
            pattern.type = 'weekly';
            pattern.interval = parseInt(document.getElementById('weeklyWeeks').value) || 1;
            const days = Array.from(document.querySelectorAll('#weeklySection input[type="checkbox"]:checked')).map(cb => cb.value);
            if (days.length === 0) {
                alert("Harap pilih minimal satu hari untuk meeting mingguan!");
                return;
            }
            const dayMap = { 'Mon':'monday', 'Tue':'tuesday', 'Wed':'wednesday', 'Thu':'thursday', 'Fri':'friday' };
            pattern.daysOfWeek = days.map(d => dayMap[d]);
        } else if (recurType === 'monthly') {
            const mode = document.querySelector('input[name="monthlyMode"]:checked').value;
            pattern.interval = parseInt(document.getElementById('monthlyMonths').value) || 1;
            
            if (mode === 'absolute') {
                pattern.type = 'absoluteMonthly';
                pattern.dayOfMonth = parseInt(document.getElementById('monthlyDay').value) || 15;
            } else {
                pattern.type = 'relativeMonthly';
                pattern.daysOfWeek = [document.getElementById('monthlyDayOfWeek').value.toLowerCase()];
                pattern.index = document.getElementById('monthlyIndex').value;
            }
        }
        
        recurrence = {
            pattern: pattern,
            range: {
                type: 'endDate',
                startDate: dateStr,
                endDate: recurEndDate
            }
        };
    }

    console.log("Book Room clicked!");
    
    if (!roomId || !subject || !start || !end || !organizerEmail) {
        document.getElementById('errorModalText').innerText = "Harap lengkapi semua data!";
        document.getElementById('errorModal').classList.add('modal-open');
        return;
    }

    const btn = document.getElementById('book-btn');
    const ogText = btn.innerHTML;
    btn.innerHTML = '<i data-lucide="loader" class="spin"></i> Memproses...';
    if(window.lucide) lucide.createIcons({ root: btn });
    btn.disabled = true;

    try {
        const res = await authFetch(`/api/rooms/${roomId}/book`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                subject, 
                start: new Date(start).toISOString(), 
                end: new Date(end).toISOString(), 
                organizerEmail,
                attendees: attendeesStr,
                isOnline,
                recurrence
            })
        });

        if (res.ok) {
            showToast("Room booked successfully!", "success");
            if (window.calendar) {
                setTimeout(() => window.location.reload(), 1500);
            } else {
                window.location.reload();
            }
        } else {
            let errorMsg = "Unknown error";
            try {
                const err = await res.json();
                errorMsg = err.error || JSON.stringify(err);
            } catch (e) {
                errorMsg = await res.text();
            }
            showToast("Booking failed: " + errorMsg, "error");
            if (typeof fetchAdminLogs === 'function') fetchAdminLogs();
        }
    } catch (error) {
        showToast("An error occurred: " + error.message, "error");
    } finally {
        btn.innerHTML = ogText;
        btn.disabled = false;
    }
}
