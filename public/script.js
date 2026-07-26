// ============================================================
//  SIDEBAR NAVIGATION
// ============================================================
function navigateTo(pageId) {
    document.querySelectorAll('.page').forEach(page => {
        page.style.display = 'none';
    });
    const targetPage = document.getElementById(`page-${pageId}`);
    if (targetPage) {
        targetPage.style.display = 'block';
    }
    document.querySelectorAll('.sidebar-btn').forEach(btn => {
        btn.classList.remove('active');
        if (btn.dataset.page === pageId) {
            btn.classList.add('active');
        }
    });
}

document.querySelectorAll('.sidebar-btn[data-page]').forEach(btn => {
    btn.addEventListener('click', function() {
        const page = this.dataset.page;
        navigateTo(page);
        const sidebar = document.getElementById('sidebar');
        const hamburger = document.querySelector('.sidebar-toggle');
        sidebar.classList.remove('open');
        hamburger.style.display = 'block';
    });
});

function toggleSidebar() {
    const sidebar = document.getElementById('sidebar');
    const hamburger = document.querySelector('.sidebar-toggle');
    sidebar.classList.toggle('open');
    if (sidebar.classList.contains('open')) {
        hamburger.style.display = 'none';
    } else {
        hamburger.style.display = 'block';
    }
}

document.querySelector('.main-content').addEventListener('click', function() {
    const sidebar = document.getElementById('sidebar');
    const hamburger = document.querySelector('.sidebar-toggle');
    if (sidebar.classList.contains('open')) {
        sidebar.classList.remove('open');
        hamburger.style.display = 'block';
    }
});

document.body.addEventListener('click', function(e) {
    const sidebar = document.getElementById('sidebar');
    const hamburger = document.querySelector('.sidebar-toggle');
    if (!sidebar.contains(e.target) && !hamburger.contains(e.target)) {
        if (sidebar.classList.contains('open')) {
            sidebar.classList.remove('open');
            hamburger.style.display = 'block';
        }
    }
});

const hamburger = document.createElement('button');
hamburger.className = 'sidebar-toggle';
hamburger.id = 'hamburgerBtn';
hamburger.innerHTML = '☰';
hamburger.onclick = toggleSidebar;
document.body.prepend(hamburger);

// ============================================================
//  LOGOUT
// ============================================================
document.getElementById('logoutBtn').addEventListener('click', function() {
    sessionStorage.removeItem('loggedIn');
    window.location.href = '/login.html';
});

// ============================================================
//  AUTH CHECK
// ============================================================
(function checkAuth() {
    const loggedIn = sessionStorage.getItem('loggedIn');
    if (!loggedIn || loggedIn !== 'true') {
        window.location.href = '/login.html';
    }
})();

if (window.location.pathname === '/login.html' && sessionStorage.getItem('loggedIn') === 'true') {
    window.location.href = '/';
}

// ============================================================
//  API CONFIG
// ============================================================
const API_BASE = (function() {
    if (window.location.protocol === 'file:' || window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
        return 'http://127.0.0.1:5000/api';
    }
    return '/api';
})();

// ============================================================
//  DATA LAYER
// ============================================================
let members = [];
let archivedMembers = [];

async function loadMembers() {
    try {
        const [activeRes, archivedRes] = await Promise.all([
            fetch(`${API_BASE}/members`),
            fetch(`${API_BASE}/members?archived=true`)
        ]);
        if (!activeRes.ok) throw new Error('Failed to load members');
        if (!archivedRes.ok) throw new Error('Failed to load archived');
        members = await activeRes.json();
        archivedMembers = await archivedRes.json();
        updateStats();
        renderMembersPage();
        renderDashboardLists();
        renderArchivedPage();
        document.getElementById('archivedCount').textContent = archivedMembers.length;
    } catch (err) {
        showToast('Error loading data: ' + err.message, 'error');
        members = [];
        archivedMembers = [];
        updateStats();
        renderMembersPage();
        renderDashboardLists();
        renderArchivedPage();
    }
}

