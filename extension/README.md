# EpoClaim Chrome Extension (Manifest V3)

Production-ready browser extension for real-time temporal fact-verification and stale-answer auditing directly on **ChatGPT** (`chatgpt.com`, `chat.openai.com`) and **Google Gemini** (`gemini.google.com`).

---

## 1. Quick Start / Installation

### Load the Unpacked Extension in Chrome:
1. Open Google Chrome and navigate to `chrome://extensions/`.
2. Enable **Developer mode** via the toggle switch in the top right.
3. Click the **Load unpacked** button.
4. Select the directory:
   ```
   D:\Development\Projects\MY PERSONAAL WORKS\Global\EPOCLAIM\extension\dist
   ```
5. The extension **EpoClaim — Temporal AI Fact Verification** will appear in your extensions toolbar.
6. Click the Extensions puzzle piece icon in Chrome and pin **EpoClaim** to your toolbar.

---

## 2. Activation & User Experience

### Method A — Toolbar Activation:
- Clicking the EpoClaim icon in the toolbar opens the **EpoClaim Side Panel**.
- Shows current active platform (ChatGPT, Gemini, or Other Page).
- Shows live monitoring status (OFF by default).
- Provides a one-click toggle to enable/disable monitoring.
- Provides a manual **"Verify Latest Answer ➔"** button.

### Method B — Keyboard Shortcut:
- Press **`Ctrl + Shift + Y`** (or **`Command + Shift + Y`** on macOS) while on ChatGPT or Gemini to immediately toggle verification monitoring on or off.
- To customize the shortcut: visit `chrome://extensions/shortcuts` in Chrome.

---

## 3. How Verification Works

1. **Detection:** When an AI response is generated, EpoClaim's DOM Completion Observer monitors mutations in the conversation container.
2. **Streaming Protection:** Ensures the response is not analyzed while tokens are actively streaming (via stop-button detection, generation indicators, debounced quiet periods, and dual-snapshot stability checks).
3. **Deduplication:** A deterministic 64-bit fingerprint prevents duplicate verification requests for previously processed answers.
4. **Backend Pipeline:** The assistant's completed answer is forwarded to the privileged Background Service Worker, which calls EpoClaim's FastAPI backend (`POST /api/v1/analyze`).
5. **In-Page Notification:** A non-intrusive floating notification rendered inside an isolated Shadow DOM alerts the user with the verdict and claim count.
6. **Detailed Side Panel:** Clicking "View Full Analysis" or opening the Side Panel presents:
   - Overall Verdict Banner (`SUPPORTED`, `CONTRADICTED`, `OUTDATED`, `PARTIALLY_SUPPORTED`, `UNVERIFIED`).
   - Primary Revised Answer with green (verified/corrected), red/strikethrough (contradicted), and amber (outdated/unverified) semantic highlights.
   - Atomic Claims list with expandable proposition breakdowns and explanations.
   - Grounding Evidence Sources with clickable external links and publication dates.
   - Direct link to open the complete report in the EpoClaim web workspace.

---

## 4. Configuration & Settings

Visit the Options page by clicking the ⚙ gear icon in the Side Panel, or right-clicking the EpoClaim icon $\rightarrow$ **Options**:

- **Service Base URL:** Default is `http://localhost:8000` (can be configured to your production Render URL).
- **Developer API Key:** Optional key sent via `X-API-Key` and `Authorization: Bearer <key>`.
- **Live Search (Tavily):** Enable or disable live web retrieval.
- **Auto-Verify:** Toggle whether completed answers are automatically verified.
- **Streaming Debounce Window:** Adjust quiet period in milliseconds (default: 900ms).

---

## 5. Building & Testing

### Build Extension:
```bash
node extension/scripts/build.mjs
```
Compiles TypeScript, React UI, background worker, and content script into `extension/dist/`.

### Run Test Suite:
```bash
node --experimental-strip-types extension/tests/unit_adapters.test.mjs
node --experimental-strip-types extension/tests/unit_api_client.test.mjs
node --experimental-strip-types extension/tests/integration_extension.test.mjs
```
All 23 unit & integration tests verify adapters, deduplication, URL safety, API client error translation, and tab lifecycle.

