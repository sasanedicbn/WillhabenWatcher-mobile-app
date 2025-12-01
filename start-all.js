const { spawn } = require('child_process');
const path = require('path');

console.log('Starting Willhaben scraper server...');
const server = spawn('node', ['server/index.js'], {
  stdio: 'inherit',
  env: { ...process.env },
});

server.on('error', (err) => {
  console.error('Server error:', err);
});

setTimeout(() => {
  console.log('Starting Expo...');
  const expo = spawn('npx', ['expo', 'start'], {
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
}, 3000);

process.on('SIGINT', () => {
  server.kill();
  process.exit();
});