async function checkPhone(phone) {
    try {
        const res = await fetch(`${API_BASE}/members/check-phone/${encodeURIComponent(phone)}`);
        if (!res.ok) throw new Error('Failed to check phone');
        return await res.json();
    } catch (err) {
        showToast('Error checking phone: ' + err.message, 'error');
        return null;
    }
}

async function addMember(name, phone, startDate, durationMonths) {
    if (!phone || phone.trim() === '') {
        showToast('⚠️ Phone number is required.', 'error');
        return;
    }

    const check = await checkPhone(phone);
    if (check && check.exists) {
        if (check.archived) {
            if (confirm(`📁 Member "${check.name}" already exists but is archived. Do you want to restore them?`)) {
                await restoreMember(check.id);
                showToast(`✅ ${check.name} restored successfully!`, 'success');
                loadMembers();
                return;
            } else {
                showToast('Member not added.', 'info');
                return;
            }
        } else {
            showToast(`❌ Member with phone ${phone} already exists (${check.name}).`, 'error');
            return;
        }
    }

    try {
        const res = await fetch(`${API_BASE}/members`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, phone, startDate, durationMonths })
        });
        if (!res.ok) throw new Error(await res.text());
        const newMember = await res.json();
        members.push(newMember);
        loadMembers();
        showToast(`✅ ${newMember.name} added!`, 'success');
    } catch (err) {
        showToast('Error adding member: ' + err.message, 'error');
    }
}

async function archiveMember(id) {
    if (!confirm('Archive this member? They will be moved to Archived section.')) return;
    try {
        const res = await fetch(`${API_BASE}/members/${id}`, { method: 'DELETE' });
        if (!res.ok) throw new Error('Archive failed');
        showToast('Member archived', 'info');
        loadMembers();
    } catch (err) {
        showToast('Error archiving: ' + err.message, 'error');
    }
}

async function restoreMember(id) {
    try {
        const res = await fetch(`${API_BASE}/members/${id}/restore`, { method: 'PUT' });
        if (!res.ok) throw new Error('Restore failed');
        const data = await res.json();
        showToast(`✅ ${data.member.name} restored`, 'success');
        loadMembers();
        closeMemberDetails();
    } catch (err) {
        showToast('Error restoring: ' + err.message, 'error');
    }
}

async function clearAllData() {
    if (!confirm('⚠️ Delete ALL members (hard delete)?')) return;
    try {
        const res = await fetch(`${API_BASE}/members`, { method: 'DELETE' });
        if (!res.ok) throw new Error('Clear failed');
        members = [];
        archivedMembers = [];
        loadMembers();
        showToast('All data cleared', 'info');
    } catch (err) {
        showToast('Error clearing: ' + err.message, 'error');
    }
}

// ============================================================
//  RENEW MODAL
// ============================================================
let activeRenewMemberId = null;

function openRenewModal(id) {
    const memberId = Number(id);
    const member = members.find(m => m.id === memberId);
    if (!member) {
        showToast('❌ Member not found.', 'error');
        return;
    }
    activeRenewMemberId = memberId;
    document.getElementById('renewMemberName').textContent = member.name;
    document.getElementById('renewStartDate').value = todayStr();
    document.getElementById('renewMonths').value = member.durationMonths || 3;
    document.getElementById('renewModal').hidden = false;
    document.getElementById('renewStartDate').focus();
}

function closeRenewModal() {
    document.getElementById('renewModal').hidden = true;
    activeRenewMemberId = null;
}

