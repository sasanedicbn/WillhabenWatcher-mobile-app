// app.config.js
module.exports = ({ config }) => ({
  ...config,
  android: {
    ...config.android,
    package: "com.willhabencars.app",
    googleServicesFile: "./google-services.json",
  },
});
