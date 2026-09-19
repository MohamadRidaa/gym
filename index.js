require('dotenv').config();

const express = require('express');
const cors = require('cors');
const path = require('path');
const bcrypt = require('bcryptjs');
const session = require('express-session');
const pool = require('./db');

const app = express();

app.set('trust proxy', 1);

app.use(cors());
app.use(express.json());

app.use(session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 1000 * 60 * 60 * 8
    }
}));

function requireAuth(req, res, next) {
    if (!req.session.user) {
        return res.status(401).json({ message: 'Unauthorized' });
    }

    next();
}

app.post('/api/login', async (req, res) => {
    const { username, password } = req.body;

    if (!username || !password) {
        return res.status(400).json({
            message: 'Username and password are required'
        });
    }

    if (username !== process.env.ADMIN_USERNAME) {
        return res.status(401).json({
            message: 'Invalid credentials'
        });
    }

    try {
        const validPassword = await bcrypt.compare(
            password,
            process.env.ADMIN_PASSWORD_HASH
        );

        if (!validPassword) {
            return res.status(401).json({
                message: 'Invalid credentials'
            });
        }

        req.session.user = { username };

        res.json({
            message: 'Login successful'
        });

    } catch (err) {
        console.error('Login error:', err);

        res.status(500).json({
            message: 'Server error'
        });
    }
});

app.post('/api/logout', (req, res) => {
    req.session.destroy(err => {
        if (err) {
            return res.status(500).json({
                message: 'Could not log out'
            });
        }

        res.clearCookie('connect.sid');

        res.json({
            message: 'Logged out successfully'
        });
    });
});

app.get('/api/session', (req, res) => {
    if (!req.session.user) {
        return res.status(401).json({
            loggedIn: false
        });
    }

    res.json({
        loggedIn: true,
        user: req.session.user.username
    });
});

app.get('/', (req, res) => {
    if (!req.session.user) {
        return res.redirect('/login.html');
    }

    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/index.html', (req, res) => {
    if (!req.session.user) {
        return res.redirect('/login.html');
    }

    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.use(express.static(path.join(__dirname, 'public'), {
    index: false
}));

app.get('/api/members', requireAuth, async (req, res) => {
    const { archived } = req.query;

    let query = `
        SELECT
            id,
            name,
            phone,
            to_char(start_date, 'YYYY-MM-DD') AS "startDate",
            duration_months AS "durationMonths",
            to_char(end_date, 'YYYY-MM-DD') AS "endDate"
        FROM members
    `;

    if (archived === 'true') {
        query += ' WHERE archived = true';
    } else {
        query += ' WHERE archived = false OR archived IS NULL';
    }

    query += ' ORDER BY id DESC';

    try {
        const result = await pool.query(query);
        res.json(result.rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Database error' });
    }
});

// ----- Check phone existence (including archived) -----
app.get('/api/members/check-phone/:phone', requireAuth, async (req, res) => {
    const { phone } = req.params;
    try {
        const result = await pool.query(
            'SELECT id, name, archived FROM members WHERE phone = $1',
            [phone]
        );
        if (result.rows.length === 0) {
            res.json({ exists: false });
        } else {
            const member = result.rows[0];
            res.json({
                exists: true,
                id: member.id,
                name: member.name,
                archived: member.archived
            });
        }
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Database error' });
    }
});

// ----- Get membership history for a member -----
app.get('/api/members/:id/history', requireAuth, async (req, res) => {
    const { id } = req.params;
    try {
        const result = await pool.query(
            `SELECT id, start_date, end_date, duration_months, renewed_at 
             FROM membership_history 
             WHERE member_id = $1 
             ORDER BY renewed_at DESC`,
            [id]
        );
        res.json(result.rows.map(r => ({
            id: r.id,
            startDate: r.start_date,
            endDate: r.end_date,
            durationMonths: r.duration_months,
            renewedAt: r.renewed_at
        })));
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Database error' });
    }
});

// ----- Add new member (with history) -----
app.post('/api/members', requireAuth, async (req, res) => {
    const { name, phone, startDate, durationMonths } = req.body;
    if (!name || !startDate || !durationMonths) {
        return res.status(400).json({ error: 'Missing required fields' });
    }

    const start = new Date(startDate);
    const end = new Date(start);
    end.setMonth(end.getMonth() + durationMonths);
    const endDate = end.toISOString().split('T')[0];

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        const memberResult = await client.query(
            `INSERT INTO members (name, phone, start_date, duration_months, end_date, archived)
             VALUES ($1, $2, $3, $4, $5, false)
             RETURNING id, name, phone, 
                       to_char(start_date, 'YYYY-MM-DD') AS "startDate",
                       duration_months AS "durationMonths",
                       to_char(end_date, 'YYYY-MM-DD') AS "endDate"`,
            [name, phone || null, startDate, durationMonths, endDate]
        );
        const newMember = memberResult.rows[0];

        await client.query(
            `INSERT INTO membership_history (member_id, start_date, end_date, duration_months)
             VALUES ($1, $2, $3, $4)`,
            [newMember.id, startDate, endDate, durationMonths]
        );

        await client.query('COMMIT');
        res.status(201).json(newMember);
    } catch (err) {
        await client.query('ROLLBACK');
        console.error(err);
        res.status(500).json({ error: 'Database error' });
    } finally {
        client.release();
    }
});

// ----- Renew membership (updates member + adds history) -----
app.put('/api/members/:id', requireAuth, async (req, res) => {
    const { id } = req.params;
    const { startDate, durationMonths } = req.body;
    if (!startDate || !durationMonths) {
        return res.status(400).json({ error: 'Missing required fields' });
    }

    const start = new Date(startDate);
    const end = new Date(start);
    end.setMonth(end.getMonth() + durationMonths);
    const endDate = end.toISOString().split('T')[0];

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        const updateResult = await client.query(
            `UPDATE members 
             SET start_date = $1, duration_months = $2, end_date = $3
             WHERE id = $4 AND archived = false
             RETURNING id, name, phone, 
                       to_char(start_date, 'YYYY-MM-DD') AS "startDate",
                       duration_months AS "durationMonths",
                       to_char(end_date, 'YYYY-MM-DD') AS "endDate"`,
            [startDate, durationMonths, endDate, id]
        );
        if (updateResult.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: 'Member not found or archived' });
        }

        await client.query(
            `INSERT INTO membership_history (member_id, start_date, end_date, duration_months)
             VALUES ($1, $2, $3, $4)`,
            [id, startDate, endDate, durationMonths]
        );

        await client.query('COMMIT');
        res.json(updateResult.rows[0]);
    } catch (err) {
        await client.query('ROLLBACK');
        console.error(err);
        res.status(500).json({ error: 'Database error' });
    } finally {
        client.release();
    }
});

