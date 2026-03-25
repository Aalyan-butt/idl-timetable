/**
 * IDL Timetable — Production Build Script
 *
 * What it does:
 *  1. Concatenates all CSS files → minifies → writes assets/app.min.css
 *  2. Concatenates all JS files (in correct order) → minifies → writes assets/app.min.js
 *  3. Reads index.html, replaces the individual <link> and <script> tags
 *     with the single bundled files → writes dist/index.html
 *  4. Copies everything else (api/, includes/, assets/) into dist/ untouched
 *
 * Usage:
 *   node build.js
 *
 * Output: dist/ folder — upload this to your server for production.
 * Dev files (css/, js/, index.html) are never touched.
 */

const fs   = require('fs');
const path = require('path');

const { minify: minifyJS }  = require('terser');
const CleanCSS              = require('clean-css');

// ─── CONFIG ──────────────────────────────────────────────────────────────────

const ROOT = __dirname;
const DIST = path.join(ROOT, 'dist');

// CSS files in load order
const CSS_FILES = [
  'css/variables.css',
  'css/base.css',
  'css/login.css',
  'css/layout.css',
  'css/components.css',
  'css/timetable.css',
  'css/search.css',
  'css/students.css',
  'css/responsive.css',
];

// JS files in load order (must match order in index.html)
const JS_FILES = [
  'js/config.js',
  'js/session.js',
  'js/utils.js',
  'js/auth.js',
  'js/navigation.js',
  'js/settings.js',
  'js/teachers.js',
  'js/whatsapp.js',
  'js/classes.js',
  'js/timetable.js',
  'js/search.js',
  'js/users.js',
  'js/notifications.js',
  'js/students.js',
  'js/subjects.js',
  'js/enrollments.js',
  'js/parents.js',
  'js/import-export.js',
  'js/performance.js',
];

// Folders/files to copy into dist/ as-is
const COPY_TARGETS = [
  'api',
  'includes',
  'assets',
  'pages',
  'idltimetable.sql',
];

// ─── HELPERS ─────────────────────────────────────────────────────────────────

function readFile(relPath) {
  return fs.readFileSync(path.join(ROOT, relPath), 'utf8');
}

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function copyRecursive(src, dest) {
  if (!fs.existsSync(src)) return;
  const stat = fs.statSync(src);
  if (stat.isDirectory()) {
    ensureDir(dest);
    for (const child of fs.readdirSync(src)) {
      copyRecursive(path.join(src, child), path.join(dest, child));
    }
  } else {
    ensureDir(path.dirname(dest));
    fs.copyFileSync(src, dest);
  }
}

function sizeKB(str) {
  return (Buffer.byteLength(str, 'utf8') / 1024).toFixed(1) + ' KB';
}

// ─── BUILD ───────────────────────────────────────────────────────────────────

async function build() {
  console.log('\n🔨  IDL Production Build\n');

  ensureDir(DIST);
  ensureDir(path.join(DIST, 'assets'));

  // ── 1. CSS ────────────────────────────────────────────────────────────────
  console.log('📦  Bundling CSS...');
  const rawCSS = CSS_FILES.map(f => {
    const content = readFile(f);
    console.log(`    ✔ ${f}  (${sizeKB(content)})`);
    return `/* === ${f} === */\n${content}`;
  }).join('\n\n');

  console.log(`    Raw total: ${sizeKB(rawCSS)}`);

  const minCSS = new CleanCSS({ level: 2, returnPromise: true });
  const cssResult = await minCSS.minify(rawCSS);
  if (cssResult.errors.length) {
    console.error('CSS errors:', cssResult.errors);
    process.exit(1);
  }

  const cssOutPath = path.join(DIST, 'assets', 'app.min.css');
  fs.writeFileSync(cssOutPath, cssResult.styles, 'utf8');
  console.log(`    ✅ assets/app.min.css  → ${sizeKB(cssResult.styles)}\n`);

  // ── 2. JS ─────────────────────────────────────────────────────────────────
  console.log('📦  Bundling JS...');
  const rawJS = JS_FILES.map(f => {
    const content = readFile(f);
    console.log(`    ✔ ${f}  (${sizeKB(content)})`);
    return `/* === ${f} === */\n${content}`;
  }).join('\n\n');

  console.log(`    Raw total: ${sizeKB(rawJS)}`);

  const jsResult = await minifyJS(rawJS, {
    compress: {
      drop_console: false,   // keep console.log (used for debug)
      passes: 2,
    },
    mangle: true,
    format: { comments: false },
  });

  if (jsResult.error) {
    console.error('JS minify error:', jsResult.error);
    process.exit(1);
  }

  const jsOutPath = path.join(DIST, 'assets', 'app.min.js');
  fs.writeFileSync(jsOutPath, jsResult.code, 'utf8');
  console.log(`    ✅ assets/app.min.js  → ${sizeKB(jsResult.code)}\n`);

  // ── 3. index.html ─────────────────────────────────────────────────────────
  console.log('📄  Building index.html...');
  let html = readFile('index.html');
  const ver = Date.now();

  // Replace all individual CSS <link> tags with one
  html = html.replace(
    /<!-- CSS -->\n([\s\S]*?)<\/head>/,
    `<!-- CSS -->\n<link rel="stylesheet" href="assets/app.min.css?v=${ver}">\n</head>`
  );

  // Replace all individual JS <script src="js/..."> tags with one
  // Also keep the xlsx script untouched
  html = html.replace(
    /(<script src="js\/config\.js"><\/script>[\s\S]*?<script src="js\/performance\.js"><\/script>)/,
    `<script src="assets/app.min.js?v=${ver}"></script>`
  );

  const htmlOutPath = path.join(DIST, 'index.html');
  fs.writeFileSync(htmlOutPath, html, 'utf8');
  console.log(`    ✅ dist/index.html  → ${sizeKB(html)}\n`);

  // ── 4. Copy server-side files ─────────────────────────────────────────────
  console.log('📁  Copying server files...');
  for (const target of COPY_TARGETS) {
    const src  = path.join(ROOT, target);
    const dest = path.join(DIST, target);
    copyRecursive(src, dest);
    if (fs.existsSync(src)) console.log(`    ✔ ${target}`);
  }
  console.log();

  // ── 5. Summary ────────────────────────────────────────────────────────────
  console.log('─'.repeat(50));
  console.log('✅  Build complete → dist/\n');
  console.log('   Raw JS  :', sizeKB(rawJS));
  console.log('   Min JS  :', sizeKB(jsResult.code));
  console.log('   Raw CSS :', sizeKB(rawCSS));
  console.log('   Min CSS :', sizeKB(cssResult.styles));
  console.log();
  console.log('   Upload the dist/ folder to your production server.');
  console.log('─'.repeat(50) + '\n');
}

build().catch(err => { console.error(err); process.exit(1); });
