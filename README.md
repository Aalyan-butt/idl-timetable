# IDL Institute Timetable Management System

## Project Structure
```
idl/
├── index.html              ← Main frontend (single page app)
├── database.sql            ← Run this to set up the database
├── includes/
│   └── config.php          ← DB connection & auth helpers
└── api/
    ├── auth.php            ← Login / logout / session check
    ├── teachers.php        ← Teacher CRUD
    ├── classes.php         ← Class CRUD
    ├── timetable.php       ← Timetable CRUD + conflict detection
    └── users.php           ← User management (admin only)
```

## Setup Instructions

### 1. Requirements
- PHP 7.4+ with MySQLi extension
- MySQL 5.7+ / MariaDB
- Apache / Nginx web server (XAMPP, WAMP, Laragon etc.)

### 2. Database Setup
```sql
-- Run this in phpMyAdmin or MySQL CLI:
source database.sql
```
Or import `database.sql` via phpMyAdmin.

### 3. Configure Database
Edit `includes/config.php`:
```php
define('DB_HOST', 'localhost');
define('DB_USER', 'your_db_user');
define('DB_PASS', 'your_db_password');
define('DB_NAME', 'idl_timetable');
```

### 4. Web Server
Place the `idl/` folder in your web server root:
- XAMPP: `C:/xampp/htdocs/idl/`
- WAMP: `C:/wamp64/www/idl/`
- Linux: `/var/www/html/idl/`

Visit: `http://localhost/idl/`

## Default Login Credentials

| Username | Password | Role |
|----------|----------|------|
| admin    | password | Admin (full access) |
| viewer   | password | User (view only) |

**Important:** Change passwords after first login!

## Features

### Admin Account
- Add / Edit / Delete teachers (Sir/Mam title)
- Add / Edit / Delete classes
- Create timetable slots with day selection
- Conflict detection (same teacher, same time, different class)
- Track which teachers are busy/free in real-time
- Search teacher schedules and free slots
- Create / manage user accounts

### User Account (View Only)
- View teachers list
- View classes list
- View timetable
- Track teacher status
- Search teacher schedules

### Timetable Features
- Day presets: Mon-Tue, Wed-Thu, Fri, Mon-Thu, Mon-Fri, All Days
- Custom day selection (any combination)
- Conflict detection with class name mention
- Teacher tracking by day + time

## API Endpoints

| Method | URL | Description |
|--------|-----|-------------|
| POST   | api/auth.php?action=login | Login |
| POST   | api/auth.php?action=logout | Logout |
| GET    | api/auth.php?action=check | Check session |
| GET/POST/PUT/DELETE | api/teachers.php | Teacher CRUD |
| GET/POST/PUT/DELETE | api/classes.php | Class CRUD |
| GET/POST/PUT/DELETE | api/timetable.php | Timetable CRUD |
| GET/POST/PUT/DELETE | api/users.php | User management |