// ----- Soft delete (archive) -----
app.delete('/api/members/:id', requireAuth, async (req, res) => {
    const { id } = req.params;
    try {
        const result = await pool.query(
            'UPDATE members SET archived = true WHERE id = $1 RETURNING id',
            [id]
        );
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Member not found' });
        }
        res.json({ message: 'Member archived' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Database error' });
    }
});

// ----- Restore archived member -----
app.put('/api/members/:id/restore', requireAuth, async (req, res) => {
    const { id } = req.params;
    try {
        const result = await pool.query(
            'UPDATE members SET archived = false WHERE id = $1 RETURNING id, name, phone',
            [id]
        );
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Member not found' });
        }
        res.json({ message: 'Member restored', member: result.rows[0] });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Database error' });
    }
});

// ----- Permanently delete an archived member -----
app.delete('/api/members/:id/permanent', requireAuth, async (req, res) => {
    const { id } = req.params;

    try {
        const result = await pool.query(
            `DELETE FROM members
             WHERE id = $1 AND archived = true
             RETURNING id`,
            [id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                message: 'Archived member not found'
            });
        }

        res.json({
            message: 'Member permanently deleted'
        });

    } catch (err) {
        console.error('Permanent delete error:', err);

        res.status(500).json({
            message: 'Could not delete member'
        });
    }
});
// ----- Delete all (hard delete) -----
app.delete('/api/members', requireAuth, async (req, res) => {
    try {
        await pool.query('DELETE FROM members');
        res.json({ message: 'All members cleared' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Database error' });
    }
});

// ----- Create tables -----
const createTables = async () => {
    try {
        await pool.query(`
            CREATE TABLE IF NOT EXISTS members (
                id SERIAL PRIMARY KEY,
                name VARCHAR(255) NOT NULL,
                phone VARCHAR(50),
                start_date DATE NOT NULL,
                duration_months INTEGER NOT NULL,
                end_date DATE NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                archived BOOLEAN DEFAULT FALSE
            );
            DO $$
            BEGIN
                IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                               WHERE table_name='members' AND column_name='archived') THEN
                    ALTER TABLE members ADD COLUMN archived BOOLEAN DEFAULT FALSE;
                END IF;
            END $$;
        `);
        await pool.query(`
            CREATE TABLE IF NOT EXISTS membership_history (
                id SERIAL PRIMARY KEY,
                member_id INTEGER REFERENCES members(id) ON DELETE CASCADE,
                start_date DATE NOT NULL,
                end_date DATE NOT NULL,
                duration_months INTEGER NOT NULL,
                renewed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);
        console.log('✅ Database tables ready');
    } catch (err) {
        console.error('Error creating tables:', err);
    }
};
createTables();

const PORT = process.env.PORT || 5000;
app.listen(PORT, '0.0.0.0', () => console.log(`🚀 Server running on http://localhost:${PORT}`));

