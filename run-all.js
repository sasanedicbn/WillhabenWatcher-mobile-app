const { spawn } = require('child_process');
const path = require('path');

console.log('Starting backend server...');
const backend = spawn('node', ['server/index.js'], {
  cwd: process.cwd(),
  stdio: 'inherit',
});

backend.on('error', (err) => {
  console.error('Backend error:', err);
});

setTimeout(() => {
  console.log('Starting Expo frontend...');
  const expo = spawn('npx', ['expo', 'start'], {
    cwd: process.cwd(),
    stdio: 'inherit',
    env: {
      ...process.env,
      EXPO_PACKAGER_PROXY_URL: `https://${process.env.REPLIT_DEV_DOMAIN}`,
      REACT_NATIVE_PACKAGER_HOSTNAME: process.env.REPLIT_DEV_DOMAIN,
    },
  });

  expo.on('error', (err) => {
    console.error('Expo error:', err);
  });

  expo.on('close', (code) => {
    console.log('Expo exited with code:', code);
    backend.kill();
    process.exit(code);
  });
}, 3000);

process.on('SIGINT', () => {
  backend.kill();
  process.exit(0);
});

process.on('SIGTERM', () => {
  backend.kill();
  process.exit(0);
});
