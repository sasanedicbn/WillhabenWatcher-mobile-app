const { getDefaultConfig } = require('expo/metro-config');
const { spawn } = require('child_process');
const http = require('http');

function checkBackend() {
  return new Promise((resolve) => {
    const req = http.get('http://localhost:8083/api/health', (res) => {
      resolve(res.statusCode === 200);
    });
    req.on('error', () => resolve(false));
    req.setTimeout(1000, () => {
      req.destroy();
      resolve(false);
    });
  });
}

async function startBackendIfNeeded() {
  const isRunning = await checkBackend();
  if (!isRunning) {
    console.log('\n[Metro] Starting backend server on port 8083...\n');
    const backend = spawn('node', ['server/index.js'], {
      cwd: process.cwd(),
      stdio: 'inherit',
      detached: true,
      env: { ...process.env, API_PORT: '8083' },
    });
    backend.unref();
    
    await new Promise(resolve => setTimeout(resolve, 5000));
    console.log('\n[Metro] Backend server started!\n');
  } else {
    console.log('\n[Metro] Backend already running on port 8083\n');
  }
}

startBackendIfNeeded();

const config = getDefaultConfig(__dirname);

module.exports = config;
