/**
 * Global Frontend Configuration for EpoClaim
 */

/**
 * Official Chrome Web Store listing URL.
 * Reads from VITE_CHROME_WEB_STORE_URL environment variable if set.
 * Set to empty string ("") during development or pre-release to enable
 * direct packaged ZIP download and the guided manual installation modal.
 */
export const CHROME_EXTENSION_STORE_URL: string =
  (typeof import.meta !== "undefined" && import.meta.env?.VITE_CHROME_WEB_STORE_URL?.trim()) || "";

/**
 * Direct download path for the compiled, packaged Chrome Extension ZIP.
 */
export const CHROME_EXTENSION_PACKAGE_URL: string = "/downloads/epoclaim-extension.zip";

/**
 * Chrome Extension documentation & developer guide link.
 */
export const CHROME_EXTENSION_DOCS_URL: string = "https://github.com/Souvik-Dey-2029/EpoClaim#chrome-extension";
