#!/bin/bash
# Installs packages and restarts the app after cPanel pulls new code.
set -e
cd "$(dirname "$0")/.."

# Use the newest Node.js that cPanel installed (EasyApache: /opt/cpanel/ea-nodejsNN).
for v in 24 22 20 18; do
  if [ -x "/opt/cpanel/ea-nodejs$v/bin/npm" ]; then export PATH="/opt/cpanel/ea-nodejs$v/bin:$PATH"; break; fi
done

if command -v npm >/dev/null 2>&1; then
  npm install --omit=dev --no-audit --no-fund
else
  echo "npm not found: click 'Ensure dependencies' in Application Manager instead" >&2
fi

# Passenger (Application Manager) restarts the app when this file changes.
mkdir -p tmp
touch tmp/restart.txt
echo "Deployed $(git rev-parse --short HEAD) at $(date)"
