const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Clean stale wrangler deploy config
const wranglerDir = path.join(__dirname, '..', '.wrangler');
if (fs.existsSync(wranglerDir)) {
  fs.rmSync(wranglerDir, { recursive: true, force: true });
  console.log('Removed stale .wrangler directory');
}

// Create wrangler.toml for deployment
const wranglerToml = path.join(__dirname, '..', 'wrangler.toml');
const tomlContent = `name = "realplaybackspeed-com"
main = "dist/server/entry.mjs"
compatibility_date = "2026-11-27"
compatibility_flags = []
no_bundle = true

[[kv_namespaces]]
binding = "SESSION"

[assets]
directory = "dist/client"
binding = "ASSETS"

[images]
binding = "IMAGES"

[observability]
enabled = true

[[rules]]
type = "ESModule"
globs = ["**/*.js", "**/*.mjs"]
`;
fs.writeFileSync(wranglerToml, tomlContent);
console.log('Created wrangler.toml for deployment');

// Deploy
try {
  execSync('wrangler deploy', { stdio: 'inherit', cwd: path.join(__dirname, '..') });
} finally {
  // Clean up wrangler.toml after deploy so it doesn't interfere with next build
  if (fs.existsSync(wranglerToml)) {
    fs.rmSync(wranglerToml, { force: true });
    console.log('Removed wrangler.toml after deployment');
  }
}
