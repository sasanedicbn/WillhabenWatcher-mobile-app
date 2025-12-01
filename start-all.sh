#!/bin/bash
node server/index.js &
BACKEND_PID=$!
sleep 3
EXPO_PACKAGER_PROXY_URL=https://$REPLIT_DEV_DOMAIN REACT_NATIVE_PACKAGER_HOSTNAME=$REPLIT_DEV_DOMAIN npx expo start
kill $BACKEND_PID 2>/dev/null
