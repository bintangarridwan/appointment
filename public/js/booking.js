async function bookRoom() {
    const roomId = document.getElementById('room-select').value;
    const subject = document.getElementById('subject').value;
    const dateStr = document.getElementById('date').value;
    const startTimeStr = document.getElementById('start').value;
    const endTimeStr = document.getElementById('end').value;
    
    const start = (dateStr && startTimeStr) ? `${dateStr}T${startTimeStr}` : '';
    const end = (dateStr && endTimeStr) ? `${dateStr}T${endTimeStr}` : '';
    const organizerEmail = document.getElementById('organizer').value;
    const attendeesStr = document.getElementById('attendees').value;
    const isOnline = document.getElementById('teams-toggle').classList.contains('active');

    if (!roomId || !subject || !start || !end || !organizerEmail) {
        return showToast("Harap lengkapi semua data (terutama Requester)!", "error");
    }

    const btn = document.getElementById('book-btn');
    const ogText = btn.innerHTML;
    btn.innerHTML = '<i data-lucide="loader" class="spin"></i> Memproses...';
    lucide.createIcons({ root: btn });
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
                isOnline
            })
        });

        if (res.ok) {
            showToast("Room booked successfully!", "success");
            if (calendar) {
                setTimeout(() => window.location.reload(), 1500);
            } else {
                window.location.reload();
            }
        } else {
            const err = await res.json();
            showToast("Booking failed: " + err.error, "error");
        }
    } catch (error) {
        showToast("An error occurred: " + error.message, "error");
    } finally {
        btn.innerHTML = ogText;
        btn.disabled = false;
    }
}
