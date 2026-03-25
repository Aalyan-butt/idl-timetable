// ===== NOTIFICATIONS =====
async function loadNotifications() {
  if (currentUser?.role !== 'superadmin') return;
  const container = document.getElementById('notifications-list');
  if (!container) return;
  container.innerHTML = '<div class="card"><p style="color:var(--text-muted);text-align:center;padding:28px">Loading\u2026</p></div>';
  try {
    const data = await api('api/notifications.php');
    _notificationsCache = data;
    renderNotifications(data);
    // Page opened = user has seen all current notifications; clear badge
    _notifLastSeenId = data.length ? Math.max(...data.map(n => n.id)) : _notifLastSeenId;
    updateNotificationBadge(0);
  } catch(e) {
    container.innerHTML = `<div class="card"><p style="color:var(--danger);text-align:center;padding:28px">Failed to load: ${e.message}</p></div>`;
  }
}

function renderNotifications(list) {
  const container = document.getElementById('notifications-list');
  if (!container) return;
  const countEl = document.getElementById('notif-count-label');
  if (countEl) countEl.textContent = list.length ? `${list.length} notification${list.length>1?'s':''}` : '';
  if (list.length === 0) {
    container.innerHTML = `<div class="empty-state" style="padding:60px 24px">
      <svg width="52" height="52" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="opacity:.3"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
      <p style="font-size:1rem;margin-top:14px;color:var(--text-muted)">No notifications yet</p>
      <p style="font-size:0.85rem;margin-top:6px;color:var(--text-muted)">Changes made by admins &amp; supervisors will appear here.</p>
    </div>`;
    return;
  }
  const actionMeta = {
    add:    { label: 'added',   iconClass: 'notif-icon-add',    cardClass: 'notif-card-add',    icon: '\u002b' },
    edit:   { label: 'edited',  iconClass: 'notif-icon-edit',   cardClass: 'notif-card-edit',   icon: '\u270f' },
    delete: { label: 'deleted', iconClass: 'notif-icon-delete', cardClass: 'notif-card-delete', icon: '\u2715' }
  };
  const entityLabel = { teacher: 'teacher', class: 'class', timetable: 'timetable slot', user: 'user account' };
  const roleBadge   = { admin: 'badge-red', supervisor: 'badge-purple', user: 'badge-blue', superadmin: 'badge-gold' };
  container.innerHTML = list.map(n => {
    const am  = actionMeta[n.action_type] || { label: n.action_type, iconClass: 'notif-icon-edit', cardClass: '', icon: '\u25cf' };
    const el  = entityLabel[n.entity_type] || n.entity_type;
    const bc  = roleBadge[n.actor_role] || 'badge-gold';
    const ago = formatTimeAgo(n.created_at);
    const full = new Date(n.created_at).toLocaleString('en-PK', { timeZone:'Asia/Karachi', day:'2-digit', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit' });
    const nameEsc = escapeHtml(n.entity_name || '');
    return `<div class="notif-card ${am.cardClass}" id="notif-item-${n.id}">
      <div class="notif-icon ${am.iconClass}">${am.icon}</div>
      <div class="notif-body">
        <div class="notif-headline">
          <strong>${escapeHtml(n.actor_username)}</strong>
          <span class="badge ${bc}" style="margin:0 6px;font-size:0.7rem;padding:1px 8px">${n.actor_role}</span>
          ${am.label} a ${el}:
          <span style="color:var(--accent2);font-style:italic">&nbsp;${nameEsc}</span>
        </div>
        <div class="notif-meta">
          <span title="${full}">&#128336; ${ago}</span>
          <span style="opacity:0.4">&#8226;</span>
          <span>${el.charAt(0).toUpperCase()+el.slice(1)}</span>
        </div>
      </div>
      <div class="notif-actions">
        <button class="btn btn-success btn-sm" onclick="undoNotification(${n.id})" title="Revert this change">&#8617; Undo</button>
        <button class="btn btn-danger btn-sm" onclick="deleteNotification(${n.id})" title="Dismiss">&times;</button>
      </div>
    </div>`;
  }).join('');
}

function filterNotifications() {
  const q = (document.getElementById('notif-search')?.value || '').trim().toLowerCase();
  if (!q) { renderNotifications(_notificationsCache); return; }
  renderNotifications(_notificationsCache.filter(n =>
    (n.actor_username||'').toLowerCase().includes(q) ||
    (n.actor_role||'').toLowerCase().includes(q)     ||
    (n.action_type||'').toLowerCase().includes(q)    ||
    (n.entity_type||'').toLowerCase().includes(q)    ||
    (n.entity_name||'').toLowerCase().includes(q)
  ));
}

async function deleteNotification(id) {
  try {
    await api(`api/notifications.php?id=${id}`, 'DELETE');
    _notificationsCache = _notificationsCache.filter(n => n.id !== id);
    const el = document.getElementById(`notif-item-${id}`);
    if (el) { el.style.transition='opacity 0.25s,transform 0.25s'; el.style.opacity='0'; el.style.transform='translateX(30px)'; setTimeout(()=>el.remove(),260); }
    updateNotificationBadge(_notificationsCache.length);
    const countEl = document.getElementById('notif-count-label');
    if (countEl) countEl.textContent = _notificationsCache.length ? `${_notificationsCache.length} notification${_notificationsCache.length>1?'s':''}` : '';
    toast('Notification dismissed', 'success');
  } catch(e) { toast('Failed to dismiss: ' + e.message, 'error'); }
}

async function undoNotification(id) {
  showPopupConfirm({
    title: 'Undo this change?',
    msg: 'The system will revert to the previous state. This cannot be undone once confirmed.',
    icon: '\u21a9',
    yesLabel: 'Yes, Undo',
    yesCls: 'btn-success',
    onYes: async () => {
      try {
        await api(`api/notifications.php?action=undo&id=${id}`, 'POST');
        _notificationsCache = _notificationsCache.filter(n => n.id !== id);
        const el = document.getElementById(`notif-item-${id}`);
        if (el) { el.style.transition='opacity 0.25s,transform 0.25s'; el.style.opacity='0'; el.style.transform='translateX(30px)'; setTimeout(()=>el.remove(),260); }
        updateNotificationBadge(_notificationsCache.length);
        const countEl = document.getElementById('notif-count-label');
        if (countEl) countEl.textContent = _notificationsCache.length ? `${_notificationsCache.length} notification${_notificationsCache.length>1?'s':''}` : '';
        toast('Change successfully undone', 'success');
        await loadAllData();
        if (document.getElementById('page-teachers')?.classList.contains('active')) loadTeachers();
        if (document.getElementById('page-classes')?.classList.contains('active'))  loadClasses();
        if (document.getElementById('page-timetable')?.classList.contains('active')) loadTimetable();
        if (document.getElementById('page-users')?.classList.contains('active'))    loadUsers();
        if (document.getElementById('page-dashboard')?.classList.contains('active')) loadDashboard();
      } catch(e) { toast('Undo failed: ' + e.message, 'error'); }
    }
  });
}

async function clearAllNotifications() {
  showPopupConfirm({
    title: 'Clear all notifications?',
    msg: 'All notifications will be permanently deleted. This cannot be undone.',
    icon: '\u26a0\ufe0f',
    yesLabel: 'Yes, Clear All',
    yesCls: 'btn-danger',
    onYes: async () => {
      try {
        await api('api/notifications.php?action=clear_all', 'POST');
        _notificationsCache = [];
        renderNotifications([]);
        updateNotificationBadge(0);
        toast('All notifications cleared', 'success');
      } catch(e) { toast('Failed: ' + e.message, 'error'); }
    }
  });
}

function updateNotificationBadge(count) {
  const badge = document.getElementById('notif-badge');
  if (!badge) return;
  if (count > 0) { badge.textContent = count > 99 ? '99+' : String(count); badge.style.display = ''; }
  else { badge.style.display = 'none'; }
}

function formatTimeAgo(dateStr) {
  const d = new Date(dateStr);
  const diff = Math.floor((Date.now() - d.getTime()) / 1000);
  if (diff < 60)   return 'just now';
  if (diff < 3600) { const m = Math.floor(diff/60);   return `${m} minute${m>1?'s':''} ago`; }
  if (diff < 86400){ const h = Math.floor(diff/3600);  return `${h} hour${h>1?'s':''} ago`; }
  const days = Math.floor(diff/86400);
  if (days < 7)    return `${days} day${days>1?'s':''} ago`;
  return d.toLocaleDateString('en-PK', { timeZone:'Asia/Karachi', day:'2-digit', month:'short', year:'numeric' });
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

