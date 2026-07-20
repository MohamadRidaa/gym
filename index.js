 const express = require('express');
const cors = require('cors');
const path = require('path');
const pool = require('./db');

const app = express();
app.use(cors());
app.use(express.json());

// Serve frontend from "public" folder
app.use(express.static(path.join(__dirname, 'public')));

// Get all members
app.get('/api/members', async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT id, name, phone, 
                    to_char(start_date, 'YYYY-MM-DD') AS "startDate",
                    duration_months AS "durationMonths",
                    to_char(end_date, 'YYYY-MM-DD') AS "endDate"
             FROM members ORDER BY id DESC`
        );
        res.json(result.rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Database error' });
    }
});

// Add new member
app.post('/api/members', async (req, res) => {
    const { name, phone, startDate, durationMonths } = req.body;
    if (!name || !startDate || !durationMonths) {
        return res.status(400).json({ error: 'Missing required fields' });
    }

    const start = new Date(startDate);
    const end = new Date(start);
    end.setMonth(end.getMonth() + durationMonths);
    const endDate = end.toISOString().split('T')[0];

    try {
        const result = await pool.query(
            `INSERT INTO members (name, phone, start_date, duration_months, end_date)
             VALUES ($1, $2, $3, $4, $5)
             RETURNING id, name, phone, 
                       to_char(start_date, 'YYYY-MM-DD') AS "startDate",
                       duration_months AS "durationMonths",
                       to_char(end_date, 'YYYY-MM-DD') AS "endDate"`,
            [name, phone || null, startDate, durationMonths, endDate]
        );
        res.status(201).json(result.rows[0]);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Database error' });
    }
});

// Renew membership
app.put('/api/members/:id', async (req, res) => {
    const { id } = req.params;
    const { startDate, durationMonths } = req.body;
    if (!startDate || !durationMonths) {
        return res.status(400).json({ error: 'Missing required fields' });
    }

    const start = new Date(startDate);
    const end = new Date(start);
    end.setMonth(end.getMonth() + durationMonths);
    const endDate = end.toISOString().split('T')[0];

    try {
        const result = await pool.query(
            `UPDATE members 
             SET start_date = $1, duration_months = $2, end_date = $3
             WHERE id = $4
             RETURNING id, name, phone, 
                       to_char(start_date, 'YYYY-MM-DD') AS "startDate",
                       duration_months AS "durationMonths",
                       to_char(end_date, 'YYYY-MM-DD') AS "endDate"`,
            [startDate, durationMonths, endDate, id]
        );
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Member not found' });
        }
        res.json(result.rows[0]);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Database error' });
    }
});

// Delete member
app.delete('/api/members/:id', async (req, res) => {
    const { id } = req.params;
    try {
        const result = await pool.query('DELETE FROM members WHERE id = $1 RETURNING id', [id]);
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Member not found' });
        }
        res.json({ message: 'Deleted successfully' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Database error' });
    }
});

// Delete all members
app.delete('/api/members', async (req, res) => {
    try {
        await pool.query('DELETE FROM members');
        res.json({ message: 'All members cleared' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Database error' });
    }
});

// Create table if it doesn't exist
const createTable = async () => {
    try {
        await pool.query(`
            CREATE TABLE IF NOT EXISTS members (
                id SERIAL PRIMARY KEY,
                name VARCHAR(255) NOT NULL,
                phone VARCHAR(50),
                start_date DATE NOT NULL,
                duration_months INTEGER NOT NULL,
                end_date DATE NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);
        console.log('✅ Database table ready');
    } catch (err) {
        console.error('Error creating table:', err);
    }
};
createTable();

const PORT = process.env.PORT || 5000;
app.listen(PORT, '0.0.0.0', () => console.log(`🚀 Server running on http://localhost:${PORT}`));
