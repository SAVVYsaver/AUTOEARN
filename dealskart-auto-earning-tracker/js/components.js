/**
 * Dealskart – Auto Earning Tracker
 * Reusable UI Components (Toasts, Confirm Modal, Escape Helper)
 */

export function escapeHTML(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function showToast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const styles = {
    success: 'bg-emerald-600 text-white border-emerald-500',
    error: 'bg-rose-600 text-white border-rose-500',
    warning: 'bg-amber-500 text-slate-950 border-amber-400',
    info: 'bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 border-slate-700'
  };

  const toast = document.createElement('div');
  toast.className = `px-4 py-3 rounded-xl shadow-lg border text-sm font-medium flex items-center justify-between gap-3 transform transition-all duration-300 translate-y-2 opacity-0 ${styles[type] || styles.info}`;
  toast.innerHTML = `<span>${escapeHTML(message)}</span>`;
  container.appendChild(toast);

  requestAnimationFrame(() => {
    toast.classList.remove('translate-y-2', 'opacity-0');
  });

  setTimeout(() => {
    toast.classList.add('opacity-0', 'translate-y-2');
    setTimeout(() => toast.remove(), 300);
  }, 3800);
}

export function showConfirmModal({ title, message, confirmLabel = 'Delete', onConfirm }) {
  const modal = document.getElementById('confirm-modal');
  const titleEl = document.getElementById('confirm-modal-title');
  const msgEl = document.getElementById('confirm-modal-msg');
  const okBtn = document.getElementById('confirm-modal-ok');
  const cancelBtn = document.getElementById('confirm-modal-cancel');
  if (!modal) return;

  titleEl.textContent = title;
  msgEl.textContent = message;
  okBtn.textContent = confirmLabel;
  modal.classList.remove('hidden');

  const cleanup = () => {
    modal.classList.add('hidden');
    okBtn.replaceWith(okBtn.cloneNode(true));
    cancelBtn.replaceWith(cancelBtn.cloneNode(true));
  };

  const newOk = document.getElementById('confirm-modal-ok');
  const newCancel = document.getElementById('confirm-modal-cancel');

  newCancel.addEventListener('click', cleanup);
  newOk.addEventListener('click', async () => {
    newOk.disabled = true;
    try {
      await onConfirm();
    } finally {
      newOk.disabled = false;
      cleanup();
    }
  });
}
