const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Clean stale wrangler deploy config
const wranglerDir = path.join(__dirname, '..', '.wrangler');
if (fs.existsSync(wranglerDir)) {
  fs.rmSync(wranglerDir, { recursive: true, force: true });
  console.log('Removed stale .wrangler directory');
}

// Create wrangler.jsonc for deployment
const wranglerJsonc = path.join(__dirname, '..', 'wrangler.jsonc');
const jsoncContent = `{
  "name": "realplaybackspeed-com",
  "main": "dist/server/entry.mjs",
  "compatibility_date": "2026-11-27",
  "compatibility_flags": [],
  "no_bundle": true,
  "upload_source_maps": true,

  "kv_namespaces": [
    { "binding": "SESSION" }
  ],

  "assets": {
    "directory": "dist/client",
    "binding": "ASSETS"
  },

  "images": {
    "binding": "IMAGES"
  },

  "observability": {
    "enabled": true
  },

  "rules": [
    { "type": "ESModule", "globs": ["**/*.js", "**/*.mjs"] }
  ]
}
`;
fs.writeFileSync(wranglerJsonc, jsoncContent);
console.log('Created wrangler.jsonc for deployment');

// Deploy
try {
  execSync('wrangler deploy', { stdio: 'inherit', cwd: path.join(__dirname, '..') });
} finally {
  // Clean up wrangler.jsonc after deploy so it doesn't interfere with next build
  if (fs.existsSync(wranglerJsonc)) {
    fs.rmSync(wranglerJsonc, { force: true });
    console.log('Removed wrangler.jsonc after deployment');
  }
}
