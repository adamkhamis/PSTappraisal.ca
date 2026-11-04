#!/bin/bash
# Installs packages and restarts the app after cPanel pulls new code.
# Leaves no changed or new tracked files behind, because cPanel won't deploy over uncommitted changes.
cd "$(dirname "$0")/.." || exit 1
echo "Deploying $(git rev-parse --short HEAD 2>/dev/null) in $(pwd)"

# Use the newest Node.js that cPanel installed (EasyApache: /opt/cpanel/ea-nodejsNN).
for v in 24 22 20 18; do
  if [ -x "/opt/cpanel/ea-nodejs$v/bin/npm" ]; then export PATH="/opt/cpanel/ea-nodejs$v/bin:$PATH"; break; fi
done

if command -v npm >/dev/null 2>&1; then
  echo "Using node $(node -v), npm $(npm -v)"
  # npm ci installs exactly what package-lock.json lists and never rewrites it.
  npm ci --omit=dev --no-audit --no-fund || npm install --omit=dev --no-audit --no-fund --no-package-lock || {
    echo "Package install failed. Click 'Ensure dependencies' in Application Manager, or send this log to support." >&2
    exit 1
  }
else
  echo "npm isn't available to deployments here: click 'Ensure dependencies' in Application Manager after each update."
fi

# Passenger (Application Manager) restarts the app when this file changes. tmp/ is git-ignored.
mkdir -p tmp && touch tmp/restart.txt
echo "Done at $(date)"
