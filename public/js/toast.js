function showToast(message, type = 'success', requireAction = false) {
    const container = document.getElementById('toast-container');
    if (!container) return;
    
    const alertDiv = document.createElement('div');
    const daisyType = type === 'error' ? 'alert-error' : `alert-${type}`;
    
    alertDiv.className = `alert ${daisyType} shadow-xl font-medium flex flex-wrap items-center justify-between gap-4 mb-2 max-w-md w-auto`;
    if (type === 'error') {
        alertDiv.classList.add('text-error-content');
    } else {
        alertDiv.classList.add('text-white');
    }
    
    const icon = type === 'success' ? 'check-circle' : 'alert-circle';
    let innerContent = `<div class="flex items-start gap-2 flex-1"><i data-lucide="${icon}" class="w-5 h-5 shrink-0 mt-0.5"></i> <span class="whitespace-normal break-words text-left flex-1">${message}</span></div>`;
    
    if (requireAction) {
        innerContent += `<button class="btn btn-info btn-sm text-white" onclick="this.closest('.alert').remove()">Ok</button>`;
    }
    
    alertDiv.innerHTML = innerContent;
    
    container.appendChild(alertDiv);
    if (window.lucide) { lucide.createIcons({ root: alertDiv }); }
    
    if (!requireAction) {
        setTimeout(() => {
            if (alertDiv.parentNode) alertDiv.remove();
        }, 4500);
    }
}
