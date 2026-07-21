// ============================================================
//  SIDEBAR NAVIGATION
// ============================================================

// Page navigation
function navigateTo(pageId) {
    // Hide all pages
    document.querySelectorAll('.page').forEach(page => {
        page.style.display = 'none';
    });
    
    // Show the target page
    const targetPage = document.getElementById(`page-${pageId}`);
    if (targetPage) {
        targetPage.style.display = 'block';
    }
    
    // Update active button
    document.querySelectorAll('.sidebar-btn').forEach(btn => {
        btn.classList.remove('active');
        if (btn.dataset.page === pageId) {
            btn.classList.add('active');
        }
    });
}

// Sidebar button clicks
document.querySelectorAll('.sidebar-btn[data-page]').forEach(btn => {
    btn.addEventListener('click', function() {
        const page = this.dataset.page;
        navigateTo(page);
        
        // Close sidebar on mobile
        document.getElementById('sidebar').classList.remove('open');
    });
});

// Mobile hamburger menu
function toggleSidebar() {
    document.getElementById('sidebar').classList.toggle('open');
}

// Add hamburger button
const hamburger = document.createElement('button');
hamburger.className = 'sidebar-toggle';
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
// Check if user is logged in
(function checkAuth() {
    const loggedIn = sessionStorage.getItem('loggedIn');
    if (!loggedIn || loggedIn !== 'true') {
        // Not logged in – redirect to login page
        window.location.href = '/login.html';
    }
})();

// If the user tries to go back to login after being logged in
if (window.location.pathname === '/login.html' && sessionStorage.getItem('loggedIn') === 'true') {
    window.location.href = '/';
}
 // ============================================================
//  BACKEND API CONFIGURATION
// ============================================================
const API_BASE = (function() {
    if (window.location.protocol === 'file:' || window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
        return 'http://127.0.0.1:5000/api';
    }
    return '/api';
})();

// ============================================================
//  DATA LAYER (now uses the API instead of localStorage)
// ============================================================
let members = [];

async function loadMembers() {
    try {
        const res = await fetch(`${API_BASE}/members`);
        if (!res.ok) throw new Error('Failed to load members');
        members = await res.json();
        render();
        renderMembersPage(); 
    } catch (err) {
        showToast('Error loading members: ' + err.message, 'error');
        members = [];
        render();
        renderMembersPage();
    }
}

async function addMember(name, phone, startDate, durationMonths) {
    try {
        const res = await fetch(`${API_BASE}/members`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, phone, startDate, durationMonths })
        });
        if (!res.ok) throw new Error(await res.text());
        const newMember = await res.json();
        members.push(newMember);
        render();
        showToast(`✅ ${newMember.name} added!`, 'success');
    } catch (err) {
        showToast('Error adding member: ' + err.message, 'error');
    }
}

async function deleteMember(id) {
    if (!confirm('Delete this member?')) return;
    try {
        const res = await fetch(`${API_BASE}/members/${id}`, { method: 'DELETE' });
        if (!res.ok) throw new Error('Delete failed');
        members = members.filter(m => m.id !== id);
        render();
        showToast('Member removed', 'info');
    } catch (err) {
        showToast('Error deleting: ' + err.message, 'error');
    }
}

