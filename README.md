
# Gym Management System

A web-based application for managing gym members, tracking memberships, and monitoring expiration dates.

## Features

- Administrator login using server-side sessions
- Add and manage gym members
- Dashboard showing active, expired, and total memberships
- Track memberships expiring soon
- View members whose membership starts today
- Renew memberships and view membership history
- Archive and restore members
- Search and filter members
- Protected REST API for member management

## Tech Stack

- **Frontend:** HTML, CSS, JavaScript
- **Backend:** Node.js, Express.js
- **Database:** PostgreSQL
- **Authentication:** bcryptjs, express-session
- **Deployment:** Render

## Getting Started

### 1. Clone the repository

```bash
git clone https://github.com/MohamadRidaa/gym.git
cd gym
```

### 2. Install dependencies

```bash
npm install
```

### 3. Configure environment variables

Copy `.env.example` to a new file named `.env`.

Replace the placeholder values with your own PostgreSQL connection string, administrator username, bcrypt password hash, and session secret.

Never commit your real `.env` file.

### 4. Start the application

```bash
npm start
```

Open http://localhost:5000 in your browser.

## Live Application

[Open Gym Manager](https://gym-manager-8myf.onrender.com)

The live application requires administrator authentication. Login credentials are not publicly provided.

## Future Improvements

- Persistent session storage
- Additional input validation
- Automated tests