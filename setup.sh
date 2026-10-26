#!/bin/bash
# Predictex — One-command setup for a fresh machine
# Usage: chmod +x setup.sh && ./setup.sh

set -e

echo "=== Predictex Setup ==="
echo ""

# Check Node.js
if ! command -v node &> /dev/null; then
    echo "❌ Node.js not found. Install it: https://nodejs.org (v18+)"
    exit 1
fi
echo "✓ Node.js $(node -v)"

# Check Python 3
if ! command -v python3 &> /dev/null; then
    echo "❌ Python 3 not found. Install it: https://python.org"
    exit 1
fi
echo "✓ Python $(python3 --version)"

# Install backend dependencies
echo ""
echo "Installing backend dependencies..."
cd server && npm install && cd ..
echo "✓ Backend dependencies installed"

# Install Python dependencies (optional, for proxy)
echo ""
echo "Installing Python dependencies (optional, for Kalshi proxy)..."
pip3 install -r requirements.txt 2>/dev/null || echo "⚠ pip install failed — proxy will use fallback (urllib). This is fine."
echo "✓ Python dependencies done"

echo ""
echo "=== Setup complete! ==="
echo ""
echo "To run Predictex, open 2 terminals:"
echo ""
echo "  Terminal 1 (backend):"
echo "    cd server && node server.js"
echo ""
echo "  Terminal 2 (frontend):"
echo "    python3 -m http.server 7432"
echo ""
echo "  Terminal 3 (optional — Kalshi proxy):"
echo "    python3 proxy.py"
echo ""
echo "Then open http://localhost:7432"
echo ""
echo "Default accounts:"
echo "  Admin: admin / admin123"
echo "  User:  testui / test123"
