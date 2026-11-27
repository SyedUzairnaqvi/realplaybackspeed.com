const fs = require('fs');
const path = require('path');

// Clean stale wrangler deploy config
const wranglerDir = path.join(__dirname, '..', '.wrangler');
if (fs.existsSync(wranglerDir)) {
  fs.rmSync(wranglerDir, { recursive: true, force: true });
  console.log('Removed stale .wrangler directory');
}

// Patch dist/server/wrangler.json to add type=esm
const wranglerJson = path.join(__dirname, '..', 'dist', 'server', 'wrangler.json');
if (fs.existsSync(wranglerJson)) {
  let content = fs.readFileSync(wranglerJson, 'utf8');
  let obj;
  try {
    obj = JSON.parse(content);
  } catch {
    console.log('wrangler.json is not valid JSON');
    process.exit(0);
  }
  if (!obj.type) {
    obj.type = 'esm';
    fs.writeFileSync(wranglerJson, JSON.stringify(obj, null, 2));
    console.log('Added type=esm to wrangler.json');
  } else {
    console.log('type already set');
  }
} else {
  console.log('wrangler.json not found');
}
