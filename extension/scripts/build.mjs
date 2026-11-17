/**
 * Production build script for EpoClaim Chrome Extension (Manifest V3)
 * Bundles background service worker, content scripts, and side panel/options React pages.
 */

import path from "node:path";
import fs from "node:fs";
import { execSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const extensionRoot = path.resolve(__dirname, "..");
const projectRoot = path.resolve(extensionRoot, "..");
const distDir = path.resolve(extensionRoot, "dist");

// Dynamically resolve Vite and React plugin from repository node_modules
const vitePath = path.resolve(projectRoot, "frontend/node_modules/vite/dist/node/index.js");
const reactPluginPath = path.resolve(projectRoot, "frontend/node_modules/@vitejs/plugin-react/dist/index.js");

const { build } = await import(`file://${vitePath}`);
const reactPlugin = (await import(`file://${reactPluginPath}`)).default;

const mode = process.argv.includes("--mode=dev") ? "dev" : "prod";
console.log(`[EpoClaim Build] Starting Chrome Extension Manifest V3 build (mode: ${mode})...`);

// 0. Ensure dist directory exists and is clean
if (fs.existsSync(distDir)) {
  fs.rmSync(distDir, { recursive: true, force: true });
}
fs.mkdirSync(distDir, { recursive: true });

const commonResolve = {
  alias: {
    react: path.resolve(projectRoot, "frontend/node_modules/react"),
    "react-dom": path.resolve(projectRoot, "frontend/node_modules/react-dom"),
    "react/jsx-runtime": path.resolve(projectRoot, "frontend/node_modules/react/jsx-runtime"),
    "react-dom/client": path.resolve(projectRoot, "frontend/node_modules/react-dom/client"),
  },
};

const removeCrossoriginPlugin = () => ({
  name: "remove-crossorigin",
  enforce: "post",
  transformIndexHtml(html) {
    return html.replace(/\s*crossorigin(=["'][^"']*["'])?/gi, "");
  },
});

// 1. Build UI HTML pages (sidepanel and options)
console.log("[EpoClaim Build] Compiling React UI pages (sidepanel & options)...");
await build({
  root: extensionRoot,
  plugins: [reactPlugin(), removeCrossoriginPlugin()],
  resolve: commonResolve,
  base: "",
  build: {
    outDir: distDir,
    emptyOutDir: false,
    rollupOptions: {
      input: {
        sidepanel: path.resolve(extensionRoot, "sidepanel.html"),
        options: path.resolve(extensionRoot, "options.html"),
      },
      output: {
        entryFileNames: "assets/[name]-[hash].js",
        chunkFileNames: "assets/[name]-[hash].js",
        assetFileNames: "assets/[name]-[hash].[ext]",
      },
    },
  },
  configFile: false,
});

// 2. Build Background Service Worker (ES module)
console.log("[EpoClaim Build] Compiling Background Service Worker (background.js)...");
await build({
  root: extensionRoot,
  resolve: commonResolve,
  publicDir: false,
  build: {
    outDir: distDir,
    emptyOutDir: false,
    lib: {
      entry: path.resolve(extensionRoot, "src/background/service-worker.ts"),
      name: "EpoClaimBackground",
      formats: ["es"],
      fileName: () => "background.js",
    },
    rollupOptions: {
      output: {
        inlineDynamicImports: true,
      },
    },
  },
  configFile: false,
});

// 3. Build Content Script (IIFE, self-contained for Chrome isolated world)
console.log("[EpoClaim Build] Compiling Content Script (content.js)...");
await build({
  root: extensionRoot,
  resolve: commonResolve,
  publicDir: false,
  build: {
    outDir: distDir,
    emptyOutDir: false,
    lib: {
      entry: path.resolve(extensionRoot, "src/content/content-main.ts"),
      name: "EpoClaimContent",
      formats: ["iife"],
      fileName: () => "content.js",
    },
    rollupOptions: {
      output: {
        inlineDynamicImports: true,
      },
    },
  },
  configFile: false,
});

// 4. Copy manifest.json to dist
console.log("[EpoClaim Build] Copying manifest.json...");
const manifestSrc = path.resolve(extensionRoot, "manifest.json");
const manifestDest = path.resolve(distDir, "manifest.json");
fs.copyFileSync(manifestSrc, manifestDest);

// 5. Copy icons to dist/icons
console.log("[EpoClaim Build] Copying extension icons...");
const iconsSrcDir = path.resolve(extensionRoot, "public/icons");
const iconsDestDir = path.resolve(distDir, "icons");
fs.mkdirSync(iconsDestDir, { recursive: true });
for (const iconFile of fs.readdirSync(iconsSrcDir)) {
  fs.copyFileSync(path.resolve(iconsSrcDir, iconFile), path.resolve(iconsDestDir, iconFile));
}

// 6. Ensure all generated HTML files in dist have no remaining crossorigin attributes
for (const htmlFile of ["sidepanel.html", "options.html"]) {
  const filePath = path.resolve(distDir, htmlFile);
  if (fs.existsSync(filePath)) {
    let content = fs.readFileSync(filePath, "utf-8");
    content = content.replace(/\s*crossorigin(=["'][^"']*["'])?/gi, "");
    fs.writeFileSync(filePath, content, "utf-8");
  }
}

// 7. Package extension into frontend/public/downloads/epoclaim-extension.zip
console.log("[EpoClaim Build] Packaging extension into frontend/public/downloads/epoclaim-extension.zip...");
const downloadsDir = path.resolve(projectRoot, "frontend/public/downloads");
fs.mkdirSync(downloadsDir, { recursive: true });
const zipDest = path.resolve(downloadsDir, "epoclaim-extension.zip");
try {
  if (fs.existsSync(zipDest)) {
    fs.unlinkSync(zipDest);
  }
  execSync(`powershell -NoProfile -Command "Compress-Archive -Path '${distDir}\\*' -DestinationPath '${zipDest}' -Force"`);
  console.log(`[EpoClaim Build] Package created: ${zipDest} (${Math.round(fs.statSync(zipDest).size / 1024)} KB)`);
  const frontendDistDownloads = path.resolve(projectRoot, "frontend/dist/downloads");
  if (fs.existsSync(frontendDistDownloads)) {
    fs.copyFileSync(zipDest, path.resolve(frontendDistDownloads, "epoclaim-extension.zip"));
    console.log(`[EpoClaim Build] Synced package to: ${frontendDistDownloads}/epoclaim-extension.zip`);
  }
} catch (zipErr) {
  console.warn("[EpoClaim Build] Warning: Failed to compress ZIP:", zipErr.message);
}

console.log("[EpoClaim Build] Extension successfully compiled into extension/dist/!");
