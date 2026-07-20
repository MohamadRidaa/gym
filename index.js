 const express = require('express');
const cors = require('cors');
const path = require('path');
const db = require('./db');

const app = express();
app.use(cors());
app.use(express.json());

// Serve frontend files from "public" folder
app.use(express.static(path.join(__dirname, 'public')));

// API: Get all members
app.get('/api/members', (req, res) => {
    db.all('SELECT id, name, phone, start_date, duration_months, end_date FROM members ORDER BY id DESC', (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        const formatted = rows.map(r => ({
            id: r.id,
            name: r.name,
            phone: r.phone,
            startDate: r.start_date,
            durationMonths: r.duration_months,
            endDate: r.end_date
        }));
        res.json(formatted);
    });
});

// API: Add new member
app.post('/api/members', (req, res) => {
    const { name, phone, startDate, durationMonths } = req.body;
    if (!name || !startDate || !durationMonths) {
        return res.status(400).json({ error: 'Missing required fields' });
    }

    const start = new Date(startDate);
    const end = new Date(start);
    end.setMonth(end.getMonth() + durationMonths);
    const endDate = end.toISOString().split('T')[0];

    db.run(
        `INSERT INTO members (name, phone, start_date, duration_months, end_date) VALUES (?, ?, ?, ?, ?)`,
        [name, phone || null, startDate, durationMonths, endDate],
        function(err) {
            if (err) return res.status(500).json({ error: err.message });
            res.status(201).json({
                id: this.lastID,
                name,
                phone: phone || null,
                startDate,
                durationMonths,
                endDate
            });
        }
    );
});

// API: Renew membership
app.put('/api/members/:id', (req, res) => {
    const { id } = req.params;
    const { startDate, durationMonths } = req.body;
    if (!startDate || !durationMonths) {
        return res.status(400).json({ error: 'Missing required fields' });
    }

    const start = new Date(startDate);
    const end = new Date(start);
    end.setMonth(end.getMonth() + durationMonths);
    const endDate = end.toISOString().split('T')[0];

    db.run(
        `UPDATE members SET start_date = ?, duration_months = ?, end_date = ? WHERE id = ?`,
        [startDate, durationMonths, endDate, id],
        function(err) {
            if (err) return res.status(500).json({ error: err.message });
            if (this.changes === 0) {
                return res.status(404).json({ error: 'Member not found' });
            }
            res.json({
                id: parseInt(id),
                startDate,
                durationMonths,
                endDate
            });
        }
    );
});

// API: Delete member
app.delete('/api/members/:id', (req, res) => {
    db.run('DELETE FROM members WHERE id = ?', req.params.id, function(err) {
        if (err) return res.status(500).json({ error: err.message });
        if (this.changes === 0) {
            return res.status(404).json({ error: 'Member not found' });
        }
        res.json({ message: 'Deleted successfully' });
    });
});

// API: Delete all members
app.delete('/api/members', (req, res) => {
    db.run('DELETE FROM members', function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ message: 'All members cleared' });
    });
});

// Create database table
db.run(`CREATE TABLE IF NOT EXISTS members (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    phone TEXT,
    start_date TEXT NOT NULL,
    duration_months INTEGER NOT NULL,
    end_date TEXT NOT NULL
)`, (err) => {
    if (err) {
        console.error('❌ Error creating table:', err.message);
    } else {
        console.log('✅ Database table ready');
    }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, '0.0.0.0', () => console.log(`🚀 Server running on http://localhost:${PORT}`));
