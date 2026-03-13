# IDL Timetable Management System

**Complete Technical & User Documentation** IDL-TIMETABLE [tools.idl.edu.pk]

| | |
|---|---|
| **Version** | 2.0 |
| **Date** | March 8, 2026 |
| **Author** | Aalyan Riasat |
| **Platform** | PHP · MySQL · HTML/JavaScript (SPA) · Node.js (WhatsApp) |
| **Prepared for** | Institute of Dynamic Learning — Internal Use |

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [System Architecture](#2-system-architecture)
3. [Technology Stack](#3-technology-stack)
4. [Database Design](#4-database-design)
5. [User Roles & Permissions](#5-user-roles--permissions)
6. [Authentication & Sessions](#6-authentication--sessions)
7. [Application Pages](#7-application-pages)
8. [REST API Reference](#8-rest-api-reference)
9. [Timetable Conflict Detection](#9-timetable-conflict-detection)
10. [WhatsApp Integration](#10-whatsapp-integration)
11. [Notifications & Audit System](#11-notifications--audit-system)
12. [Data Import](#12-data-import)
13. [Download & Export](#13-download--export)
14. [Security](#14-security)
15. [Frontend Architecture](#15-frontend-architecture)
16. [File Structure](#16-file-structure)
17. [Installation Guide](#17-installation-guide)
18. [Glossary](#18-glossary)

---

## 1. Project Overview

The IDL Timetable Management System is a web-based scheduling application for the Institute of Dynamic Learning. It allows administrators, supervisors, and authorized users to manage teachers, classes, and timetables through a single-page web interface.

### What It Solves

- **Scheduling conflicts** — Automatic detection prevents double-booking teachers or overlapping class slots.
- **Role-based access** — Each user sees only what they're permitted to access.
- **Real-time tracking** — Shows which teachers are busy or free at any given time.
- **WhatsApp messaging** — Send timetables and announcements directly to teachers via WhatsApp.
- **Audit trail** — Every action by non-superadmin users is logged and can be undone.

### Key Features

| Feature | Description |
|---------|-------------|
| Single-Page App (SPA) | All pages load inside one `index.html` — no full-page reloads |
| Dark Luxury UI | Navy/black background with gold (#C9A84C) accents, Cinzel + Times New Roman fonts |
| 4 User Roles | Super Admin, Admin, Supervisor, User — with granular permissions |
| Conflict Detection | Server-side overlap checks for both class slots and teacher assignments |
| Multi-Teacher Slots | A single lesson can have multiple co-teachers |
| Break Slots | Break periods inserted into timetables without teacher assignment |
| WhatsApp Integration | Send messages/files to teachers via local Baileys server or UltraMsg cloud |
| Bulk Messaging | Select multiple teachers and send in one operation with configurable delay |
| PDF/DOC Export | Every data table exports to PDF (A4 Portrait/Landscape) or Word document |
| CSV Import | Bulk import teachers, classes, and timetable data from CSV/Excel files |
| Audit Log + Undo | Superadmin can view all actions and reverse any change |
| Idle Auto-Logout | 8-hour server-side timeout + client-side visibility detection |
| Pakistan Time Display | Dashboard shows live PST (UTC+5) for upcoming classes |
| Responsive Design | Mobile-friendly with collapsible sidebar |

---

## 2. System Architecture

The system follows a three-tier architecture:

```
┌─────────────────────────────────────────────────────────┐
│  BROWSER (Presentation Tier)                            │
│  index.html — CSS + HTML + Vanilla JavaScript           │
│  ↕ Fetch API (JSON)          ↕ Fetch API (JSON)         │
├────────────────────────┬────────────────────────────────┤
│  PHP API (Application) │  Node.js Server (WhatsApp)     │
│  /api/*.php            │  wa-server/server.js            │
│  ↕ MySQLi              │  ↕ mysql2/promise               │
├────────────────────────┴────────────────────────────────┤
│  MySQL Database (Data Tier)                             │
│  Database: idltimetable                                  │
│  Tables: classes, teachers, timetable, users, settings,  │
│          notifications, superadmin_requests, wa_session   │
└─────────────────────────────────────────────────────────┘
```

### Request Flow

1. User opens `index.html` → login screen renders.
2. `doLogin()` sends `POST /api/auth.php?action=login` with credentials.
3. Server validates, sets PHP session, returns role/permissions as JSON.
4. JavaScript stores role in memory; shows appropriate sidebar and pages.
5. User navigates to a page → JavaScript calls the relevant API endpoint.
6. PHP checks session, queries DB, returns JSON.
7. JavaScript renders the response into HTML tables/cards.
8. For WhatsApp features, JavaScript calls the Node.js server directly (port 8080).

---

## 3. Technology Stack

| Layer | Technology | Details |
|-------|-----------|---------|
| Frontend | HTML5, CSS3, Vanilla JS (ES6+) | Single file SPA, no frameworks |
| Fonts | Cinzel, Libre Baskerville | Google Fonts CDN |
| Backend | PHP 8.x | MySQLi prepared statements |
| Database | MySQL / MariaDB | utf8mb4 charset |
| WhatsApp Server | Node.js + Express | Baileys library (WebSocket-based) |
| WhatsApp Sessions | MySQL | Stored in `wa_session` table |
| Password Hashing | bcrypt | PHP `password_hash()` |
| PDF Export | Browser print API | Custom print stylesheets |
| Excel Parsing | SheetJS (xlsx.full.min.js) | Client-side CSV/Excel import |

---

## 4. Database Design

**Database name:** `idltimetable`

### 4.1 Tables Overview

| Table | Purpose |
|-------|---------|
| `classes` | Class/group names |
| `teachers` | Teacher profiles (30+ fields) |
| `timetable` | Scheduled lesson and break slots |
| `users` | Login accounts with roles and permissions |
| `settings` | Key-value configuration (school hours, WhatsApp, AI) |
| `notifications` | Audit log of all CRUD actions |
| `superadmin_requests` | Workflow requests for superadmin review |
| `wa_session` | WhatsApp Baileys auth credentials per account |

### 4.2 Table: `classes`

| Column | Type | Description |
|--------|------|-------------|
| `id` | INT, PK, AUTO_INCREMENT | Unique class ID |
| `name` | VARCHAR(100), NOT NULL | Display name (e.g. "Level O Juniors") |
| `created_at` | TIMESTAMP | Row creation time |

### 4.3 Table: `teachers`

| Column | Type | Description |
|--------|------|-------------|
| `id` | INT, PK, AUTO_INCREMENT | Unique teacher ID |
| `title` | VARCHAR(10) | Sir, Mam, or Ms. |
| `name` | VARCHAR(100) | Full name |
| `designation` | VARCHAR | Job designation |
| `religion` | VARCHAR | Religion |
| `gender` | VARCHAR | Gender |
| `joining_date` | DATE | Date joined |
| `nic_number` | VARCHAR | National ID number |
| `employment_type` | VARCHAR | Permanent, Contract, etc. |
| `per_lecture_amount` | DECIMAL | Per-lecture payment rate |
| `role` | VARCHAR | Teacher, Vice Principal, etc. |
| `work_experience` | VARCHAR | Years/description |
| `qualification` | VARCHAR | Degree/certification |
| `marital_status` | VARCHAR | Marital status |
| `phone` | VARCHAR | Phone number |
| `whatsapp` | VARCHAR | WhatsApp number (used for bulk messaging) |
| `blood_group` | VARCHAR | Blood group |
| `email` | VARCHAR | Email address |
| `date_of_birth` | DATE | DOB |
| `place_of_birth` | VARCHAR | Birthplace |
| `address` | TEXT | Full address |
| `starting_salary` | DECIMAL | Starting salary |
| `current_salary` | DECIMAL | Current salary |
| `bank_account_no` | VARCHAR | Bank account number |
| `notes` | TEXT | Additional notes |
| `photo` | BLOB/path | Teacher photo |
| `cnic_front` | BLOB/path | CNIC front image |
| `cnic_back` | BLOB/path | CNIC back image |
| `relationship_name` | VARCHAR | Emergency contact name |
| `created_at` | TIMESTAMP | Row creation time |

### 4.4 Table: `timetable`

| Column | Type | Description |
|--------|------|-------------|
| `id` | INT, PK, AUTO_INCREMENT | Unique slot ID |
| `class_id` | INT, FK → classes.id | Which class this slot belongs to |
| `teacher_id` | INT | Primary teacher (0 for breaks) |
| `teacher_ids` | VARCHAR(500) | Comma-separated IDs for co-teaching slots |
| `day_group` | VARCHAR(50) | Preset label (e.g. "Mon–Tue", "Mon–Fri") |
| `days` | VARCHAR(100) | Comma-separated days (e.g. "Monday,Tuesday") |
| `start_time` | TIME | Lesson start (HH:MM) |
| `end_time` | TIME | Lesson end (HH:MM) |
| `subject` | VARCHAR(200) | Subject name (or "Break" if is_break=1) |
| `is_break` | TINYINT(1) | 1 = break slot, no teacher required |
| `created_at` | TIMESTAMP | Row creation time |

### 4.5 Table: `users`

| Column | Type | Description |
|--------|------|-------------|
| `id` | INT, PK, AUTO_INCREMENT | Unique user ID |
| `username` | VARCHAR(100), UNIQUE | Login username |
| `password` | VARCHAR(255) | bcrypt hash |
| `role` | ENUM | 'superadmin', 'admin', 'supervisor', 'user' |
| `teacher_ids_perm` | VARCHAR(500) | Teachers a "user" role can view |
| `class_ids_perm` | VARCHAR(500) | Classes a "user" role can view |
| `supervisor_teacher_ids` | VARCHAR(500) | Teachers a supervisor manages |
| `supervisor_class_ids` | VARCHAR(500) | Classes a supervisor manages |
| `supervisor_user_ids` | VARCHAR(500) | Users a supervisor can edit |
| `created_at` | TIMESTAMP | Account creation time |

### 4.6 Table: `settings`

| Column | Type | Description |
|--------|------|-------------|
| `key` | VARCHAR(50), PK | Setting name |
| `value` | LONGTEXT | Setting value |

**Standard keys:**

| Key | Default | Purpose |
|-----|---------|---------|
| `school_start` / `school_end` | 08:00 / 13:00 | Fallback school hours |
| `monday_start` / `monday_end` | 08:00 / 13:00 | Per-day override (empty = day off) |
| `tuesday_start` / `tuesday_end` | 08:00 / 13:00 | " |
| `wednesday_start`–`thursday_end` | 08:00 / 13:00 | " |
| `friday_start` / `friday_end` | 08:00 / 12:00 | Shortened Friday |
| `saturday_*` / `sunday_*` | (empty) | Non-school days |
| `wa_provider` | local | 'local' (Baileys) or 'ultramsg' |
| `wa_local_url` | http://localhost:8080 | Node.js server URL |
| `wa_instance` / `wa_api_key` | — | UltraMsg cloud credentials |
| `wa_delay_ms` | — | Delay between bulk messages |
| `openai_api_key` / `openai_model` | — | AI settings (reserved) |

### 4.7 Table: `notifications`

| Column | Type | Description |
|--------|------|-------------|
| `id` | INT, PK, AUTO_INCREMENT | Notification ID |
| `actor_username` | VARCHAR | Who performed the action |
| `actor_role` | VARCHAR | Their role |
| `action_type` | ENUM | 'add', 'edit', 'delete' |
| `entity_type` | ENUM | 'teacher', 'class', 'timetable', 'user' |
| `entity_id` | INT | ID of affected record |
| `entity_name` | VARCHAR | Human-readable label |
| `snapshot_data` | LONGTEXT (JSON) | Old row data for undo support |
| `created_at` | TIMESTAMP | When the action occurred |

### 4.8 Table: `superadmin_requests`

| Column | Type | Description |
|--------|------|-------------|
| `id` | INT, PK | Request ID |
| `teacher_id` | INT | Teacher the request concerns |
| `class_ids` | VARCHAR(500) | Comma-separated class IDs |
| `note` | VARCHAR(500) | Optional notes |
| `status` | ENUM | 'pending', 'approved', 'rejected' |
| `created_at` | TIMESTAMP | Request creation time |

### 4.9 Table: `wa_session`

| Column | Type | Description |
|--------|------|-------------|
| `id` | VARCHAR, PK | Composite key: `accountId:credType` |
| `data` | MEDIUMTEXT (JSON) | Encrypted Baileys auth state |
| `updated_at` | TIMESTAMP | Last update time |

---

## 5. User Roles & Permissions

Permissions are enforced both client-side (UI visibility) and server-side (API guards).

| Role | Code | Capabilities |
|------|------|-------------|
| **Super Admin** | `superadmin` | Full unrestricted access. Can create superadmin accounts. Can force-override teacher conflicts. Manages audit log and undo. |
| **Admin** | `admin` | Full CRUD on teachers, classes, timetable, users. Can configure settings and WhatsApp. Cannot override teacher conflicts. Cannot create superadmin accounts. |
| **Supervisor** | `supervisor` | Restricted admin — manages only assigned teachers, classes, and users. Can add/edit timetable slots for assigned classes. |
| **User** | `user` | Read-only. Views only assigned teachers and classes. Can search schedules and download PDFs. |

### Permission Fields

- **User role:** `teacher_ids_perm` and `class_ids_perm` control what data they can see.
- **Supervisor role:** `supervisor_teacher_ids`, `supervisor_class_ids`, and `supervisor_user_ids` define their management scope.
- Empty permission fields = no access to that resource type.

---

## 6. Authentication & Sessions

### Login Process

1. User submits username + password.
2. Server fetches user, runs `password_verify()` against bcrypt hash.
3. On success: `session_regenerate_id(true)`, stores user data in session.
4. Returns role + permissions as JSON; browser renders appropriate UI.

### Session Lifecycle

| Event | Behavior |
|-------|----------|
| Login | New session ID generated, `last_activity` set |
| API request | `last_activity` refreshed |
| Idle > 8 hours (server) | Session destroyed on next API call |
| Tab hidden > auto-detect (client) | Visibility-change triggers logout |
| Manual logout | Session destroyed immediately |

### Cookie Security

- `HttpOnly` — not accessible via JavaScript
- `SameSite=Strict` — blocks cross-site requests
- `Secure` — HTTPS-only when served over HTTPS

---

## 7. Application Pages

### 7.1 Login Screen

Centered card with IDL logo, username/password fields, and Sign In button. Shows error messages for invalid credentials.

### 7.2 Dashboard

- **Stats cards:** Total Teachers, Classes, Timetable Slots, System Users
- **Upcoming classes:** Live card showing next scheduled lessons for current Pakistan time (auto-refreshes)
- **Recent entries:** Last 10 timetable slots (admin/supervisor view)

### 7.3 Track Teachers

Real-time teacher availability view.

- **Day checkboxes** — filter by any day combination (Mon–Fri)
- **Time range pickers** — narrow the time window
- **Teacher filter dropdown** — view one or all teachers
- **Status badges:** 🟢 FREE, 🔴 BUSY, 🟡 UPCOMING
- **Free slot tooltip** — click the free icon on a teacher to see their available time gaps
- **Download** — export as PDF or DOC (A4 Portrait/Landscape)

### 7.4 Teachers Management

Full teacher profile management.

- **Table columns:** Title, Name, Designation, Phone, WhatsApp, Actions
- **Search:** Live filter by name
- **Add/Edit modal:** 30+ fields across categories:
  - Personal (Title, Name, DOB, Gender, Religion, Marital Status, Blood Group)
  - Professional (Designation, Role, Joining Date, Employment Type, Experience, Qualification)
  - Contact (Phone, WhatsApp, Email, Address)
  - Financial (Starting Salary, Current Salary, Per-Lecture Rate, Bank Account)
  - Documents (Photo upload with preview, CNIC Front/Back, Emergency Contact, Notes)
- **Draft auto-save** to localStorage
- **Bulk import** from CSV/Excel
- **Download** as PDF or DOC

### 7.5 Classes Management

- **Table columns:** Class Name, Date Added, Actions
- **Search:** Live filter by name
- **Add/Edit modal:** Single "Class Name" field
- **Bulk import** from CSV
- **Download** as PDF or DOC

### 7.6 Timetable Management

The core scheduling page.

- **Filters:** Class dropdown, Day checkboxes (Mon–Fri), Time range pickers
- **Table columns:** Class, Subject, Teacher(s), Days, Time, Actions
- **Add/Edit Slot modal:**
  - Class selector
  - Teacher(s) multi-select (supports co-teaching — hold Ctrl/Cmd)
  - Subject text input
  - Day preset buttons: Mon–Tue, Wed–Thu, Fri, Mon–Thu, Mon–Fri, Clear
  - Individual day toggles (Mon through Fri)
  - Start/End time pickers
  - Break checkbox — hides teacher/subject fields, sets subject to "Break"
- **Conflict detection:** Server checks both class-slot overlaps and teacher double-bookings (see [Section 9](#9-timetable-conflict-detection))
- **Download** as PDF or DOC (A4, with scale options)

### 7.7 Teacher Schedule Search

- **Searchable teacher dropdown** — select by name
- **Day filter** — Mon–Fri checkboxes
- **Time range** — from/to dropdowns
- **Results:** Class, Subject, Co-teachers, Days, Start/End Time
- **Free slot tooltip** — shows gaps where the teacher is available
- **Download** selected teacher's schedule as PDF/DOC
- Users (view-only role) can only search teachers in their `teacher_ids_perm` list

### 7.8 User-Role Views

When a "user" role logs in, they see simplified pages:

- **Classes:** Only classes assigned via `class_ids_perm`
- **Timetable:** Filtered to assigned classes, with day/class dropdowns and day checkboxes
- No add/edit/delete buttons — view and download only

### 7.9 Users Administration

Admin and Supervisor page for managing accounts.

- **Table columns:** Username, Role (color-coded badge), Access Level, Created Date, Actions
- **Search:** Filter by username or role
- **Add/Edit User modal:**
  - Username, Password (min 6 chars; blank on edit = keep existing)
  - Role selector (Superadmin option only visible to superadmins)
  - For "user" role: teacher/class permission checkboxes with search
  - For "supervisor" role: assign teachers, classes, and user accounts to manage
- **Restrictions:** Cannot delete own account; cannot delete superadmin unless you are superadmin

### 7.10 Settings

Admin-only configuration page.

- **School Hours:** Default start/end times + per-day overrides (Mon–Sun). Empty = day off.
- **Save:** Single button saves all values at once

### 7.11 Notifications (Superadmin Only)

- Activity feed showing all CRUD actions by non-superadmin users
- **Columns:** Actor, Role, Action, Entity, Timestamp
- **Actions:** Delete notification, **Undo** (reverses the change using stored snapshot)

### 7.12 Super Admin Requests

Workflow panel visible only to superadmins:

- Submit a request specifying a teacher and classes
- All requests listed with Pending/Approved/Rejected badges
- Superadmins can approve or reject pending requests
- Sidebar badge shows count of pending requests

---

## 8. REST API Reference

All endpoints are in `/api/`. All return `Content-Type: application/json`. HTTP status codes: 200, 201, 400, 401, 403, 404, 409, 500.

### 8.1 auth.php

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `?action=login` | No | Login. Body: `{username, password}` → returns role + permissions |
| POST | `?action=logout` | Yes | Destroy session |
| GET | `?action=check` | Optional | Returns `{authenticated, role, username, ...}` |

### 8.2 teachers.php

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/` or `?id=X` | Authenticated | List all or get one. Supervisors see only assigned |
| POST | `/` | Admin | Create. Body: `{title, name, ...30+ fields}` |
| PUT | `?id=X` | Admin/Supervisor | Update teacher |
| DELETE | `?id=X` | Admin/Supervisor | Delete teacher |

All mutations are logged to `notifications` table (except superadmin actions).

### 8.3 classes.php

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/` or `?id=X` | Authenticated | List all or get one |
| POST | `/` | Admin | Create. Body: `{name}` |
| PUT | `?id=X` | Admin/Supervisor | Update class name |
| DELETE | `?id=X` | Admin/Supervisor | Delete class |

### 8.4 timetable.php

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/` | Authenticated | All slots (supervisor-filtered) |
| GET | `?class_id=X` | Authenticated | Slots for a specific class |
| GET | `?teacher_id=X` | Authenticated | Non-break slots for a teacher |
| GET | `?id=X` | Authenticated | Single slot |
| POST | `/` | Admin/Supervisor | Create slot (see conflict detection) |
| PUT | `?id=X` | Admin/Supervisor | Update slot |
| DELETE | `?id=X` | Admin/Supervisor | Delete slot |

**Create/Update body:**
```json
{
  "class_id": 2,
  "teacher_ids": "5,12",
  "subject": "Mathematics",
  "day_group": "mon-fri",
  "days": "Monday,Tuesday,Wednesday,Thursday,Friday",
  "start_time": "09:00",
  "end_time": "09:45",
  "is_break": false,
  "force_overlap": false
}
```

### 8.5 users.php

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/` | Admin/Supervisor | List users (supervisors see only assigned) |
| POST | `/` | Admin | Create user |
| PUT | `?id=X` | Admin/Supervisor | Update user |
| DELETE | `?id=X` | Admin/Supervisor | Delete user |
| GET | `?action=sa_requests` | Superadmin | List all workflow requests |
| POST | `?action=sa_request` | Superadmin | Create request |
| PUT | `?action=sa_approve&id=X` | Superadmin | Approve request |
| PUT | `?action=sa_reject&id=X` | Superadmin | Reject request |

### 8.6 search.php

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `?teacher_id=X` | Authenticated | Returns `{teacher, slots[], count}`. Excludes break slots |

### 8.7 settings.php

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/` | Authenticated | All settings as key-value object |
| POST | `/` | Admin | Save school hours + daily overrides |
| POST | `?ai` | Superadmin | Save AI settings (openai_api_key, openai_model) |

### 8.8 notifications.php

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/` | Superadmin | List all audit notifications |
| DELETE | `?id=X` | Superadmin | Delete a notification |
| POST | `?id=X&action=undo` | Superadmin | Undo the action (restore from snapshot) |

### 8.9 import.php

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `?type=teachers` | Admin | Bulk import teachers from CSV rows |
| POST | `?type=classes` | Admin | Bulk import classes |
| POST | `?type=timetable` | Admin | Bulk import timetable slots (with conflict detection) |

### 8.10 whatsapp.php

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `?action=status` | Admin | Connection status (local provider) |
| GET | `?action=get_qr` | Admin | QR code as base64 image |
| POST | `action=send_message` | Admin | Send text to one number |
| POST | `action=send_file` | Admin | Send file via URL |
| POST | `action=send_file_upload` | Admin | Send base64-encoded file (local only) |
| POST | `action=bulk_send` | Admin | Send to multiple teachers |
| POST | `action=logout` | Admin | Disconnect WhatsApp session |

---

## 9. Timetable Conflict Detection

Two independent checks run on every CREATE and UPDATE:

### 9.1 Class Slot Overlap

Ensures no two entries for the same class overlap in time on the same day.

**Logic:**
1. Fetch all existing slots for `class_id`
2. Find overlapping days between new and existing entries
3. Check time intersection: `new_start < existing_end AND new_end > existing_start`
4. If conflict found → return **409** with details

**Class conflicts are always hard-blocked** — no override available, even for superadmins.

### 9.2 Teacher Double-Booking

Ensures no teacher is in two places at the same time.

**Logic:**
1. For each teacher ID in the incoming slot, fetch their existing slots
2. Uses both `teacher_id` field and `FIND_IN_SET` on `teacher_ids` for co-teaching
3. Same day overlap + time overlap check
4. If conflict found:
   - **Admin** → 409 hard block
   - **Superadmin** → warning returned; frontend shows "Add Anyway" dialog
   - Superadmin confirms → re-sends with `force_overlap: true` → server skips teacher check

**Edit safety:** During updates, the current slot's ID is excluded from conflict queries to prevent false positives.

---

## 10. WhatsApp Integration

The system supports two WhatsApp providers:

### 10.1 Local Provider (Baileys) — Free

A Node.js Express server (`wa-server/server.js`) that connects to WhatsApp via the Baileys library (pure WebSocket — no browser needed).

**Server endpoints:**

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/status?account=USER_ID` | GET | Connection status |
| `/qr?account=USER_ID` | GET | QR code as PNG data URL |
| `/send-message` | POST | Send text message |
| `/send-file` | POST | Send file from URL |
| `/send-file-upload` | POST | Send base64-encoded file |
| `/reset` | POST | Clear session, generate new QR |
| `/logout` | POST | Graceful logout |

**Key features:**
- **Per-user sessions:** Each user ID gets a separate WhatsApp connection. Multiple users can connect different WhatsApp numbers simultaneously.
- **MySQL session storage:** Auth credentials stored in `wa_session` table — survives server restarts.
- **Auto-reconnect:** Exponential backoff (1.3× multiplier, 15s max) with retry counter. Only clears session after 5 consecutive failures.
- **Health check:** 60-second interval ping when connected to detect stale connections.
- **MySQL keep-alive:** Connection pool with `enableKeepAlive: true` to prevent timeout disconnects.

**Frontend flow:**
1. User opens WhatsApp modal → frontend calls `/status` to check connection state.
2. If not connected and no stored credentials → shows QR code from `/qr` endpoint.
3. User scans QR with their phone → connection established.
4. If credentials exist but disconnected → shows "Resuming session…" with auto-reconnect.
5. Once connected → shows green "Connected" bar with phone number.

### 10.2 UltraMsg Provider (Cloud API) — Paid

Uses external UltraMsg cloud service:
- Configured via `wa_instance` and `wa_api_key` in settings
- Endpoints: `/messages/chat`, `/messages/document`
- Requires public file URLs (no direct upload)
- Managed through PHP proxy (`api/whatsapp.php`)

### 10.3 WhatsApp Modal Features

- **QR Code panel** — scan to connect (local provider only)
- **Connected status bar** — shows phone number and "Change Number" button
- **Message tab:**
  - Searchable teacher list with checkboxes for recipient selection
  - Message textarea
- **File tab:**
  - Drag-drop file upload zone
  - File info display
  - Caption textarea
- **Delay slider** — configurable ms between bulk messages
- **Progress bar** — visual feedback during bulk sending

---

## 11. Notifications & Audit System

Every CRUD action performed by non-superadmin users is automatically logged to the `notifications` table.

### What Gets Logged

- **Action types:** Add, Edit, Delete
- **Entity types:** Teacher, Class, Timetable, User
- **Snapshot:** Full JSON of the old row data (for undo capability)

### Undo Logic

Superadmins can reverse any logged action:

| Original Action | Undo Behavior |
|----------------|---------------|
| Add | Deletes the entity |
| Edit | Restores old field values from snapshot |
| Delete | Re-inserts the entity from snapshot |

---

## 12. Data Import

Admin users can bulk import data from CSV or Excel files.

### Supported Import Types

| Type | Expected Columns | Behavior |
|------|-----------------|----------|
| Teachers | title, name | Duplicates skipped |
| Classes | name | Duplicates skipped |
| Timetable | class, teacher(s), subject, days, start_time, end_time | Conflicts returned for manual resolution |

- **Client-side parsing** — uses SheetJS library (`xlsx.full.min.js`) to parse Excel/CSV in the browser
- **Conflict detection** — timetable imports check for overlaps before inserting
- **Force rows** — user can approve individual conflicting rows to insert anyway

---

## 13. Download & Export

Every data page has a download button with format options.

### Supported Formats

| Format | Method | Output |
|--------|--------|--------|
| PDF | Browser print dialog | Opens print-styled page in new window |
| DOC | Blob download | Microsoft Word-compatible HTML document |

### Pages with Download Support

| Page | Function | Content Exported |
|------|----------|-----------------|
| Track Teachers | `downloadTrackDoc()` | Teacher availability grid with status |
| Teachers | `downloadTableDoc()` | Teachers table |
| Classes | `downloadTableDoc()` | Classes table |
| Timetable | `downloadTimetableDoc()` | Full timetable for selected filters |
| Teacher Search | `downloadSearchDoc()` | Selected teacher's schedule |
| Teacher Availability | `downloadAvailabilityDoc()` | Individual teacher's free/busy schedule |
| User Classes | `downloadTableDoc()` | User's assigned classes |
| User Timetable | `downloadUserTimetableDoc()` | User's filtered timetable |

### Options

- **Page size:** A4
- **Orientation:** Portrait or Landscape
- **Scale:** 70%, 80%, 90% (default), 100%

---

## 14. Security

| Threat | Mitigation |
|--------|-----------|
| SQL Injection | All queries use MySQLi prepared statements with bound parameters |
| XSS | `X-XSS-Protection: 1; mode=block` header; careful DOM construction |
| CSRF | `SameSite=Strict` session cookie; same-origin CORS policy |
| Clickjacking | `X-Frame-Options: SAMEORIGIN` header |
| Password Theft | bcrypt hashing via `password_hash()`; raw passwords never stored |
| Session Hijacking | `session_regenerate_id(true)` on login; HttpOnly + Secure + SameSite cookies |
| Privilege Escalation | Server-side role checks on every API call; superadmin role assignable only by superadmin |
| Content Sniffing | `X-Content-Type-Options: nosniff` header |
| Stray Output | `ob_start()` / `ob_end_clean()` before JSON responses to prevent PHP warning leakage |

---

## 15. Frontend Architecture

The entire frontend is a single `index.html` file (~5,400 lines) with embedded CSS, HTML, and JavaScript. No build tools or frameworks.

### Structure

| Section | Lines (approx.) | Content |
|---------|-----------------|---------|
| CSS | 1–560 | Styles, variables, responsive media queries |
| HTML | 560–1800 | Login, sidebar, all pages, modals |
| JavaScript | 1800–5475 | API calls, state management, UI logic |

### SPA Routing

`showPage(name)` toggles visibility. Each page is a `<div class="page">` — only the active one is displayed.

### Design System

| Variable | Value | Usage |
|----------|-------|-------|
| `--bg` | `#05050e` | Page background |
| `--surface` | `#080818` | Cards/modals |
| `--accent` | `#c9a84c` | Gold brand color |
| `--text` | `#ffffff` | Primary text |
| `--text-muted` | `#9090b8` | Secondary text |
| `--danger` | `#ff5555` | Delete/error actions |
| `--success` | `#44cc88` | Success states |

### Responsive Breakpoints

| Breakpoint | Behavior |
|-----------|----------|
| ≤ 768px | Hamburger sidebar, action buttons wrap to grid, full-width filters, smaller QR code |
| ≤ 400px | Single-column buttons, reduced padding, smaller fonts, narrower timetable grid |

### Key Components

- **Searchable Select** — `makeSearchable()` transforms any `<select>` into a custom dropdown with live typed filtering and multi-select support
- **Toast Notifications** — `toast(msg, type)` shows auto-dismissing messages (success/error)
- **Modal System** — Full-screen overlays with centered cards, managed via `closeModal()`/open functions
- **Free Slot Tooltip** — Click-lockable tooltip showing teacher's available time gaps

---

## 16. File Structure

```
idl_updated/
├── index.html                        ← Main SPA (CSS + HTML + JavaScript)
├── idltimetable.sql                  ← Database schema + seed data
├── package.json                      ← Root package metadata
├── README.md                         ← Project readme
├── IDL_Timetable_System_Documentation.docx  ← This documentation (Word)
│
├── includes/
│   └── config.php                    ← DB connection, session management,
│                                       auth helpers, CORS, notification logging
│
├── api/
│   ├── auth.php                      ← Login / logout / session check
│   ├── teachers.php                  ← Teacher CRUD + audit logging
│   ├── classes.php                   ← Class CRUD + audit logging
│   ├── timetable.php                 ← Timetable CRUD + conflict detection
│   ├── users.php                     ← User CRUD + superadmin requests
│   ├── search.php                    ← Teacher schedule lookup
│   ├── settings.php                  ← School hours + WA + AI config
│   ├── notifications.php             ← Audit log + undo (superadmin)
│   ├── import.php                    ← Bulk CSV/Excel import
│   ├── whatsapp.php                  ← WhatsApp messaging proxy
│   ├── whatsapp_proxy.php            ← CORS proxy for Node.js server
│   └── ai.php                        ← AI endpoints (reserved)
│
├── assets/
│   └── xlsx.full.min.js              ← SheetJS library for Excel parsing
│
└── wa-server/
    ├── server.js                     ← WhatsApp Baileys server (Node.js)
    ├── package.json                  ← Node.js dependencies
    ├── start.ps1                     ← PowerShell start script
    └── wa_session/                   ← Local session files (backup)
```

---

## 17. Installation Guide

### Prerequisites

- PHP 8.x with MySQLi extension
- MySQL 5.7+ / MariaDB 10.3+
- Apache (XAMPP, WAMP, Laragon, or any LAMP stack)
- Node.js 18+ (for WhatsApp server)

### Step 1 — Database

1. Open phpMyAdmin or MySQL CLI
2. Create database: `CREATE DATABASE idltimetable;`
3. Import `idltimetable.sql` into the database

### Step 2 — PHP Configuration

Edit `includes/config.php`:
```php
define('DB_HOST', 'localhost');
define('DB_USER', 'root');
define('DB_PASS', '');
define('DB_NAME', 'idltimetable');
```

### Step 3 — Web Server

Place the project folder in your web server root:
- **XAMPP:** `C:/xampp/htdocs/idl_updated/`
- **WAMP:** `C:/wamp64/www/idl_updated/`

Visit: `http://localhost/idl_updated/`

### Step 4 — WhatsApp Server (Optional)

```bash
cd wa-server
npm install
node server.js
```

Server starts on `http://localhost:8080`.

Make sure `WA_NODE` in `index.html` matches:
```javascript
const WA_NODE = 'http://localhost:8080';
```

### Step 5 — First Login

Log in with the superadmin account from the SQL dump. Then:
1. Change the default password immediately
2. Create dedicated accounts for staff
3. Configure school hours in Settings

---

## 18. Glossary

| Term | Definition |
|------|-----------|
| **SPA** | Single-Page Application — loads one HTML page and updates dynamically |
| **CRUD** | Create, Read, Update, Delete — the four basic data operations |
| **Baileys** | Open-source WhatsApp Web library using WebSocket (no browser) |
| **Timetable Slot** | One scheduled session: class + teacher(s) + subject + days + time range |
| **Break Slot** | Timetable entry with `is_break=1` — rest period, no teacher assigned |
| **Co-teaching** | Multiple teachers assigned to a single slot via `teacher_ids` |
| **Day Group** | Preset label for common day combinations (Mon–Tue, Mon–Fri, etc.) |
| **Conflict** | Two slots overlapping in time and day for the same class or teacher |
| **Force Conflict** | Superadmin override to insert a slot despite teacher double-booking |
| **Supervisor** | Restricted admin role managing only an assigned subset of data |
| **PST** | Pakistan Standard Time (UTC+5) |
| **bcrypt** | Password hashing algorithm (PHP `PASSWORD_DEFAULT`) |

---

*IDL Timetable Management System — Version 2.0 — March 8, 2026*
*Prepared by Aalyan Riasat · Institute of Dynamic Learning · Confidential*
