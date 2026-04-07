// ===== GLOBAL STATE & API CONFIG =====
var currentUser = null;
var _awayTimer = null;
var _idleTimer = null;
var _notifPollInterval = null;
var schoolSettings = {};
var teachers = [];
var classes = [];
var _notificationsCache = [];
var _notifLastSeenId = 0;

const API = {
  auth:               'api/auth.php',
  teachers:           'api/teachers.php',
  classes:            'api/classes.php',
  timetable:          'api/timetable.php',
  settings:           'api/settings.php',
  users:              'api/users.php',
  search:             'api/search.php',
  students:           'api/students.php',
  subjects:           'api/subjects.php',
  parents:            'api/parents.php',
  subjectEnrollments: 'api/subject_enrollments.php',
  performanceTests:   'api/performance_tests.php',
  performanceMarks:   'api/performance_marks.php',
  testStudents:       'api/test_students.php',
  attendance:         'api/attendance.php',
};

async function api(url, method = 'GET', body = null) {
  const opts = { method, credentials: 'include', headers: {} };
  if (body !== null) {
    opts.headers['Content-Type'] = 'application/json';
    opts.body = JSON.stringify(body);
  }
  const res = await fetch(url, opts);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.error || `HTTP ${res.status}`);
    err._raw = data;
    throw err;
  }
  return data;
}

var timetableSlots = [];
