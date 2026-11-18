var e = "https://epoclaim.onrender.com", t = {
	backendUrl: e,
	apiKey: "",
	enableLiveSearch: !0,
	autoVerifyOnComplete: !0,
	highlightInPage: !0,
	debounceMs: 900
}, n = class extends Error {
	statusCode;
	details;
	constructor(e, t, n) {
		super(e), this.name = "EpoClaimClientError", this.statusCode = t, this.details = n;
	}
}, r = class {
	baseUrl;
	apiKey;
	timeoutMs;
	fetchFn;
	constructor(e = {}) {
		let t = e.baseUrl || "https://epoclaim.onrender.com";
		this.baseUrl = t.replace(/\/+$/, ""), this.apiKey = e.apiKey ? e.apiKey.trim() : void 0, this.timeoutMs = e.timeoutMs ?? 6e4, this.fetchFn = e.fetchFn;
	}
	updateConfig(e) {
		e.baseUrl !== void 0 && (this.baseUrl = e.baseUrl.replace(/\/+$/, "")), e.apiKey !== void 0 && (this.apiKey = e.apiKey.trim() || void 0), e.timeoutMs !== void 0 && (this.timeoutMs = e.timeoutMs), e.fetchFn !== void 0 && (this.fetchFn = e.fetchFn);
	}
	getBaseUrl() {
		return this.baseUrl;
	}
	async checkHealth() {
		return this.request("/api/v1/health", { method: "GET" });
	}
	async analyzeResponse(e) {
		if (!e.response_text || !e.response_text.trim()) throw new n("Response text cannot be empty.");
		let t = {
			response_text: e.response_text.trim(),
			prompt: e.prompt ? e.prompt.trim() : void 0,
			enable_live_search: e.enable_live_search ?? !0,
			context_documents: e.context_documents,
			reference_date: e.reference_date,
			temporal_evaluation_mode: e.temporal_evaluation_mode ?? "default"
		};
		return this.request("/api/v1/analyze", {
			method: "POST",
			body: JSON.stringify(t)
		});
	}
	async getReport(e) {
		if (!e || !e.trim()) throw new n("Report ID cannot be empty.");
		return this.request(`/api/v1/analysis/${encodeURIComponent(e.trim())}`, { method: "GET" });
	}
	async getTavilyStatus() {
		return this.request("/api/v1/tavily/status", { method: "GET" });
	}
	async request(e, t) {
		let r = `${this.baseUrl}${e}`, i = {
			Accept: "application/json",
			...t.headers
		};
		t.body && !i["Content-Type"] && (i["Content-Type"] = "application/json"), this.apiKey && (i["X-API-Key"] = this.apiKey, i.Authorization = `Bearer ${this.apiKey}`);
		let a = new AbortController(), o = setTimeout(() => a.abort(), this.timeoutMs);
		try {
			let s;
			s = typeof this.fetchFn == "function" ? await this.fetchFn(r, {
				...t,
				headers: i,
				signal: a.signal
			}) : await globalThis.fetch(r, {
				...t,
				headers: i,
				signal: a.signal
			}), clearTimeout(o);
			let c = (s.headers.get("content-type") || "").includes("application/json") ? await s.json().catch(() => null) : await s.text().catch(() => null);
			if (!s.ok) {
				let t = `Backend request to ${e} failed with HTTP ${s.status}`;
				throw c && typeof c == "object" && "detail" in c ? t = String(c.detail) : typeof c == "string" && c.trim() && (t = c), s.status === 401 ? new n("Authentication failed: invalid or missing API key.", s.status, c) : s.status === 404 ? new n(`Resource not found: ${t}`, s.status, c) : s.status === 413 ? new n("Payload too large for EpoClaim server.", s.status, c) : s.status === 422 ? new n(`Validation error: ${t}`, s.status, c) : new n(t, s.status, c);
			}
			return c;
		} catch (e) {
			throw clearTimeout(o), e instanceof n ? e : e instanceof Error && e.name === "AbortError" ? new n(`Request timed out after ${Math.round(this.timeoutMs / 1e3)} seconds. The verification server may be cold-starting or busy.`, 408) : new n(`Network connection error: ${e instanceof Error ? e.message : String(e)}. Is the EpoClaim backend running at ${this.baseUrl}?`);
		}
	}
}, i = "epoclaim_settings", a = "epoclaim_tab_";
async function o() {
	if (typeof chrome < "u" && chrome.storage?.local) try {
		let e = await chrome.storage.local.get(i);
		if (e && e[i]) return {
			...t,
			...e[i]
		};
	} catch (e) {
		console.warn("[EpoClaim Storage] Failed to load settings from storage.local:", e);
	}
	return { ...t };
}
async function s(e) {
	let t = `${a}${e}`;
	if (typeof chrome < "u" && chrome.storage?.session) try {
		let e = await chrome.storage.session.get(t);
		if (e && e[t]) return e[t];
	} catch (t) {
		console.warn(`[EpoClaim Storage] Failed to load tab state for tab ${e}:`, t);
	}
	return null;
}
async function c(e) {
	let t = `${a}${e.tabId}`;
	if (typeof chrome < "u" && chrome.storage?.session) try {
		await chrome.storage.session.set({ [t]: e });
	} catch (t) {
		console.warn(`[EpoClaim Storage] Failed to save tab state for tab ${e.tabId}:`, t);
	}
}
async function l(e) {
	let t = `${a}${e}`;
	if (typeof chrome < "u" && chrome.storage?.session) try {
		await chrome.storage.session.remove(t);
	} catch {}
}
new class {
	apiClient;
	inFlightVerifications = /* @__PURE__ */ new Set();
	constructor() {
		this.apiClient = new r({ baseUrl: e }), this.registerMessageListener(), this.registerCommandsListener(), this.registerTabListeners(), this.initAsync().catch((e) => {
			console.warn("[EpoClaim ServiceWorker] Async init warning:", e);
		});
	}
	async initAsync() {
		console.info("[EpoClaim ServiceWorker] Initializing settings and side panel...");
		try {
			let e = await o();
			this.apiClient.updateConfig({
				baseUrl: e.backendUrl || "https://epoclaim.onrender.com",
				apiKey: e.apiKey
			});
		} catch (e) {
			console.warn("[EpoClaim ServiceWorker] Failed to load saved settings:", e);
		}
		typeof chrome < "u" && chrome.sidePanel && chrome.sidePanel.setPanelBehavior && chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: !0 }).catch((e) => console.warn("[EpoClaim ServiceWorker] setPanelBehavior error:", e)), this.ensureContentScriptsInjected().catch(() => {});
	}
	registerMessageListener() {
		chrome.runtime.onMessage.addListener((e, t, n) => (this.handleMessage(e, t).then((e) => {
			n({
				success: !0,
				data: e
			});
		}).catch((t) => {
			let r = t instanceof Error ? t.message : String(t);
			console.warn(`[EpoClaim ServiceWorker] Handler error for ${e?.type}:`, r), n({
				success: !1,
				error: r
			});
		}), !0));
	}
	registerCommandsListener() {
		typeof chrome < "u" && chrome.commands && chrome.commands.onCommand.addListener(async (e) => {
			if (console.info(`[EpoClaim ServiceWorker] Command received: ${e}`), e === "toggle-monitoring") {
				let e = await this.getActiveTab();
				e && e.id && await this.toggleMonitoring(e.id);
			}
		});
	}
	registerTabListeners() {
		typeof chrome < "u" && chrome.tabs && (chrome.tabs.onRemoved.addListener((e) => {
			l(e).catch(() => {});
		}), chrome.tabs.onActivated.addListener(async (e) => {
			try {
				let t = await s(e.tabId);
				this.updateBadge(e.tabId, t?.isMonitoring ?? !1);
			} catch {}
		}), chrome.tabs.onUpdated.addListener(async (e, t, n) => {
			if (t.status === "complete" && n.url) {
				let t = this.detectPlatformFromUrl(n.url);
				if (t !== "unsupported") {
					let r = await s(e);
					r && (r.url = n.url, r.platform = t, r.lastUpdated = Date.now(), await c(r), this.broadcastTabStateChange(r));
				}
			}
		}));
	}
	async getActiveTab() {
		if (typeof chrome > "u" || !chrome.tabs) return null;
		try {
			let e = await chrome.tabs.query({
				active: !0,
				currentWindow: !0
			});
			if (e.length > 0 && e[0].id) return e[0];
		} catch {}
		try {
			let e = await chrome.tabs.query({
				active: !0,
				lastFocusedWindow: !0
			});
			if (e.length > 0 && e[0].id) return e[0];
		} catch {}
		return null;
	}
	async ensureContentScriptsInjected() {
		try {
			if (typeof chrome > "u" || !chrome.tabs || !chrome.scripting) return;
			let e = await chrome.tabs.query({ url: [
				"https://chatgpt.com/*",
				"https://chat.openai.com/*",
				"https://gemini.google.com/*"
			] });
			for (let t of e) if (t.id) try {
				await chrome.scripting.executeScript({
					target: { tabId: t.id },
					files: ["content.js"]
				});
			} catch {}
		} catch (e) {
			console.warn("[EpoClaim ServiceWorker] Content script pre-injection warning:", e);
		}
	}
	async ensureContentScriptReady(e, t) {
		if (this.detectPlatformFromUrl(t || "") === "unsupported") return !1;
		for (let t = 0; t < 3; t++) try {
			let t = await chrome.tabs.sendMessage(e, { type: "PING" });
			if (t && t.success) return !0;
		} catch {
			if (t === 0 && chrome.scripting && chrome.scripting.executeScript) try {
				await chrome.scripting.executeScript({
					target: { tabId: e },
					files: ["content.js"]
				});
			} catch (t) {
				return console.warn(`[EpoClaim ServiceWorker] Script injection error on tab ${e}:`, t), !1;
			}
			await new Promise((e) => setTimeout(e, 150));
		}
		return !1;
	}
	async handleMessage(e, t) {
		let n = t.tab?.id;
		switch (e.type) {
			case "CONTENT_SCRIPT_INITIALIZED": {
				if (!n) return null;
				let t = await s(n);
				return t ? (t.url = e.url, t.platform = e.platform, t.lastUpdated = Date.now(), await c(t)) : (t = {
					tabId: n,
					url: e.url,
					platform: e.platform,
					isMonitoring: !1,
					verificationState: "idle",
					lastUpdated: Date.now()
				}, await c(t)), this.updateBadge(n, t.isMonitoring), t;
			}
			case "TOGGLE_MONITORING": {
				let t = e.tabId || n;
				if (!t) throw Error("No target tabId specified.");
				return await this.toggleMonitoring(t, e.enable);
			}
			case "GET_ACTIVE_TAB_STATE": {
				let e = await this.getActiveTab();
				if (!e || !e.id) return {
					tabId: 0,
					url: "",
					platform: "unsupported",
					isMonitoring: !1,
					verificationState: "idle",
					lastUpdated: Date.now()
				};
				let t = await s(e.id), n = e.url || "", r = this.detectPlatformFromUrl(n);
				return t ? (t.url = n, t.platform = r) : (t = {
					tabId: e.id,
					url: n,
					platform: r,
					isMonitoring: !1,
					verificationState: "idle",
					lastUpdated: Date.now()
				}, await c(t)), t;
			}
			case "OPEN_SIDE_PANEL": {
				let t = e.tabId || n;
				return t && chrome.sidePanel && chrome.sidePanel.open && await chrome.sidePanel.open({ tabId: t }), !0;
			}
			case "ANSWER_DETECTED": {
				if (!n) return null;
				console.info(`[EpoClaim ServiceWorker] Received ANSWER_DETECTED from tab ${n} (fp: ${e.answer.fingerprint.slice(0, 8)}, len: ${e.answer.text.length})`);
				let t = await s(n);
				return !t || !t.isMonitoring ? (console.warn(`[EpoClaim ServiceWorker] Discarding answer: monitoring is OFF for tab ${n}.`), null) : (console.info(`[EpoClaim ServiceWorker] Initiating auto-verification for tab ${n}...`), this.processVerification(n, e.answer), !0);
			}
			case "VERIFY_LATEST_ANSWER": {
				let t = e.tabId;
				if (t ||= (await this.getActiveTab())?.id, !t) throw Error("No active tab available for verification.");
				let n = await chrome.tabs.get(t).catch(() => null);
				if (this.detectPlatformFromUrl(n?.url || "") === "unsupported") throw Error("EpoClaim verification is supported on ChatGPT (chatgpt.com) and Google Gemini (gemini.google.com).");
				if (console.info(`[EpoClaim ServiceWorker] Triggering manual verification for tab: ${t}`), e.overrideAnswer) return this.processVerification(t, e.overrideAnswer), {
					initiated: !0,
					manual: !0
				};
				if (!await this.ensureContentScriptReady(t, n?.url)) throw Error("Could not connect to the page. Please refresh the ChatGPT or Gemini tab and retry.");
				let r = await chrome.tabs.sendMessage(t, { type: "VERIFY_LATEST_ANSWER" });
				if (r && r.success && r.data) return console.info(`[EpoClaim ServiceWorker] Extracted answer received from tab ${t}. Starting verification...`), this.processVerification(t, r.data), {
					initiated: !0,
					data: r.data
				};
				{
					let e = r?.error || "Could not find a completed assistant answer on the active page.";
					throw console.warn(`[EpoClaim ServiceWorker] Extraction failed on tab ${t}:`, e), Error(e);
				}
			}
			case "CLEAR_REPORT_DATA": {
				let t = e.tabId || n;
				if (t) {
					let e = await s(t);
					e && (e.lastReport = null, e.verificationState = "idle", e.errorMessage = null, await c(e), this.broadcastTabStateChange(e));
				}
				return !0;
			}
			default: return null;
		}
	}
	async toggleMonitoring(e, t) {
		let n = await s(e);
		if (!n) {
			let t = await chrome.tabs.get(e);
			n = {
				tabId: e,
				url: t.url || "",
				platform: this.detectPlatformFromUrl(t.url || ""),
				isMonitoring: !1,
				verificationState: "idle",
				lastUpdated: Date.now()
			};
		}
		let r = t === void 0 ? !n.isMonitoring : t;
		n.isMonitoring = r, n.lastUpdated = Date.now(), await c(n), this.updateBadge(e, r);
		try {
			await chrome.tabs.sendMessage(e, {
				type: "SET_MONITORING_STATE",
				tabId: e,
				isMonitoring: r
			}), console.info(`[EpoClaim ServiceWorker] Monitoring set to ${r} for tab ${e}`);
		} catch {
			if (r && chrome.scripting && chrome.scripting.executeScript) try {
				await chrome.scripting.executeScript({
					target: { tabId: e },
					files: ["content.js"]
				}), await new Promise((e) => setTimeout(e, 200)), await chrome.tabs.sendMessage(e, {
					type: "SET_MONITORING_STATE",
					tabId: e,
					isMonitoring: r
				});
			} catch (t) {
				console.warn(`[EpoClaim ServiceWorker] Failed to notify content script on tab ${e}:`, t);
			}
		}
		return this.broadcastTabStateChange(n), n;
	}
	async processVerification(e, t) {
		let n = `${e}_${t.fingerprint}`;
		if (this.inFlightVerifications.has(n)) {
			console.warn(`[EpoClaim ServiceWorker] Verification already in flight for ${n}. Skipping.`);
			return;
		}
		this.inFlightVerifications.add(n);
		let r = await s(e) || {
			tabId: e,
			url: "",
			platform: t.platform,
			isMonitoring: !0,
			verificationState: "idle",
			lastUpdated: Date.now()
		};
		r.verificationState = "verifying", r.lastFingerprint = t.fingerprint, r.lastResponseText = t.text, r.lastPrompt = t.prompt, r.errorMessage = null, r.lastUpdated = Date.now(), await c(r), this.broadcastTabStateChange(r), this.sendNotificationToTab(e, "verifying");
		try {
			let n = await o(), i = n.backendUrl || "https://epoclaim.onrender.com";
			this.apiClient.updateConfig({
				baseUrl: i,
				apiKey: n.apiKey
			}), console.info(`[EpoClaim ServiceWorker] Submitting answer to backend (${i}/api/v1/analyze)...`);
			let a = await this.apiClient.analyzeResponse({
				response_text: t.text,
				prompt: t.prompt,
				enable_live_search: n.enableLiveSearch
			});
			console.info(`[EpoClaim ServiceWorker] Verification completed. Report ID: ${a.report_id}. Claims: ${a.total_claims}`), r.verificationState = "completed", r.lastReport = a, r.lastUpdated = Date.now(), await c(r), this.sendNotificationToTab(e, "completed", a), this.broadcastTabStateChange(r);
		} catch (t) {
			let n = t instanceof Error ? t.message : String(t);
			console.error("[EpoClaim ServiceWorker] Verification failed:", n), r.verificationState = "error", r.errorMessage = n, r.lastUpdated = Date.now(), await c(r), this.sendNotificationToTab(e, "error", null, n), this.broadcastTabStateChange(r);
		} finally {
			this.inFlightVerifications.delete(n);
		}
	}
	sendNotificationToTab(e, t, n, r) {
		let i = {
			type: "STATUS_UPDATE",
			tabId: e,
			state: t,
			report: n,
			errorMessage: r
		};
		chrome.tabs.sendMessage(e, i).catch(() => {});
	}
	broadcastTabStateChange(e) {
		let t = {
			type: "TAB_STATE_CHANGED",
			state: e
		};
		chrome.runtime.sendMessage(t).catch(() => {});
	}
	updateBadge(e, t) {
		chrome.action && (t ? (chrome.action.setBadgeText({
			tabId: e,
			text: "ON"
		}), chrome.action.setBadgeBackgroundColor({
			tabId: e,
			color: "#10b981"
		})) : chrome.action.setBadgeText({
			tabId: e,
			text: ""
		}));
	}
	detectPlatformFromUrl(e) {
		try {
			let t = new URL(e);
			if (t.hostname === "chatgpt.com" || t.hostname.endsWith(".chatgpt.com") || t.hostname === "chat.openai.com" || t.hostname.endsWith(".chat.openai.com")) return "chatgpt";
			if (t.hostname === "gemini.google.com" || t.hostname.endsWith(".gemini.google.com")) return "gemini";
		} catch {}
		return "unsupported";
	}
}();
