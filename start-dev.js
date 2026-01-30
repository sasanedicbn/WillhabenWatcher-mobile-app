const { spawn } = require('child_process');


const backend = spawn('node', ['server/index.js'], {
  cwd: process.cwd(),
  stdio: 'inherit',
  env: process.env,
});

backend.on('error', (err) => {
  console.error('Backend failed to start:', err.message);
});

backend.on('exit', (code) => {
  if (code !== 0) {
    console.error('Backend exited with code:', code);
  }
});

setTimeout(() => {

  
  const expo = spawn('npx', ['expo', 'start'], {
    cwd: process.cwd(),
    stdio: 'inherit',
    env: {
      ...process.env,
      EXPO_PACKAGER_PROXY_URL: `https://${process.env.REPLIT_DEV_DOMAIN}`,
      REACT_NATIVE_PACKAGER_HOSTNAME: process.env.REPLIT_DEV_DOMAIN,
    },
    shell: true,
  });

  expo.on('error', (err) => {
    console.error('Expo failed to start:', err.message);
  });

  expo.on('exit', (code) => {
    backend.kill();
    process.exit(code || 0);
  });
}, 5000);

process.on('SIGINT', () => {
  backend.kill();
  process.exit(0);
});

process.on('SIGTERM', () => {
  backend.kill();
  process.exit(0);
});