async function confirmRenewal() {
    if (!activeRenewMemberId) return;
    const startDate = document.getElementById('renewStartDate').value;
    const months = parseInt(document.getElementById('renewMonths').value, 10);
    if (!startDate || months <= 0) {
        showToast('Invalid date or months', 'error');
        return;
    }
    try {
        const res = await fetch(`${API_BASE}/members/${activeRenewMemberId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ startDate, durationMonths: months })
        });
        if (!res.ok) throw new Error('Renew failed');
        const updated = await res.json();
        const idx = members.findIndex(m => m.id === updated.id);
        if (idx !== -1) members[idx] = updated;
        loadMembers();
        closeRenewModal();
        showToast(`🔄 ${updated.name} renewed`, 'success');
    } catch (err) {
        showToast('Error renewing: ' + err.message, 'error');
    }
}

// ============================================================
//  MEMBER DETAILS MODAL (with history)
// ============================================================
let detailsMemberId = null;
let detailsIsArchived = false;

async function renderMemberHistory(memberId) {
    const container = document.getElementById('memberHistoryContainer');
    try {
        const res = await fetch(`${API_BASE}/members/${memberId}/history`);
        if (!res.ok) throw new Error('Failed to load history');
        const history = await res.json();
        
        if (history.length === 0) {
            container.innerHTML = '<p class="text-muted">No history yet.</p>';
            return;
        }
        
        let html = `
            <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 6px; font-weight: 600; padding: 4px 0; border-bottom: 1px solid #dee2e6; color: #495057; font-size: 0.75rem; text-transform: uppercase;">
                <span>Start</span>
                <span>End</span>
                <span>Duration</span>
            </div>
        `;
        for (const h of history) {
            html += `
                <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 6px; padding: 4px 0; border-bottom: 1px solid #f1f3f5; color: #212529; font-size: 0.85rem;">
                    <span>${formatDate(h.startDate)}</span>
                    <span>${formatDate(h.endDate)}</span>
                    <span>${h.durationMonths} mo</span>
                </div>
            `;
        }
        container.innerHTML = html;
    } catch (err) {
        container.innerHTML = `<p class="text-muted">Error loading history: ${err.message}</p>`;
    }
}

async function openMemberDetails(id) {
    const memberId = Number(id);
    let member = members.find(m => m.id === memberId);
    let isArchived = false;
    if (!member) {
        member = archivedMembers.find(m => m.id === memberId);
        isArchived = true;
    }
    if (!member) {
        showToast('❌ Member not found.', 'error');
        return;
    }
console.log('Member object:', member);
console.log('Name:', member.name);
console.log('Phone:', member.phone);
console.log('Start:', member.startDate);
console.log('End:', member.endDate);
    detailsMemberId = memberId;
    detailsIsArchived = isArchived;

    document.getElementById('detailName').textContent = member.name;
   const phoneEl = document.getElementById('detailPhone');
if (member.phone) {
    // Clean the phone number: keep only digits and '+' (for international)
    const cleanPhone = member.phone.replace(/[^0-9+]/g, '');
    // Generate the renewal message and URL-encode it
    const message = encodeURIComponent(getRenewalMessage(member));
    // Build the SMS link
    const waLink = `https://wa.me/${cleanPhone}?text=${message}`;
phoneEl.innerHTML = `<a href="${waLink}" target="_blank" style="color:#4a90d9;text-decoration:underline;">${member.phone}</a>`;}
  else {  phoneEl.textContent = '—';
}  
    document.getElementById('detailStartDate').textContent = formatDate(member.startDate);
    document.getElementById('detailEndDate').textContent = formatDate(member.endDate);

    const status = getStatus(member.endDate);
    let statusHTML = '';
    if (status === 'active') {
        statusHTML = '✅ <span style="color: #00b894;">Active</span>';
    } else if (status === 'expiring-soon') {
        statusHTML = '⚠️ <span style="color: #f39c12;">Expiring soon</span>';
    } else {
        statusHTML = '❌ <span style="color: #ff6b6b;">Expired</span>';
    }
    document.getElementById('detailStatus').innerHTML = `<strong>Status:</strong> ${statusHTML}`;

    const restoreBtn = document.getElementById('restoreFromDetails');
    if (isArchived) {
        restoreBtn.style.display = 'inline-block';
        restoreBtn.dataset.id = memberId;
    } else {
        restoreBtn.style.display = 'none';
    }

    // Load history
    document.getElementById('memberHistoryContainer').innerHTML = '<p class="text-muted">Loading history...</p>';
    await renderMemberHistory(memberId);

    document.getElementById('memberDetailsModal').hidden = false;
}

function closeMemberDetails() {
    document.getElementById('memberDetailsModal').hidden = true;
    detailsMemberId = null;
    detailsIsArchived = false;
}

// ============================================================
//  HELPERS
// ============================================================
function todayStr() {
    return new Date().toISOString().split('T')[0];
}

function setDefaultStartDate() {
    const startInput = document.getElementById('memberStart');
    if (startInput && !startInput.value) {
        startInput.value = todayStr();
    }
}

function addMonths(dateStr, months) {
    const d = new Date(dateStr);
    d.setMonth(d.getMonth() + months);
    return d.toISOString().split('T')[0];
}

function daysBetween(dateStr1, dateStr2) {
    const d1 = new Date(dateStr1);
    const d2 = new Date(dateStr2);
    const diff = d2.getTime() - d1.getTime();
    return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

function getStatus(endDate) {
    const today = todayStr();
    const days = daysBetween(today, endDate);
    if (days < 0) return 'expired';
    if (days <= 7) return 'expiring-soon';
    return 'active';
}

function formatDate(dateStr) {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatDays(days) {
    if (days === 0) return 'Today';
    if (days > 0) return `${days} day${days > 1 ? 's' : ''}`;
    return `${Math.abs(days)} day${Math.abs(days) > 1 ? 's' : ''} ago`;
}

function escHtml(str) {
    if (!str) return '';
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
function getRenewalMessage(member) {
    const name = member.name || 'Member';
    const endDate = formatDate(member.endDate);
    return `Dear ${name}, your gym membership expires on ${endDate}. Please renew your membership to continue enjoying our services. Thank you!`;
}
// ============================================================
//  RENDER: MEMBERS PAGE (no Start/End columns)
// ============================================================
function renderMembersPage() {
    const search = document.getElementById('membersSearchInput').value.toLowerCase().trim();
    const filter = document.getElementById('membersFilterSelect').value;

    let filtered = [...members];

    if (search) {
        filtered = filtered.filter(m =>
            m.name.toLowerCase().includes(search) ||
            (m.phone && m.phone.toLowerCase().includes(search))
        );
    }

    if (filter === 'active') {
        filtered = filtered.filter(m => getStatus(m.endDate) === 'active');
    } else if (filter === 'expired') {
        filtered = filtered.filter(m => getStatus(m.endDate) === 'expired');
    } else if (filter === 'expiring-soon') {
        filtered = filtered.filter(m => getStatus(m.endDate) === 'expiring-soon');
    }

    const tbody = document.getElementById('membersTableBody');
    const empty = document.getElementById('membersEmptyState');

    const total = members.length;
    const active = members.filter(m => getStatus(m.endDate) === 'active').length;
    const expired = members.filter(m => getStatus(m.endDate) === 'expired').length;
    document.getElementById('membersTotalCount').textContent = total;
    document.getElementById('membersActiveCount').textContent = active;
    document.getElementById('membersExpiredCount').textContent = expired;

    if (filtered.length === 0) {
        tbody.innerHTML = '';
        empty.style.display = 'block';
        return;
    }
    empty.style.display = 'none';

    let html = '';
    for (const m of filtered) {
        const status = getStatus(m.endDate);
        const days = daysBetween(todayStr(), m.endDate);
        let statusLabel, statusClass;
        if (status === 'active') {
            statusLabel = '✅ Active';
            statusClass = 'active';
        } else if (status === 'expiring-soon') {
            statusLabel = '⚠️ Expiring soon';
            statusClass = 'expiring-soon';
        } else {
            statusLabel = '❌ Expired';
            statusClass = 'expired';
        }

        let daysClass = 'positive';
        if (days < 0) daysClass = 'negative';
        else if (days <= 7) daysClass = 'warning';

        html += `
            <tr>
                <td><span class="member-name member-detail-btn" style="cursor:pointer;color:#4a90d9;text-decoration:underline;" data-id="${m.id}">${escHtml(m.name)}</span></td>
                <td class="member-phone">${m.phone ? escHtml(m.phone) : '—'}</td>
                <td><span class="status-badge ${statusClass}">${statusLabel}</span></td>
                <td><span class="days-remaining ${daysClass}">${formatDays(days)}</span></td>
                <td style="text-align:center;">
                    <div class="action-cell" style="justify-content:center;">
                        <button class="btn btn-success btn-sm renew-btn" data-id="${m.id}">🔄 Renew</button>
                        <button class="btn btn-danger btn-sm archive-btn" data-id="${m.id}">📁 Archive</button>
                    </div>
                </td>
            </tr>
        `;
    }
    tbody.innerHTML = html;
}

// ============================================================
//  RENDER: DASHBOARD LISTS (no Start/End, only Name, Phone, Days)
// ============================================================
function renderDashboardLists() {
    const today = todayStr();

    const expired = members.filter(m => getStatus(m.endDate) === 'expired');
    const expiringSoon = members.filter(m => getStatus(m.endDate) === 'expiring-soon');
    const newToday = members.filter(m => m.startDate === today);

    // Expired – show Renew button
    renderList('expiredList', expired, 'No expired members', function(m) {
        const days = daysBetween(m.endDate, today);
        return `Overdue ${Math.abs(days)} days`;
    }, 'red', true);

    // Expiring Soon – show Renew button
    renderList('expiringSoonList', expiringSoon, 'No members expiring soon', function(m) {
        const days = daysBetween(today, m.endDate);
        return `${days} days left`;
    }, 'orange', true);

    // New & Renewed Today – no Renew button
    renderList('newTodayList', newToday, 'No members added or renewed today', function(m) {
        return 'Today';
    }, 'green', false);
}

function renderList(elementId, membersList, emptyMessage, daysFormatter, daysColor, showRenew = false) {
    const container = document.getElementById(elementId);
    if (!container) return;

    if (membersList.length === 0) {
        container.innerHTML = `<p class="text-muted">${emptyMessage}</p>`;
        return;
    }

    const colorMap = {
        'red': '#e74c3c',
        'orange': '#f39c12',
        'green': '#27ae60'
    };
    const color = colorMap[daysColor] || '#636e72';

    let html = `
        <div style="display: grid; grid-template-columns: 1.5fr 1fr 1.2fr 0.8fr; gap: 8px; font-weight: 600; padding: 6px 0; border-bottom: 2px solid rgba(0,0,0,0.1); color: #2d3436; font-size: 0.85rem;">
            <span>Name</span>
            <span>Phone</span>
            <span>Days</span>
            <span>Action</span>
        </div>
    `;

    for (const m of membersList) {
        const daysText = daysFormatter ? daysFormatter(m) : '';
        html += `
            <div data-id="${m.id}" style="display: grid; grid-template-columns: 1.5fr 1fr 1.2fr 0.8fr; gap: 8px; padding: 6px 0; border-bottom: 1px solid rgba(0,0,0,0.05); align-items: center; color: #2d3436; font-size: 0.9rem; cursor:pointer;">
                <span style="font-weight: 600;">${escHtml(m.name)}</span>
                <span>${m.phone ? escHtml(m.phone) : '—'}</span>
                <span style="color: ${color}; font-weight: 600;">${daysText}</span>
                <span>
                    ${showRenew ? `<button class="btn btn-success btn-sm renew-btn" data-id="${m.id}" style="font-size:0.7rem; padding:2px 8px;">Renew</button>` : ''}
                </span>
            </div>
        `;
    }

    container.innerHTML = html;
}
// ============================================================
//  RENDER: ARCHIVED PAGE
// ============================================================
function renderArchivedPage() {
    const tbody = document.getElementById('archivedTableBody');
    const empty = document.getElementById('archivedEmptyState');

    if (archivedMembers.length === 0) {
        tbody.innerHTML = '';
        empty.style.display = 'block';
        return;
    }
    empty.style.display = 'none';

    let html = '';
    for (const m of archivedMembers) {
        html += `
            <tr>
                <td><span class="member-name member-detail-btn" style="cursor:pointer;color:#4a90d9;text-decoration:underline;" data-id="${m.id}">${escHtml(m.name)}</span></td>
                <td class="member-phone">${m.phone ? escHtml(m.phone) : '—'}</td>
                <td>${formatDate(m.startDate)}</td>
                <td>${formatDate(m.endDate)}</td>
                <td style="text-align:center;">
                    <div class="action-cell" style="justify-content:center;">
                        <button class="btn btn-success btn-sm restore-btn" data-id="${m.id}">🔄 Restore</button>
                    </div>
                </td>
            </tr>
        `;
    }
    tbody.innerHTML = html;
}

// ============================================================
//  UPDATE STATS
// ============================================================
function updateStats() {
    const total = members.length;
    const active = members.filter(m => getStatus(m.endDate) === 'active').length;
    const expired = members.filter(m => getStatus(m.endDate) === 'expired').length;
    document.getElementById('totalCount').textContent = total;
    document.getElementById('activeCount').textContent = active;
    document.getElementById('expiredCount').textContent = expired;
}

// ============================================================
//  TOAST
// ============================================================
function showToast(message, type = 'info') {
    const container = document.getElementById('toastContainer');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    container.appendChild(toast);
    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateY(16px)';
        toast.style.transition = 'opacity 0.3s, transform 0.3s';
        setTimeout(() => toast.remove(), 350);
    }, 2800);
}

// ============================================================
//  FORM & EVENT BINDING
// ============================================================
document.addEventListener('DOMContentLoaded', function() {
    const form = document.getElementById('memberForm');
    const startInput = document.getElementById('memberStart');

    setDefaultStartDate();

    form.addEventListener('reset', function() {
        setTimeout(() => {
            setDefaultStartDate();
            document.getElementById('memberName').focus();
        }, 0);
    });

    form.addEventListener('submit', function(e) {
        e.preventDefault();

        const name = document.getElementById('memberName').value.trim();
        const phone = document.getElementById('memberPhone').value.trim();
        const startDate = document.getElementById('memberStart').value;
        const duration = parseInt(document.getElementById('memberDuration').value, 10);

        if (!name) {
            showToast('⚠️ Please enter a name.', 'error');
            return;
        }
        if (!startDate) {
            showToast('⚠️ Please select a start date.', 'error');
            return;
        }

        addMember(name, phone, startDate, duration);
        this.reset();
        setDefaultStartDate();
        document.getElementById('memberName').focus();
    });

    // Members page search & filter
    document.getElementById('membersSearchInput').addEventListener('input', renderMembersPage);
    document.getElementById('membersFilterSelect').addEventListener('change', renderMembersPage);

    // Renew modal
    document.getElementById('cancelRenew').addEventListener('click', closeRenewModal);
    document.getElementById('confirmRenew').addEventListener('click', confirmRenewal);
    document.getElementById('renewModal').addEventListener('click', function(e) {
        if (e.target.id === 'renewModal') closeRenewModal();
    });

    // Member details modal
    document.getElementById('closeMemberDetails').addEventListener('click', closeMemberDetails);
    document.getElementById('memberDetailsModal').addEventListener('click', function(e) {
        if (e.target.id === 'memberDetailsModal') closeMemberDetails();
    });
    document.getElementById('restoreFromDetails').addEventListener('click', function() {
        const id = Number(this.dataset.id);
        if (id) restoreMember(id);
    });


    // Global event listener for dynamic buttons
    document.addEventListener('click', function(e) {
        const target = e.target.closest('button');
        if (target) {
            // Archive button
            if (target.classList.contains('archive-btn')) {
                const id = Number(target.dataset.id);
                if (id) archiveMember(id);
            }
            // Restore button
            else if (target.classList.contains('restore-btn')) {
                const id = Number(target.dataset.id);
                if (id) restoreMember(id);
            }
            // Renew button
            else if (target.classList.contains('renew-btn')) {
                const id = Number(target.dataset.id);
                if (id) openRenewModal(id);
            }
        }

               // Row clicks (any element with data-id that is not a button)
        const row = e.target.closest('[data-id]');
        if (row && !e.target.closest('button')) {
            const id = Number(row.dataset.id);
            if (id) openMemberDetails(id);
        }
    });

    // Init
    document.getElementById('memberStart').value = todayStr();
    loadMembers();

    // Auto-refresh every 60 seconds
    setInterval(loadMembers, 60000);
});