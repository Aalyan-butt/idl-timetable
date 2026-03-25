# IDL Institute — Timetable Management System

### System Documentation

---

## Table of Contents

1. [System Overview](#1-system-overview)
2. [Technology Stack](#2-technology-stack)
3. [Project Structure](#3-project-structure)
4. [Database Schema](#4-database-schema)
5. [User Roles &amp; Permissions](#5-user-roles--permissions)
6. [API Reference](#6-api-reference)
7. [Frontend Architecture](#7-frontend-architecture)
8. [Page Modules](#8-page-modules)
9. [Build System](#9-build-system)
10. [WhatsApp Integration](#10-whatsapp-integration)
11. [Setup &amp; Deployment](#11-setup--deployment)
12. [Default Credentials](#12-default-credentials)

---

## 1. System Overview

IDL Timetable Management System is a web-based single-page application (SPA) for managing a school's timetable, staff, students, and academic records. It supports multiple user roles with fine-grained permission control, real-time conflict detection, bulk import/export, WhatsApp notifications, AI assistant integration, and a full student performance tracking module.

**Key capabilities:**

- Timetable scheduling with teacher conflict detection and class slot overlap prevention
- Comprehensive teacher and student HR/academic records
- Student registration workflow with document uploads
- Subject enrollment and class assignment
- Performance tests, marks entry, and analysis
- Parent portal with family schedule view
- WhatsApp bulk messaging (free local server or paid UltraMsg API)
- AI assistant (OpenAI) for timetable import formatting
- Activity log with undo support (superadmin)
- Role-based UI — each role sees only its relevant sections
- Hash-based URL routing with browser back/forward support
- Lazy-loaded page modules for fast initial load

---

## 2. Technology Stack

| Layer           | Technology                                    |
| --------------- | --------------------------------------------- |
| Frontend        | Vanilla JavaScript (ES2020+), HTML5, CSS3     |
| Backend         | PHP 7.4+                                      |
| Database        | MySQL 5.7+ / MariaDB                          |
| Server          | Apache / Nginx (XAMPP, WAMP, Laragon)         |
| Build Tool      | Node.js — Terser (JS minification), CleanCSS |
| WhatsApp (free) | Node.js + whatsapp-web.js                     |
| WhatsApp (paid) | UltraMsg REST API                             |
| AI              | OpenAI API (configurable model)               |
| Excel Import    | SheetJS (xlsx)                                |

---

## 3. Project Structure

```
idl_updated/
│
├── index.html                  # App shell (login screen + navigation + dashboard)
│
├── pages/                      # Lazy-loaded page fragments (fetched on first visit)
│   ├── track.html
│   ├── teachers.html
│   ├── classes.html
│   ├── timetable.html
│   ├── search.html
│   ├── user-classes.html
│   ├── users.html
│   ├── settings.html
│   ├── notifications.html
│   ├── students.html
│   ├── student-notifications.html
│   ├── class-enrollment.html
│   ├── class-subjects.html         # Includes subject-modal-overlay
│   ├── subject-enrollment.html     # Includes se-enroll & se-edit modal overlays
│   ├── parent-information.html     # Includes parent-modal-overlay
│   ├── student-profile.html
│   ├── student-schedule.html
│   ├── parent-schedule.html
│   ├── performance-tests.html
│   ├── performance-marks.html
│   └── performance-analysis.html
│
├── js/                         # Source JavaScript (bundled at build time)
│   ├── config.js               # API endpoints & global state variables
│   ├── session.js              # Session persistence, idle timeout
│   ├── utils.js                # Shared utilities, generic filterTable(), makeSearchable()
│   ├── auth.js                 # Login/logout, role UI rendering, page restore
│   ├── navigation.js           # showPage() routing, hash routing, all data loaders
│   ├── settings.js             # School hours & settings page
│   ├── teachers.js             # Teacher CRUD UI
│   ├── whatsapp.js             # WhatsApp messaging UI
│   ├── classes.js              # Class management UI
│   ├── timetable.js            # Timetable builder, conflict UI
│   ├── search.js               # Teacher schedule search, free slot tooltip
│   ├── users.js                # User account management
│   ├── notifications.js        # Activity log & undo UI (superadmin)
│   ├── students.js             # Student registration, list, profile
│   ├── subjects.js             # Subject management per class
│   ├── enrollments.js          # Subject enrollment UI
│   ├── parents.js              # Parent/family management
│   ├── import-export.js        # Bulk import from Excel/CSV, export
│   └── performance.js          # Performance tests, marks, analysis
│
├── css/                        # Source stylesheets (bundled at build time)
│   ├── variables.css           # CSS custom properties (colors, radius, shadows)
│   ├── base.css                # Reset, typography, buttons, alerts, toasts
│   ├── login.css               # Login screen
│   ├── layout.css              # App shell, sidebar, navbar, page grid
│   ├── components.css          # Cards, tables, badges, modals, searchable select
│   ├── timetable.css           # Timetable grid specific styles
│   ├── search.css              # Search results
│   ├── students.css            # Student list and form
│   └── responsive.css          # Mobile / tablet breakpoints
│
├── api/                        # PHP REST endpoints
│   ├── auth.php
│   ├── teachers.php
│   ├── classes.php
│   ├── timetable.php
│   ├── students.php
│   ├── subjects.php
│   ├── subject_enrollments.php
│   ├── parents.php
│   ├── users.php
│   ├── settings.php
│   ├── search.php
│   ├── import.php
│   ├── notifications.php
│   ├── whatsapp.php
│   ├── ai.php
│   └── performance_tests.php
│
├── includes/
│   └── config.php              # DB connection, session, auth helpers, security headers
│
├── assets/                     # Static files (images, icons etc.)
│
├── wa-server/                  # Node.js WhatsApp local server
│   ├── server.js
│   ├── package.json
│   └── wa_session/             # Persisted WhatsApp session data
│
├── build.js                    # Production build script
├── package.json                # Node.js dependencies (Terser, CleanCSS)
├── idltimetable.sql            # Full database schema + seed data
│
└── dist/                       # Production output (upload this to server)
    ├── index.html
    ├── pages/
    ├── assets/
    │   ├── app.min.js
    │   └── app.min.css
    ├── api/
    ├── includes/
    └── idltimetable.sql
```

---

## 4. Database Schema

**Database name:** `idltimetable`
**Charset:** `utf8mb4`

### users

| Column                 | Type                  | Notes                                                |
| ---------------------- | --------------------- | ---------------------------------------------------- |
| id                     | INT AUTO_INCREMENT PK |                                                      |
| username               | VARCHAR               | Unique                                               |
| password               | VARCHAR               | Hashed                                               |
| role                   | ENUM                  | admin, user, superadmin, supervisor, student, parent |
| teacher_ids_perm       | TEXT                  | CSV — teacher IDs this user can view (user role)    |
| class_ids_perm         | TEXT                  | CSV — class IDs this user can view (user role)      |
| supervisor_teacher_ids | TEXT                  | CSV — teachers this supervisor manages              |
| supervisor_class_ids   | TEXT                  | CSV — classes this supervisor manages               |
| supervisor_user_ids    | TEXT                  | CSV — user accounts this supervisor manages         |
| student_id             | INT                   | Linked student record (student role)                 |
| teacher_id             | INT                   | Linked teacher record                                |
| parent_id              | INT                   | Linked parent record (parent role)                   |
| student_ids            | TEXT                  | CSV — all children's IDs (parent role)              |
| created_at             | TIMESTAMP             |                                                      |

### teachers

| Column             | Type                  | Notes                            |
| ------------------ | --------------------- | -------------------------------- |
| id                 | INT AUTO_INCREMENT PK |                                  |
| title              | ENUM                  | Sir, Mam, Ms.                    |
| name               | VARCHAR               |                                  |
| designation        | VARCHAR               |                                  |
| religion           | VARCHAR               |                                  |
| gender             | VARCHAR               |                                  |
| joining_date       | DATE                  |                                  |
| nic_number         | VARCHAR               |                                  |
| employment_type    | VARCHAR               |                                  |
| per_lecture_amount | DECIMAL               |                                  |
| role               | VARCHAR               |                                  |
| work_experience    | TEXT                  |                                  |
| qualification      | TEXT                  |                                  |
| marital_status     | VARCHAR               |                                  |
| phone              | VARCHAR               |                                  |
| whatsapp           | VARCHAR               | Preferred for WhatsApp messaging |
| blood_group        | VARCHAR               |                                  |
| email              | VARCHAR               |                                  |
| date_of_birth      | DATE                  |                                  |
| place_of_birth     | VARCHAR               |                                  |
| address            | TEXT                  |                                  |
| starting_salary    | DECIMAL               |                                  |
| current_salary     | DECIMAL               |                                  |
| bank_name          | VARCHAR               |                                  |
| bank_account_type  | ENUM                  | account, iban                    |
| bank_account_no    | VARCHAR               |                                  |
| notes              | TEXT                  |                                  |
| photo              | LONGTEXT              | Base64 data URI or file path     |
| cnic_front         | LONGTEXT              |                                  |
| cnic_back          | LONGTEXT              |                                  |
| relationship_name  | VARCHAR               |                                  |
| leaving_date       | DATE                  |                                  |
| leaving_reason     | TEXT                  |                                  |
| created_at         | TIMESTAMP             |                                  |

### students

| Column               | Type                  | Notes                                                 |
| -------------------- | --------------------- | ----------------------------------------------------- |
| id                   | INT AUTO_INCREMENT PK |                                                       |
| sr_number            | VARCHAR               | Auto-generated sequential                             |
| gr_number            | VARCHAR               | Auto-generated sequential                             |
| student_name         | VARCHAR               |                                                       |
| class_id             | INT                   | FK → classes                                         |
| date_of_birth        | DATE                  |                                                       |
| gender               | VARCHAR               |                                                       |
| religion             | VARCHAR               |                                                       |
| caste                | VARCHAR               |                                                       |
| place_of_birth       | VARCHAR               |                                                       |
| nationality          | VARCHAR               |                                                       |
| nic_passport         | VARCHAR               |                                                       |
| b_form               | VARCHAR               |                                                       |
| blood_group          | VARCHAR               |                                                       |
| physical_handicap    | VARCHAR               |                                                       |
| photo                | LONGTEXT              |                                                       |
| student_mobile       | VARCHAR               |                                                       |
| mother_phone         | VARCHAR               |                                                       |
| mother_name          | VARCHAR               |                                                       |
| mother_profession    | VARCHAR               |                                                       |
| mother_nic           | VARCHAR               |                                                       |
| guardian_phone       | VARCHAR               |                                                       |
| emergency_contact    | VARCHAR               |                                                       |
| student_address      | TEXT                  |                                                       |
| student_city         | VARCHAR               |                                                       |
| father_name          | VARCHAR               |                                                       |
| father_cnic          | VARCHAR               | Used to group siblings and auto-create parent records |
| father_phone         | VARCHAR               |                                                       |
| father_occupation    | VARCHAR               |                                                       |
| father_designation   | VARCHAR               |                                                       |
| father_email         | VARCHAR               |                                                       |
| father_address       | TEXT                  |                                                       |
| father_relationship  | VARCHAR               |                                                       |
| fee_1/2/3/4_type     | VARCHAR               |                                                       |
| fee_1/2/3/4_amount   | DECIMAL               |                                                       |
| test_date            | DATE                  | Admission test                                        |
| test_for_class       | VARCHAR               |                                                       |
| total_test_marks     | INT                   |                                                       |
| total_obtained_marks | INT                   |                                                       |
| registration_status  | ENUM                  | pending, confirmed, rejected                          |
| document1/2/3        | LONGTEXT              | Uploaded documents                                    |
| created_at           | TIMESTAMP             |                                                       |

### classes

| Column     | Type                  | Notes  |
| ---------- | --------------------- | ------ |
| id         | INT AUTO_INCREMENT PK |        |
| name       | VARCHAR               | Unique |
| created_at | TIMESTAMP             |        |

### timetable

| Column      | Type                  | Notes                                          |
| ----------- | --------------------- | ---------------------------------------------- |
| id          | INT AUTO_INCREMENT PK |                                                |
| class_id    | INT                   | FK → classes                                  |
| teacher_id  | INT                   | Primary teacher FK → teachers                 |
| teacher_ids | VARCHAR               | CSV — all teachers (for multi-teacher slots)  |
| day_group   | VARCHAR               | Preset label (Mon-Fri, Mon-Thu, etc.)          |
| days        | VARCHAR               | CSV — Monday,Tuesday,…                       |
| start_time  | TIME                  |                                                |
| end_time    | TIME                  |                                                |
| subject     | VARCHAR               |                                                |
| is_break    | TINYINT               | 1 = break slot (excluded from conflict checks) |
| created_at  | TIMESTAMP             |                                                |

### parents

| Column      | Type                  | Notes                                  |
| ----------- | --------------------- | -------------------------------------- |
| id          | INT AUTO_INCREMENT PK |                                        |
| student_id  | INT                   | FK → students (first child)           |
| parent_name | VARCHAR               | From father_name                       |
| cnic        | VARCHAR               | Unique — father_cnic                  |
| phone       | VARCHAR               |                                        |
| photo       | LONGTEXT              |                                        |
| email       | VARCHAR               |                                        |
| whatsapp    | VARCHAR               |                                        |
| address     | TEXT                  |                                        |
| profession  | VARCHAR               |                                        |
| gender      | VARCHAR               |                                        |
| notes       | TEXT                  |                                        |
| doc1 / doc2 | LONGTEXT              |                                        |
| family_code | VARCHAR               | Auto-assigned unique family identifier |

### class_subjects

| Column       | Type                  | Notes                            |
| ------------ | --------------------- | -------------------------------- |
| id           | INT AUTO_INCREMENT PK |                                  |
| class_id     | INT                   | FK → classes                    |
| subject_name | VARCHAR               |                                  |
| created_at   | TIMESTAMP             | Unique: (class_id, subject_name) |

### subject_enrollments

| Column      | Type                  | Notes                            |
| ----------- | --------------------- | -------------------------------- |
| id          | INT AUTO_INCREMENT PK |                                  |
| subject_id  | INT                   | FK → class_subjects             |
| student_id  | INT                   | FK → students                   |
| enrolled_at | TIMESTAMP             | Unique: (subject_id, student_id) |

### performance_tests

| Column               | Type                  | Notes                          |
| -------------------- | --------------------- | ------------------------------ |
| id                   | INT AUTO_INCREMENT PK |                                |
| test_name            | VARCHAR               | Required                       |
| test_date            | DATE                  |                                |
| marks_entry_deadline | DATE                  |                                |
| total_marks          | DECIMAL               |                                |
| class_id             | INT                   | FK → classes                  |
| subject_id           | INT                   | FK → class_subjects           |
| teacher_id           | INT                   | FK → teachers                 |
| notify_teacher       | TINYINT               | 1 = WhatsApp notification sent |
| coverage_details     | TEXT                  |                                |
| status               | ENUM                  | Empty, Incomplete, Done        |

### settings

| Column | Type       | Notes              |
| ------ | ---------- | ------------------ |
| key    | VARCHAR PK | Setting identifier |
| value  | TEXT       |                    |

**Common setting keys:** `school_start`, `school_end`, `monday_start` … `sunday_end`, `wa_provider`, `wa_local_url`, `wa_api_url`, `wa_instance`, `wa_api_key`, `wa_delay_ms`, `openai_api_key`, `openai_model`

### notifications

| Column         | Type                  | Notes                                |
| -------------- | --------------------- | ------------------------------------ |
| id             | INT AUTO_INCREMENT PK |                                      |
| actor_username | VARCHAR               | Who performed the action             |
| actor_role     | VARCHAR               |                                      |
| action_type    | ENUM                  | add, edit, delete                    |
| entity_type    | VARCHAR               | teacher, class, timetable, user      |
| entity_id      | INT                   |                                      |
| entity_name    | VARCHAR               | Human-readable label                 |
| snapshot_data  | JSON                  | Full record before change (for undo) |
| created_at     | TIMESTAMP             |                                      |

### student_comments

| Column          | Type                  | Notes          |
| --------------- | --------------------- | -------------- |
| id              | INT AUTO_INCREMENT PK |                |
| student_id      | INT                   | FK → students |
| comment         | TEXT                  |                |
| author_username | VARCHAR               |                |
| author_role     | VARCHAR               |                |
| created_at      | TIMESTAMP             |                |

### superadmin_requests

| Column     | Type                  | Notes                       |
| ---------- | --------------------- | --------------------------- |
| id         | INT AUTO_INCREMENT PK |                             |
| teacher_id | INT                   |                             |
| class_ids  | TEXT                  |                             |
| note       | TEXT                  |                             |
| status     | ENUM                  | pending, approved, rejected |
| created_at | TIMESTAMP             |                             |

---

## 5. User Roles & Permissions

| Role                 | Level   | Key Capabilities                                                                                                |
| -------------------- | ------- | --------------------------------------------------------------------------------------------------------------- |
| **superadmin** | Highest | Everything below + notifications/undo, AI settings, WhatsApp config, manage all users including admins          |
| **admin**      | High    | Manage teachers, classes, timetable, students, parents, subjects, enrollments, users (non-superadmin), settings |
| **supervisor** | Medium  | Manage only assigned teachers/classes/users (scoped by CSV permission fields)                                   |
| **user**       | Low     | View-only: see assigned teachers/classes and their timetable                                                    |
| **student**    | Portal  | View own class schedule and upcoming lessons                                                                    |
| **parent**     | Portal  | View schedules of all linked children                                                                           |

### CSS Visibility Classes

Apply to HTML elements to automatically show/hide by role:

| Class                    | Visible To                    |
| ------------------------ | ----------------------------- |
| `.admin-only`          | admin, superadmin             |
| `.superadmin-only`     | superadmin only               |
| `.admin-or-supervisor` | admin, superadmin, supervisor |
| `.supervisor-only`     | supervisor only               |
| `.user-only`           | user (viewer) role            |
| `.student-only`        | student role                  |
| `.parent-only`         | parent role                   |

### Permission Fields (supervisor / user roles)

| Field                      | Used By    | Effect                               |
| -------------------------- | ---------- | ------------------------------------ |
| `teacher_ids_perm`       | user       | Can view only listed teachers        |
| `class_ids_perm`         | user       | Can view only listed classes         |
| `supervisor_teacher_ids` | supervisor | Can manage only listed teachers      |
| `supervisor_class_ids`   | supervisor | Can manage only listed classes       |
| `supervisor_user_ids`    | supervisor | Can manage only listed user accounts |

---

## 6. API Reference

All endpoints require an active PHP session unless stated otherwise. Request and response format is JSON.

### `api/auth.php`

| Method | Query              | Auth        | Description                                                                                         |
| ------ | ------------------ | ----------- | --------------------------------------------------------------------------------------------------- |
| POST   | `?action=login`  | None        | Login. Body:`{username, password}`. Returns full user object with role and all permission fields. |
| POST   | `?action=logout` | requireAuth | Terminate session                                                                                   |
| GET    | `?action=check`  | None        | Returns `{authenticated, user}` or `{authenticated: false}`. Also resets idle timer.            |

Session timeout: 8 hours server-side, 60 minutes client-side idle timer.

---

### `api/teachers.php`

| Method | Query     | Auth                      | Description                                    |
| ------ | --------- | ------------------------- | ---------------------------------------------- |
| GET    | —        | requireAuth               | List all teachers (supervisors: assigned only) |
| GET    | `?id=X` | requireAuth               | Single teacher with all fields                 |
| POST   | —        | requireAdmin              | Create teacher                                 |
| PUT    | `?id=X` | requireAdmin / supervisor | Update teacher (supervisors: assigned only)    |
| DELETE | `?id=X` | requireAdmin / supervisor | Delete teacher                                 |

---

### `api/classes.php`

| Method | Query     | Auth                      | Description                                   |
| ------ | --------- | ------------------------- | --------------------------------------------- |
| GET    | —        | requireAuth               | List all classes (supervisors: assigned only) |
| POST   | —        | requireAdmin              | Create class                                  |
| PUT    | `?id=X` | requireAdmin / supervisor | Update class                                  |
| DELETE | `?id=X` | requireAdmin / supervisor | Delete class                                  |

Changes are logged to `notifications` table for undo support.

---

### `api/timetable.php`

| Method | Query             | Auth               | Description                            |
| ------ | ----------------- | ------------------ | -------------------------------------- |
| GET    | —                | requireAuth        | All slots (supervisors: assigned only) |
| GET    | `?id=X`         | requireAuth        | Single slot                            |
| GET    | `?class_id=X`   | requireAuth        | All slots for a class                  |
| GET    | `?teacher_id=X` | requireAuth        | All non-break slots for a teacher      |
| POST   | —                | admin / supervisor | Create slot                            |
| PUT    | `?id=X`         | admin / supervisor | Update slot                            |
| DELETE | `?id=X`         | admin / supervisor | Delete slot                            |

**Conflict detection:**

- **Class overlap** — prevents two slots for the same class overlapping on the same day
- **Teacher conflict** — prevents a teacher being double-booked (checks `teacher_id` and all IDs in `teacher_ids` CSV)
- Admins: receive 409 with `conflicts[]`, may force with `force_conflict: true` / `force_overlap: true`
- Supervisors: receive 403 on conflict, cannot force

---

### `api/students.php`

| Method | Query / Action                    | Auth           | Description                              |
| ------ | --------------------------------- | -------------- | ---------------------------------------- |
| GET    | —                                | requireAuth    | List all students                        |
| GET    | `?id=X`                         | requireAuth    | Single student                           |
| GET    | `?action=my_schedule`           | student/parent | Own or children's schedule               |
| GET    | `?action=my_children`           | parent         | All linked children                      |
| GET    | `?action=siblings&cnic=X`       | requireAuth    | Students sharing father_cnic             |
| GET    | `?action=next_gr`               | requireAdmin   | Preview next GR# and SR#                 |
| GET    | `?action=comments&student_id=X` | requireAdmin   | Student comments                         |
| POST   | —                                | requireAdmin   | Create student (auto-generates GR#, SR#) |
| POST   | `?action=confirm&id=X`          | requireAdmin   | Confirm registration                     |
| POST   | `?action=comments`              | requireAdmin   | Add comment                              |
| PUT    | `?id=X`                         | requireAdmin   | Update student                           |
| DELETE | `?id=X`                         | requireAdmin   | Delete student                           |
| DELETE | `?action=comments&id=X`         | requireAdmin   | Delete comment                           |

---

### `api/users.php`

| Method | Query / Action          | Auth                     | Description                             |
| ------ | ----------------------- | ------------------------ | --------------------------------------- |
| GET    | —                      | requireAdminOrSupervisor | List users (supervisors: assigned only) |
| GET    | `?action=sa_requests` | requireSuperAdmin        | Pending superadmin requests             |
| POST   | —                      | requireAdminOrSupervisor | Create user                             |
| POST   | `?action=sa_request`  | requireSuperAdmin        | Submit request                          |
| PUT    | `?id=X`               | requireAdminOrSupervisor | Update user                             |
| PUT    | `?action=sa_approve`  | requireSuperAdmin        | Approve request                         |
| PUT    | `?action=sa_reject`   | requireSuperAdmin        | Reject request                          |
| DELETE | `?id=X`               | requireAdminOrSupervisor | Delete user (cannot delete self)        |

---

### `api/subjects.php`

| Method | Query           | Auth         | Description                                                  |
| ------ | --------------- | ------------ | ------------------------------------------------------------ |
| GET    | `?class_id=X` | requireAdmin | List subjects for class (auto-seeds from timetable subjects) |
| POST   | —              | requireAdmin | Create subject                                               |
| PUT    | `?id=X`       | requireAdmin | Rename subject                                               |
| DELETE | `?id=X`       | requireAdmin | Delete subject                                               |

---

### `api/subject_enrollments.php`

| Method | Query                       | Auth         | Description                                    |
| ------ | --------------------------- | ------------ | ---------------------------------------------- |
| GET    | `?action=all_subjects`    | requireAdmin | All class_subjects with class names            |
| GET    | `?action=all_enrollments` | requireAdmin | All enrollments with student + subject details |
| GET    | `?subject_id=X`           | requireAdmin | Enrollments for a subject                      |
| GET    | `?student_id=X`           | requireAdmin | Enrollments for a student                      |
| POST   | —                          | requireAdmin | Enroll student in subject                      |
| PUT    | `?id=X`                   | requireAdmin | Update enrollment                              |
| DELETE | `?id=X`                   | requireAdmin | Remove enrollment                              |

---

### `api/parents.php`

| Method | Query            | Auth         | Description                                              |
| ------ | ---------------- | ------------ | -------------------------------------------------------- |
| GET    | —               | requireAdmin | All parent families grouped by CNIC with children array  |
| POST   | `?action=seed` | requireAdmin | Auto-create parent records from student father_cnic data |
| POST   | —               | requireAdmin | Create parent                                            |
| PUT    | `?id=X`        | requireAdmin | Update parent                                            |
| DELETE | `?id=X`        | requireAdmin | Delete parent                                            |

---

### `api/settings.php`

| Method | Query   | Auth              | Description                                     |
| ------ | ------- | ----------------- | ----------------------------------------------- |
| GET    | —      | requireAuth       | All settings as key-value map                   |
| POST   | —      | requireAdmin      | Save school hours and per-day overrides         |
| POST   | `?ai` | requireSuperAdmin | Save AI settings (openai_api_key, openai_model) |

---

### `api/search.php`

| Method | Query             | Auth        | Description                                  |
| ------ | ----------------- | ----------- | -------------------------------------------- |
| GET    | `?teacher_id=X` | requireAuth | Teacher info + all non-break timetable slots |

---

### `api/import.php`

| Method | Query               | Auth         | Description                                                |
| ------ | ------------------- | ------------ | ---------------------------------------------------------- |
| POST   | `?type=teachers`  | requireAdmin | Bulk import teachers. Detects duplicates by name+title.    |
| POST   | `?type=classes`   | requireAdmin | Bulk import classes. Detects duplicates.                   |
| POST   | `?type=timetable` | requireAdmin | Bulk import slots with conflict detection + force override |

Returns: `{inserted, skipped, errors[], conflicts[]}`

---

### `api/notifications.php`

| Method | Query                 | Auth              | Description                        |
| ------ | --------------------- | ----------------- | ---------------------------------- |
| GET    | —                    | requireSuperAdmin | All activity notifications         |
| DELETE | `?id=X`             | requireSuperAdmin | Remove one notification            |
| POST   | `?action=undo`      | requireSuperAdmin | Reverse action using snapshot_data |
| POST   | `?action=clear_all` | requireSuperAdmin | Delete all notifications           |

---

### `api/whatsapp.php`

| Method | Body `action`      | Provider | Description                               |
| ------ | -------------------- | -------- | ----------------------------------------- |
| POST   | `status`           | local    | Connection status                         |
| POST   | `get_qr`           | local    | QR code for pairing                       |
| POST   | `logout`           | local    | Disconnect number                         |
| POST   | `send_message`     | both     | Single text message                       |
| POST   | `send_file`        | both     | File via URL                              |
| POST   | `send_file_upload` | local    | Uploaded file (base64)                    |
| POST   | `bulk_send`        | both     | Multiple teachers with configurable delay |

Phone normalization: uses `whatsapp` field first, falls back to `phone`. Auto-converts to `+92` E.164 format.

---

### `api/ai.php`

| Method | Auth              | Description                                                                                                                                                       |
| ------ | ----------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| POST   | requireSuperAdmin | Chat with OpenAI. System prompt includes teacher list, class list, timetable. Supports 12-turn history. Detects `TIMETABLE_IMPORT_DATA` marker for auto-import. |

---

### `api/performance_tests.php`

| Method | Query     | Auth         | Description                                                 |
| ------ | --------- | ------------ | ----------------------------------------------------------- |
| GET    | —        | requireAuth  | List all performance tests with class/subject/teacher names |
| GET    | `?id=X` | requireAuth  | Single test                                                 |
| POST   | —        | requireAdmin | Create test                                                 |
| PUT    | `?id=X` | requireAdmin | Update test                                                 |
| DELETE | `?id=X` | requireAdmin | Delete test                                                 |

---

## 7. Frontend Architecture

### Single-Page Application

`index.html` is the only HTML file served. All navigation is client-side with no page reloads.

### Lazy Page Loading

Pages are fetched on demand the first time they are visited:

1. `index.html` contains the app shell: login screen, navigation sidebar, and the **dashboard** (pre-loaded for instant first paint)
2. All other 21 pages are empty stub elements: `<div class="page" id="page-NAME"></div>`
3. When `showPage('teachers')` is first called, it fetches `pages/teachers.html`, injects the HTML into the stub, and calls `initAllSelects()`
4. Once fetched, the page stays in the DOM — subsequent visits never re-fetch

**Result:** Initial HTML reduced from ~214 KB to ~116 KB (46% reduction).

### Hash-Based URL Routing

The active page is always reflected in the URL:

- Navigating to Teachers → URL: `index.html#teachers`
- Refresh → hash is read and that page is restored
- Browser back/forward → `hashchange` event fires and switches to the correct page
- Sharing a URL → user lands on the correct page after login

### Session & Page Restore on Refresh

1. PHP session checked via `api/auth.php?action=check`
2. If valid, `showApp(false)` runs
3. Reads `window.location.hash` first, falls back to `localStorage.idl_last_page`
4. Students/parents are restricted to their own pages only
5. Page element existence is verified by `document.getElementById('page-' + name)` — no hardcoded page list needed

### Session Idle Timeout

- **Client:** 60 minutes tracking mousemove, mousedown, keydown, touchstart, scroll, click
- **Server:** 8-hour timeout
- **Tab hidden:** separate countdown starts when tab loses focus
- On expiry: session cleared, login shown with expiry message

### Searchable Select (`makeSearchable`)

All `<select>` elements in modals are enhanced with a custom searchable dropdown:

- Native `<select>` hidden (`display:none`); custom `.ss-wrapper > .ss-display + .ss-dropdown` created
- Typing in the search box filters options in real-time
- Dispatches `change` event on the native select (compatible with `onchange` attributes)
- `wrapper._ssRefresh()` — call after programmatically setting a value to sync the UI
- `initAllSelects()` — called after modal open and after lazy page injection

### Generic Table Filter (`filterTable`)

Defined in `utils.js`. All per-page filter functions delegate here:

```javascript
filterTable(searchId, tbodyId, emptyLabel, colspan, perPageId, countLabelId)
```

- Filters rows by search term
- Supports per-page pagination with count label (`X records` / `Showing Y of X`)
- Shows empty state row when no results match
- Named wrappers (`filterTeachers()`, `filterClasses()`, etc.) preserve existing HTML `oninput=""` attributes

### Global State

| Variable                  | Purpose                                                              |
| ------------------------- | -------------------------------------------------------------------- |
| `currentUser`           | Logged-in user with role and all permission fields                   |
| `schoolSettings`        | School hours and per-day overrides                                   |
| `teachers[]`            | Cached teacher list (loaded at app start)                            |
| `classes[]`             | Cached class list (loaded at app start)                              |
| `timetableSlots[]`      | Cached timetable (used for auto-select teacher in Performance Tests) |
| `_notificationsCache[]` | Notification list (superadmin only, polled every 60s)                |

---

## 8. Page Modules

### Dashboard

Stats cards (teachers, classes, timetable entries, students), next scheduled class, recent timetable entries. Students see today's upcoming classes. Parents see all children's today schedule.

### Track

Day/time tracker: shows which teachers are currently teaching, free, or have upcoming classes. Filterable by day and time range.

### Teachers

Full CRUD with photo, CNIC front/back, bank details, salary. WhatsApp messaging per teacher. CSV import. Supervisor access scoped to assigned teachers.

### Classes

Simple CRUD — class name only. Deletion cascades to timetable slots and subjects.

### Timetable

Slot builder with day preset buttons (Mon-Fri, Mon-Thu, Wed-Thu, Fri, All Days, custom). Conflict detection with visual warning. Admin can force conflicts; supervisors cannot.

### Search

Search teacher schedules by name. Free slot tooltip shows available time windows per day (click to pin).

### Users

Create/edit viewer, supervisor, student, parent accounts. Assign teacher/class permissions via checkbox lists. Superadmin can manage admin accounts. Cannot delete own account.

### User Classes

Assign which classes a viewer-role user can see.

### Settings

School start/end times with per-day overrides (e.g. Friday ends at 12:00). AI API key and model. WhatsApp provider selection and credentials.

### Students

Full registration form: personal info, family (father/mother details), fee structure (4 fee types), admission test results, documents. Auto-generates GR# and SR#. Status workflow: pending → confirmed / rejected. Sibling detection by father CNIC. Admin comments per student.

### Class Enrollment

Bulk-assign students to classes.

### Class Subjects

Manage the subject catalogue for each class. Auto-seeded from timetable subject names.

### Subject Enrollment

Enroll individual students into specific subjects.

### Parents / Family Information

Auto-seed parent records from student father CNIC data. Family groups show all siblings. Edit contact details and documents per parent.

### Student Profile

Full read-only view of a student's complete record.

### Student Schedule

Student-facing view of their class timetable.

### Parent Schedule

Parent-facing view of all children's timetables.

### Notifications *(superadmin only)*

Activity log of all add/edit/delete actions. One-click undo using stored JSON snapshots. Clear all option.

### Performance Tests

Create and manage academic assessments:

- Test name, date, deadline, total marks, class, subject, teacher, status
- Status lifecycle: Empty → Incomplete → Done
- Search bar + filters (status, class, subject, teacher, date range)
- Auto-selects teacher from timetable when class + subject are chosen
- Subject dropdown blocked (with error) if class not selected first

### Performance Marks

Mark entry for created performance tests.

### Performance Analysis

Analytics and reporting on student performance data.

---

## 9. Build System

Run the production build with:

```bash
node build.js
```

**Steps:**

1. Concatenates all CSS → minifies with CleanCSS (level 2) → `dist/assets/app.min.css`
2. Concatenates all JS → minifies with Terser (2 passes, mangle on) → `dist/assets/app.min.js`
3. Patches `index.html`: replaces individual `<link>`/`<script>` tags with single bundled files (cache-busting `?v=timestamp`) → `dist/index.html`
4. Copies `api/`, `includes/`, `assets/`, `pages/`, `idltimetable.sql` → `dist/`

**Bundle sizes (approximate):**

| Asset      | Raw     | Minified |
| ---------- | ------- | -------- |
| JavaScript | ~428 KB | ~321 KB  |
| CSS        | ~41 KB  | ~33 KB   |
| HTML       | ~116 KB | —       |

**Install build dependencies:**

```bash
npm install    # installs terser and clean-css
```

**JS bundle order (must match):**

```
config.js → session.js → utils.js → auth.js → navigation.js →
settings.js → teachers.js → whatsapp.js → classes.js → timetable.js →
search.js → users.js → notifications.js → students.js → subjects.js →
enrollments.js → parents.js → import-export.js → performance.js
```

> **Adding a new page:** (1) Add a `<div class="page" id="page-NAME"></div>` stub in `index.html`. (2) Create `pages/NAME.html` with the page content. (3) Add a `if (name === 'NAME') loadNAME();` line in `showPage()` in `navigation.js`. No changes needed to `auth.js` — it checks DOM existence automatically.

> **Adding a new JS file:** Add it to `JS_FILES` in `build.js` at the correct position.

---

## 10. WhatsApp Integration

### Two Providers

| Provider                          | Cost     | Requirements                          |
| --------------------------------- | -------- | ------------------------------------- |
| **Local** (whatsapp-web.js) | Free     | Node.js running on same server as PHP |
| **UltraMsg**                | Paid API | Cloud-based, no local server needed   |

### Local Server Setup

```bash
cd wa-server
npm install          # first run downloads Chromium (~150 MB)
node server.js       # starts HTTP server on port 3000
```

In app Settings → WhatsApp:

- Provider: `local`
- Local Server URL: `http://localhost:3000`

Scan the QR code in Settings to pair your phone. Session saved in `wa-server/wa_session/` and persists across restarts.

**Keep running in production:**

```bash
npm install -g pm2
pm2 start wa-server/server.js --name whatsapp
pm2 save
```

### UltraMsg Setup

In Settings → WhatsApp:

- Provider: `ultramsg`
- API URL: `https://api.ultramsg.com`
- Instance ID: your UltraMsg instance ID
- API Key: your UltraMsg token

### Local Server Endpoints

| Endpoint              | Method | Description                            |
| --------------------- | ------ | -------------------------------------- |
| `/status`           | GET    | Connection status                      |
| `/qr`               | GET    | QR code PNG for phone pairing          |
| `/send-message`     | POST   | `{phone, message}`                   |
| `/send-file`        | POST   | `{phone, url, filename, caption}`    |
| `/send-file-upload` | POST   | `{phone, base64, filename, caption}` |
| `/logout`           | POST   | Disconnect number                      |

### Bulk Messaging

Set `wa_delay_ms` in Settings (default 1000 ms) to control the delay between messages when bulk-sending to multiple teachers.

---

## 11. Setup & Deployment

### Requirements

- PHP 7.4+ with MySQLi extension
- MySQL 5.7+ or MariaDB 10.3+
- Apache or Nginx (XAMPP / WAMP / Laragon / Linux)
- Node.js 18+ (for build tool and optional WhatsApp server)

### Development Setup

1. **Place files in web server root:**

   ```
   XAMPP: C:/xampp/htdocs/idl_updated/
   WAMP:  C:/wamp64/www/idl_updated/
   Linux: /var/www/html/idl_updated/
   ```
2. **Create database:**

   ```sql
   source idltimetable.sql
   ```

   Or import `idltimetable.sql` via phpMyAdmin.
3. **Configure database** in `includes/config.php`:

   ```php
   define('DB_HOST', 'localhost');
   define('DB_USER', 'root');
   define('DB_PASS', '');
   define('DB_NAME', 'idltimetable');
   ```
4. **Open the app:**

   ```
   http://localhost/idl_updated/
   ```

### Production Deployment

1. Build:

   ```bash
   npm install
   node build.js
   ```
2. Upload the entire `dist/` folder to your web server.
3. Import `dist/idltimetable.sql` on the production database.
4. Update `dist/includes/config.php` with production credentials.
5. Ensure the PHP session directory is writable.
6. (If using local WhatsApp) Start the wa-server on the same machine.

### PHP Upload Limits

`includes/config.php` sets these automatically at runtime:

```
upload_max_filesize = 64M
post_max_size = 64M
```

If the server's `php.ini` enforces lower limits, add to `.htaccess`:

```apache
php_value upload_max_filesize 64M
php_value post_max_size 64M
```

---

## 12. Default Credentials

| Username       | Password     | Role                                              |
| -------------- | ------------ | ------------------------------------------------- |
| `superadmin` | `admin123` | Super Admin — full access + notifications + undo |
| `admin`      | `admin123` | Admin — manage all data                          |

> **Change these passwords immediately after first login.**

To create additional users, log in as admin/superadmin and navigate to the **Users** page.

---

*Documentation reflects the current state of IDL Timetable System — March 2026.*
