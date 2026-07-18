 // ============================================================
//  DATA LAYER
// ============================================================
const STORAGE_KEY = 'gymMembersData';

let members = [];

function loadMembers() {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw) {
            members = JSON.parse(raw);
        } else {
            // Seed with sample data
            const today = new Date();
            const fmt = d => d.toISOString().split('T')[0];
            const plusMonths = (d, n) => {
                const r = new Date(d);
                r.setMonth(r.getMonth() + n);
                return r;
            };
            members = [{
                id: '1',
                name: 'Alice Johnson',
                phone: '555-0101',
                startDate: fmt(today),
                durationMonths: 3,
                endDate: fmt(plusMonths(today, 3)),
            }, {
                id: '2',
                name: 'Bob Smith',
                phone: '555-0102',
                startDate: fmt(new Date(today.getFullYear(), today.getMonth() - 2, 15)),
                durationMonths: 3,
                endDate: fmt(plusMonths(new Date(today.getFullYear(), today.getMonth() - 2, 15), 3)),
            }, {
                id: '3',
                name: 'Carol Davis',
                phone: '555-0103',
                startDate: fmt(new Date(today.getFullYear(), today.getMonth() - 6, 1)),
                durationMonths: 6,
                endDate: fmt(plusMonths(new Date(today.getFullYear(), today.getMonth() - 6, 1), 6)),
            }, ];
            saveMembers();
        }
    } catch (_) {
        members = [];
    }
    // Ensure each member has an id
    members = members.filter(m => m && typeof m === 'object').map(m => {
        if (!m.id) m.id = crypto.randomUUID ? crypto.randomUUID() : 'm_' + Date.now() + '_' + Math.random()
        .toString(36).slice(2, 7);
        return m;
    });
    saveMembers();
}

function saveMembers() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(members));
}

function generateId() {
    return crypto.randomUUID ? crypto.randomUUID() : 'm_' + Date.now() + '_' + Math.random().toString(36).slice(2, 9);
}

// ============================================================
//  HELPERS
// ============================================================
function todayStr() {
    return new Date().toISOString().split('T')[0];
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

// ============================================================
//  RENDER
// ============================================================
function render() {
    const search = document.getElementById('searchInput').value.toLowerCase().trim();
    const filter = document.getElementById('filterSelect').value;

    let filtered = [...members];

    // Search
    if (search) {
        filtered = filtered.filter(m => m.name.toLowerCase().includes(search));
    }

    // Filter
    if (filter === 'active') {
        filtered = filtered.filter(m => getStatus(m.endDate) === 'active');
    } else if (filter === 'expired') {
        filtered = filtered.filter(m => getStatus(m.endDate) === 'expired');
    } else if (filter === 'expiring-soon') {
        filtered = filtered.filter(m => getStatus(m.endDate) === 'expiring-soon');
    }

    // Sort by end date (closest first) — default
    filtered.sort((a, b) => a.endDate.localeCompare(b.endDate));

    const tbody = document.getElementById('memberTableBody');
    const empty = document.getElementById('emptyState');

    // Update stats
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
                                <button class="btn btn-danger btn-sm delete-btn" data-id="${m.id}">🗑️</button>
                            </div>
                        </td>
                    </tr>
                `;
    }

    tbody.innerHTML = html;

    // Attach delete events
    document.querySelectorAll('.delete-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            const id = this.dataset.id;
            deleteMember(id);
        });
    });
}

// Simple escape
function escHtml(str) {
    if (!str) return '';
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// ============================================================
//  CRUD
// ============================================================
function addMember(name, phone, startDate, durationMonths) {
    const endDate = addMonths(startDate, durationMonths);
    const member = {
        id: generateId(),
        name: name.trim(),
        phone: phone.trim() || '',
        startDate,
        durationMonths: parseInt(durationMonths, 10),
        endDate,
    };
    members.push(member);
    saveMembers();
    render();
    showToast(`✅ ${member.name} added successfully!`, 'success');
}

function deleteMember(id) {
    if (!confirm('Delete this member?')) return;
    const member = members.find(m => m.id === id);
    members = members.filter(m => m.id !== id);
    saveMembers();
    render();
    if (member) showToast(`🗑️ ${member.name} removed.`, 'info');
}

function clearAllData() {
    if (!confirm('⚠️ This will delete ALL members. Are you sure?')) return;
    if (!confirm('Really? This cannot be undone!')) return;
    members = [];
    saveMembers();
    render();
    showToast('🗑️ All data cleared.', 'info');
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
//  FORM HANDLING
// ============================================================
document.getElementById('memberForm').addEventListener('submit', function(e) {
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
    // Set default date again after reset
    document.getElementById('memberStart').value = todayStr();
    document.getElementById('memberName').focus();
});

// ============================================================
//  SEARCH & FILTER
// ============================================================
document.getElementById('searchInput').addEventListener('input', render);
document.getElementById('filterSelect').addEventListener('change', render);

// ============================================================
//  SORT BUTTON (toggle ascending/descending by end date)
// ============================================================
let sortAsc = true;
document.getElementById('sortBtn').addEventListener('click', function() {
    sortAsc = !sortAsc;
    members.sort((a, b) => {
        const cmp = a.endDate.localeCompare(b.endDate);
        return sortAsc ? cmp : -cmp;
    });
    saveMembers();
    render();
    showToast(`📅 Sorted ${sortAsc ? 'oldest → newest' : 'newest → oldest'}`, 'info');
});

// ============================================================
//  CLEAR ALL
// ============================================================
document.getElementById('clearAllBtn').addEventListener('click', clearAllData);

// ============================================================
//  INIT
// ============================================================
// Set default date to today
document.getElementById('memberStart').value = todayStr();

loadMembers();
render();

// Auto-refresh every 60 seconds (to update "days left")
setInterval(render, 60000);