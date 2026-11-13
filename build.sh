#!/usr/bin/env bash
# ==============================================================================
# EpoClaim — Unified Production Build Script for Render Web Service
# ==============================================================================
# This script executes at the repository root during Render's build phase:
# 1. Installs Python backend dependencies from backend/requirements.txt
# 2. Ensures Node.js and npm are available in the build environment
# 3. Installs frontend dependencies using frontend/package-lock.json
# 4. Compiles the React + Vite frontend into frontend/dist
# ==============================================================================
set -o errexit
set -o pipefail
set -o nounset

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT_DIR"

echo "=============================================================================="
echo "🚀 [EpoClaim Build] Starting unified build in: $ROOT_DIR"
echo "=============================================================================="

# ------------------------------------------------------------------------------
# 1. Python Backend Dependencies
# ------------------------------------------------------------------------------
echo "🐍 [1/4] Installing Python backend dependencies..."
python -m pip install --upgrade pip setuptools wheel
python -m pip install -r backend/requirements.txt

# ------------------------------------------------------------------------------
# 2. Ensure Node.js & npm (for Render Python native environment)
# ------------------------------------------------------------------------------
echo "📦 [2/4] Verifying Node.js & npm runtime..."
if ! command -v node >/dev/null 2>&1 || ! command -v npm >/dev/null 2>&1; then
    NODE_VERSION="20.18.0"
    echo "⬇️  Node.js not detected in environment. Installing standalone Node.js v${NODE_VERSION}..."
    ARCH="$(uname -m)"
    if [ "$ARCH" = "x86_64" ]; then
        NODE_ARCH="x64"
    elif [ "$ARCH" = "aarch64" ] || [ "$ARCH" = "arm64" ]; then
        NODE_ARCH="arm64"
    else
        NODE_ARCH="x64"
    fi

    NODE_TAR="node-v${NODE_VERSION}-linux-${NODE_ARCH}.tar.xz"
    NODE_URL="https://nodejs.org/dist/v${NODE_VERSION}/${NODE_TAR}"
    NODE_DIR="$ROOT_DIR/.node_runtime"

    mkdir -p "$NODE_DIR"
    echo "   Fetching: $NODE_URL"
    curl -fsSL "$NODE_URL" -o "/tmp/$NODE_TAR"
    tar -xJf "/tmp/$NODE_TAR" -C "$NODE_DIR" --strip-components=1
    rm -f "/tmp/$NODE_TAR"

    export PATH="$NODE_DIR/bin:$PATH"
fi

echo "   Node version: $(node -v)"
echo "   NPM version:  $(npm -v)"

# ------------------------------------------------------------------------------
# 3. Frontend Dependencies
# ------------------------------------------------------------------------------
echo "⚡ [3/4] Installing frontend dependencies with clean-install..."
cd "$ROOT_DIR/frontend"
npm ci

# ------------------------------------------------------------------------------
# 4. Compile React + Vite Production Bundle
# ------------------------------------------------------------------------------
echo "🏗️  [4/4] Building production React application..."
# In unified single-service mode, API base URL is same-origin ("")
export VITE_API_BASE_URL=""
npm run build

if [ ! -f "$ROOT_DIR/frontend/dist/index.html" ]; then
    echo "❌ Error: frontend/dist/index.html was not generated!"
    exit 1
fi

echo "=============================================================================="
echo "✅ [EpoClaim Build] Unified build completed successfully!"
echo "   Artifact: $ROOT_DIR/frontend/dist"
echo "=============================================================================="