async function clearAllData() {
    if (!confirm('⚠️ Delete ALL members?')) return;
    try {
        const res = await fetch(`${API_BASE}/members`, { method: 'DELETE' });
        if (!res.ok) throw new Error('Clear failed');
        members = [];
        render();
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
        render();
        closeRenewModal();
        showToast(`🔄 ${updated.name} renewed`, 'success');
    } catch (err) {
        showToast('Error renewing: ' + err.message, 'error');
    }
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

// ============================================================
//  RENDER
// ============================================================
function render() {
    const search = document.getElementById('searchInput').value.toLowerCase().trim();
    const filter = document.getElementById('filterSelect').value;

    let filtered = [...members];

    if (search) {
        filtered = filtered.filter(m => m.name.toLowerCase().includes(search));
    }

    if (filter === 'active') {
        filtered = filtered.filter(m => getStatus(m.endDate) === 'active');
    } else if (filter === 'expired') {
        filtered = filtered.filter(m => getStatus(m.endDate) === 'expired');
    } else if (filter === 'expiring-soon') {
        filtered = filtered.filter(m => getStatus(m.endDate) === 'expiring-soon');
    }

    filtered.sort((a, b) => a.endDate.localeCompare(b.endDate));

    const tbody = document.getElementById('memberTableBody');
    const empty = document.getElementById('emptyState');

    const total = members.length;
    const active = members.filter(m => getStatus(m.endDate) === 'active').length;
    const expired = members.filter(m => getStatus(m.endDate) === 'expired').length;
    document.getElementById('totalCount').textContent = total;
    document.getElementById('activeCount').textContent = active;
    document.getElementById('expiredCount').textContent = expired;

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
                <td><span class="member-name">${escHtml(m.name)}</span></td>
                <td class="member-phone">${m.phone ? escHtml(m.phone) : '—'}</td>
                <td>${formatDate(m.startDate)}</td>
                <td>${formatDate(m.endDate)}</td>
                <td><span class="status-badge ${statusClass}">${statusLabel}</span></td>
                <td><span class="days-remaining ${daysClass}">${formatDays(days)}</span></td>
                <td style="text-align:center;">
                    <div class="action-cell" style="justify-content:center;">
                        <button class="btn btn-success btn-sm renew-btn" data-id="${m.id}">🔄 Renew</button>
                        <button class="btn btn-danger btn-sm delete-btn" data-id="${m.id}">🗑️</button>
                    </div>
                </td>
            </tr>
        `;
    }

    tbody.innerHTML = html;
}
// ============================================================
//  MEMBERS PAGE RENDER
// ============================================================

function renderMembersPage() {
    const search = document.getElementById('membersSearchInput').value.toLowerCase().trim();
    const filter = document.getElementById('membersFilterSelect').value;

    let filtered = [...members];

    if (search) {
        filtered = filtered.filter(m => m.name.toLowerCase().includes(search));
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

    // Update stats
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
                <td><span class="member-name">${escHtml(m.name)}</span></td>
                <td class="member-phone">${m.phone ? escHtml(m.phone) : '—'}</td>
                <td>${formatDate(m.startDate)}</td>
                <td>${formatDate(m.endDate)}</td>
                <td><span class="status-badge ${statusClass}">${statusLabel}</span></td>
                <td><span class="days-remaining ${daysClass}">${formatDays(days)}</span></td>
                <td style="text-align:center;">
                    <div class="action-cell" style="justify-content:center;">
                        <button class="btn btn-success btn-sm renew-btn" data-id="${m.id}">🔄 Renew</button>
                        <button class="btn btn-danger btn-sm delete-btn" data-id="${m.id}">🗑️</button>
                    </div>
                </td>
            </tr>
        `;
    }

    tbody.innerHTML = html;
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

    // Form submission
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

    // Search & filter
    document.getElementById('searchInput').addEventListener('input', render);
    document.getElementById('filterSelect').addEventListener('change', render);
    
    // Members page search & filter
    document.getElementById('membersSearchInput').addEventListener('input', renderMembersPage);
    document.getElementById('membersFilterSelect').addEventListener('change', renderMembersPage);
   
    // Clickable stat badges
    document.getElementById('activeBadge').addEventListener('click', function() {
        document.getElementById('filterSelect').value = 'active';
        render();
    });
    document.getElementById('expiredBadge').addEventListener('click', function() {
        document.getElementById('filterSelect').value = 'expired';
        render();
    });
    document.getElementById('totalBadge').addEventListener('click', function() {
        document.getElementById('filterSelect').value = 'all';
        render();
    });

    // Sort
    let sortAsc = true;
    document.getElementById('sortBtn').addEventListener('click', function() {
        sortAsc = !sortAsc;
        members.sort((a, b) => {
            const cmp = a.endDate.localeCompare(b.endDate);
            return sortAsc ? cmp : -cmp;
        });
        render();
        showToast(`📅 Sorted ${sortAsc ? 'oldest → newest' : 'newest → oldest'}`, 'info');
    });

    // Clear all
    document.getElementById('clearAllBtn').addEventListener('click', clearAllData);

    // Renew modal
    document.getElementById('cancelRenew').addEventListener('click', closeRenewModal);
    document.getElementById('confirmRenew').addEventListener('click', confirmRenewal);
    document.getElementById('renewModal').addEventListener('click', function(e) {
        if (e.target.id === 'renewModal') closeRenewModal();
    });

    // Event delegation for dynamic buttons (delete & renew)
    document.getElementById('memberTableBody').addEventListener('click', function(e) {
        const target = e.target.closest('button');
        if (!target) return;
        const id = Number(target.dataset.id);
        if (!id && id !== 0) return;

        if (target.classList.contains('delete-btn')) {
            deleteMember(id);
        } else if (target.classList.contains('renew-btn')) {
            openRenewModal(id);
        }
    });

    // Event delegation for Members page buttons (delete & renew)
    document.getElementById('membersTableBody').addEventListener('click', function(e) {
        const target = e.target.closest('button');
        if (!target) return;
        const id = Number(target.dataset.id);
        if (!id && id !== 0) return;

        if (target.classList.contains('delete-btn')) {
           deleteMember(id);
        } else if (target.classList.contains('renew-btn')) {
            openRenewModal(id);
       }
});

    // Init
    document.getElementById('memberStart').value = todayStr();
    loadMembers();

    // Auto-refresh every 60 seconds
    setInterval(loadMembers, 60000);
});