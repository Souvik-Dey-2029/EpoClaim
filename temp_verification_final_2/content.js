(function(){function e(e){if(!e)return``;let t=e.normalize(`NFC`).replace(/[\u00A0\u1680\u2000-\u200B\u202F\u205F\u3000\uFEFF]/g,` `).replace(/\r\n/g,`
`).replace(/\r/g,`
`);return t=t.replace(/\n{3,}/g,`

`),t=t.split(`
`).map(e=>e.trimEnd()).join(`
`),t.trim()}function t(t){let n=e(t);if(!n)return`empty`;let r=3735928559^n.length,i=1103515245^n.length;for(let e=0;e<n.length;e++){let t=n.charCodeAt(e);r=Math.imul(r^t,2654435761),i=Math.imul(i^t,1597334677)}return r=Math.imul(r^r>>>16,2246822507)^Math.imul(i^i>>>13,3266489909),i=Math.imul(i^i>>>16,2246822507)^Math.imul(r^r>>>13,3266489909),`${(r>>>0).toString(16).padStart(8,`0`)}${(i>>>0).toString(16).padStart(8,`0`)}`}function n(e){switch(e){case`SUPPORTED`:return`Supported`;case`PARTIALLY_SUPPORTED`:return`Partially Supported`;case`CONTRADICTED`:return`Contradicted`;case`OUTDATED`:return`Outdated / Stale`;case`INSUFFICIENT_EVIDENCE`:return`Insufficient Evidence`;case`CONFLICTING`:return`Conflicting Evidence`;case`UNVERIFIED`:return`Unverified`;default:return e||`Unknown`}}function r(e){switch(e){case`SUPPORTED`:return{color:`#34d399`,bg:`rgba(16, 185, 129, 0.16)`,border:`rgba(52, 211, 153, 0.4)`};case`PARTIALLY_SUPPORTED`:return{color:`#fbbf24`,bg:`rgba(245, 158, 11, 0.16)`,border:`rgba(251, 191, 36, 0.4)`};case`CONTRADICTED`:return{color:`#f87171`,bg:`rgba(239, 68, 68, 0.16)`,border:`rgba(248, 113, 113, 0.4)`};case`OUTDATED`:return{color:`#fb923c`,bg:`rgba(249, 115, 22, 0.16)`,border:`rgba(251, 146, 60, 0.4)`};default:return{color:`#d6c7a9`,bg:`rgba(214, 199, 169, 0.14)`,border:`rgba(214, 199, 169, 0.35)`}}}var i=class{extractFormattedTextFromNode(e,t=[]){if(!e)return``;if(e.nodeType===Node.ELEMENT_NODE){let n=e;for(let e of t)if(n.matches(e)||n.closest(e))return``}if(e.nodeType===Node.TEXT_NODE)return e.textContent||``;if(e.nodeType!==Node.ELEMENT_NODE)return``;let n=e,r=n.tagName.toUpperCase();if(n.getAttribute(`aria-hidden`)===`true`||n.classList.contains(`sr-only`)||n.style.display===`none`||n.style.visibility===`hidden`)return``;if(r===`PRE`||r===`CODE`)return n.innerText||n.textContent||``;let i=``;r===`LI`&&(i+=`• `);for(let e=0;e<n.childNodes.length;e++)i+=this.extractFormattedTextFromNode(n.childNodes[e],t);return r===`P`||r===`DIV`||r===`LI`||r===`H1`||r===`H2`||r===`H3`||r===`H4`||r===`H5`||r===`H6`||r===`TR`||r===`BLOCKQUOTE`?i+=`

`:r===`BR`&&(i+=`
`),i}normalize(t){return e(t)}},a=class extends i{platformId=`chatgpt`;platformName=`ChatGPT`;NOISE_SELECTORS=[`button[data-testid*='copy']`,`button[aria-label*='Copy' i]`,`button[data-testid*='good-response']`,`button[aria-label*='Good response' i]`,`button[data-testid*='bad-response']`,`button[aria-label*='Bad response' i]`,`button[data-testid*='read-aloud']`,`button[aria-label*='Read aloud' i]`,`button[data-testid*='regenerate']`,`button[aria-label*='Regenerate' i]`,`button[data-testid*='edit']`,`button[aria-label*='Edit' i]`,`div[data-testid*='turn-actions']`,`div[class*='turn-actions']`,`div[class*='agent-turn-actions']`,`div[class*='text-gray-400'][class*='flex']`,`.sr-only`,`svg`];isMatchingUrl(e){try{let t=new URL(e);return t.hostname===`chatgpt.com`||t.hostname.endsWith(`.chatgpt.com`)||t.hostname===`chat.openai.com`||t.hostname.endsWith(`.chat.openai.com`)}catch{return!1}}getConversationContainer(){return document.body}isUserMessageElement(e){if(e.getAttribute(`data-message-author-role`)===`user`||e.getAttribute(`data-message-role`)===`user`||e.querySelector(`[data-message-author-role='user'], [data-message-role='user']`)&&!e.querySelector(`[data-message-author-role='assistant'], [data-message-role='assistant']`)||e.querySelector(`button[aria-label*='Edit' i], button[data-testid*='edit']`)&&!e.querySelector(`button[data-testid*='copy'], button[aria-label*='Copy' i]`))return!0;let t=e.getAttribute(`data-testid`)||``;return!!(t.includes(`user-message`)||t.includes(`user-turn`)||e.classList.contains(`user-message`)||e.classList.contains(`user-turn`))}isAssistantTurn(e){return!this.isUserMessageElement(e)&&!!(e.getAttribute(`data-message-author-role`)===`assistant`||e.getAttribute(`data-message-role`)===`assistant`||e.querySelector(`[data-message-author-role='assistant'], [data-message-role='assistant']`)||e.querySelector(`button[data-testid*='copy'], button[aria-label*='Copy' i]`)||e.querySelector(`button[data-testid*='good-response'], button[aria-label*='Good response' i]`)||e.querySelector(`button[data-testid*='bad-response'], button[aria-label*='Bad response' i]`)||e.querySelector(`.markdown, [class*='markdown'], .prose, [class*='prose'], div[class*='text-message']`)||e.classList.contains(`markdown`)||e.classList.contains(`prose`)||e.getAttribute(`class`)?.includes(`markdown`))}getAssistantMessages(){let e=[],t=new Set,n=n=>{n&&!t.has(n)&&(this.isUserMessageElement(n)||(t.add(n),e.push(n)))};document.querySelectorAll(`[data-message-author-role='assistant'], [data-message-role='assistant'], [data-role='assistant']`).forEach(e=>n(e));let r=e.filter(e=>this.extractMessageContent(e).length>=5);return r.length===0&&(document.querySelectorAll(`article[data-testid*='conversation-turn'], div[data-testid*='conversation-turn'], [data-testid^='conversation-turn-'], article, div[class*='conversation-turn']`).forEach(e=>{this.isAssistantTurn(e)&&n(e)}),r=e.filter(e=>this.extractMessageContent(e).length>=5)),r.length===0&&(document.querySelectorAll(`button[data-testid*='copy'], button[aria-label*='Copy' i], button[data-testid*='good-response'], button[aria-label*='Good response' i], button[data-testid*='bad-response'], button[aria-label*='Bad response' i], button[data-testid*='read-aloud'], button[aria-label*='Read aloud' i]`).forEach(e=>{let t=e.closest(`article`)||e.closest(`[data-testid*='conversation-turn']`)||e.closest(`.group`)||e.closest(`div[class*='w-full']`)||e.parentElement?.parentElement;t&&this.isAssistantTurn(t)&&n(t)}),r=e.filter(e=>this.extractMessageContent(e).length>=5)),r.length===0&&(document.querySelectorAll(`main .markdown, main [class*='markdown'], main .prose, main [class*='prose'], div[class*='text-message']`).forEach(e=>{this.isUserMessageElement(e)||n(e)}),r=e.filter(e=>this.extractMessageContent(e).length>=5)),console.info(`[EpoClaim Adapter] Assistant containers found: ${e.length}, Candidates after filtering: ${r.length}`),r}getLatestAssistantMessage(){let e=this.getAssistantMessages();if(e.length===0)return null;let t=e[e.length-1];return console.info(`[EpoClaim Adapter] Selected latest assistant message index: ${e.length-1}`),t}isStreaming(e){if(document.querySelector(`button[data-testid='stop-button'], button[aria-label='Stop generating' i], button[aria-label='Stop streaming' i]`))return!0;let t=e||this.getLatestAssistantMessage();return t&&(t.classList.contains(`result-streaming`)||t.classList.contains(`streaming`)||t.getAttribute(`data-is-streaming`)===`true`||t.querySelector(`.result-streaming, .streaming, [data-is-streaming='true']`)||t.querySelector(`span.result-cursor, span[class*='result-cursor'], span[class*='streaming-cursor'], span.cursor-blink, span[data-testid='cursor'], .result-thinking, span[class*='thinking-pulse']`))?!0:(document.querySelector(`button[data-testid='send-button'], button[aria-label='Send prompt' i], button[aria-label='Send message' i]`),!1)}extractMessageContent(e){if(!e)return``;let t=(e.querySelector(`.markdown.prose`)||e.querySelector(`.markdown`)||e.querySelector(`[class*='markdown']`)||e.querySelector(`.prose`)||e.querySelector(`[class*='prose']`)||e.querySelector(`div[class*='text-message']`)||e.querySelector(`div.whitespace-pre-wrap`)||(e.classList.contains(`markdown`)?e:null)||e).cloneNode(!0);for(let e of this.NOISE_SELECTORS)try{t.querySelectorAll(e).forEach(e=>e.remove())}catch{}t.querySelectorAll(`br`).forEach(e=>{try{typeof e.replaceWith==`function`&&e.replaceWith(document.createTextNode(`
`))}catch{}}),t.querySelectorAll(`p, h1, h2, h3, h4, h5, h6, li, pre, blockquote, tr`).forEach(e=>{try{typeof e.prepend==`function`&&e.prepend(document.createTextNode(`
`)),typeof e.append==`function`&&e.append(document.createTextNode(`
`))}catch{}});let n=``;n=typeof t.innerText==`string`&&t.innerText.trim().length>0?t.innerText:t.textContent||``;let r=this.normalize(n);return r.length>=5&&console.info(`[EpoClaim Adapter] Extracted character count: ${r.length}, First 100 characters preview: "${r.slice(0,100).replace(/\n/g,` `)}..."`),r}getAssociatedPrompt(e){try{let t=e.closest(`article`)||e.closest(`[data-testid*='conversation-turn']`)||e.parentElement;if(!t)return;let n=t.previousElementSibling;for(;n;){if(this.isUserMessageElement(n)){let e=n.querySelector(`[data-message-author-role='user']`)||n.querySelector(`.whitespace-pre-wrap`)||n.querySelector(`div[class*='text-message']`)||n,t=e.innerText||e.textContent||``,r=this.normalize(t);if(r.length>0)return r}n=n.previousElementSibling}let r=Array.from(document.querySelectorAll(`[data-message-author-role='user'], [data-message-role='user'], article[data-testid*='user'], div[data-testid*='user']`));for(let t=r.length-1;t>=0;t--){let n=r[t];if(n.compareDocumentPosition(e)&Node.DOCUMENT_POSITION_FOLLOWING){let e=n.innerText||n.textContent||``,t=this.normalize(e);if(t.length>0)return t}}}catch{}}},o=class extends i{platformId=`gemini`;platformName=`Google Gemini`;IGNORED_SELECTORS=[`button`,`mat-icon`,`.response-footer`,`.footer-actions`,`.draft-selector`,`.sources-list`,`model-response-footer`,`.action-button-container`,`[aria-hidden='true']`,`.sr-only`,`svg`];isMatchingUrl(e){try{let t=new URL(e);return t.hostname===`gemini.google.com`||t.hostname.endsWith(`.gemini.google.com`)}catch{return!1}}getConversationContainer(){return document.body}getAssistantMessages(){let e=Array.from(document.querySelectorAll(`model-response, response-container`));return e.length===0&&(e=Array.from(document.querySelectorAll(`div.model-response-text, div[class*='response-container']`))),e.length===0&&(e=Array.from(document.querySelectorAll(`message-content, .presented-response`)).filter(e=>!e.closest(`user-query, .user-query`))),e}getLatestAssistantMessage(){let e=this.getAssistantMessages();return e.length>0?e[e.length-1]:null}isStreaming(e){if(document.querySelector(`button[aria-label*='Stop'], button[aria-label*='stop generating'], button[data-test-id='stop-button']`)||document.querySelector(`mat-progress-bar`)||document.querySelector(`.sparkle-animating`)||document.querySelector(`.loading-indicator`))return!0;let t=e||this.getLatestAssistantMessage();return!!(t&&(t.getAttribute(`is-generating`)===`true`||t.classList.contains(`is-generating`)||t.classList.contains(`streaming`)||t.querySelector(`.loading, .generating`)))}extractMessageContent(e){if(!e)return``;let t=(e.querySelector(`message-content`)||e.querySelector(`.model-response-text`)||e.querySelector(`.presented-response`)||e.querySelector(`.response-content`)||e.querySelector(`.markdown`)||e).cloneNode(!0);for(let e of this.IGNORED_SELECTORS)try{t.querySelectorAll(e).forEach(e=>e.remove())}catch{}let n=typeof t.innerText==`string`&&t.innerText.trim().length>0?t.innerText:t.textContent||``;return this.normalize(n)}getAssociatedPrompt(e){try{let t=e.closest(`model-response`)||e.parentElement;if(!t)return;let n=t.previousElementSibling;for(;n;){let e=n.tagName===`USER-QUERY`?n:n.querySelector(`user-query, .user-query, div[class*='user-query']`);if(e){let t=e.cloneNode(!0);for(let e of this.IGNORED_SELECTORS)t.querySelectorAll(e).forEach(e=>e.remove());return this.normalize(t.innerText||t.textContent||``)}n=n.previousElementSibling}}catch{}}},s=class{static adapters=[new a,new o];static getAdapterForUrl(e){for(let t of this.adapters)if(t.isMatchingUrl(e))return t;return null}static registerAdapter(e){this.adapters.push(e)}},c=class{adapter;observer=null;debounceTimer=null;lastFingerprint=null;isObserving=!1;debounceMs;stabilityCheckMs;onCompletedAnswer;constructor(e,t,n={}){this.adapter=e,this.onCompletedAnswer=t,this.debounceMs=n.debounceMs??900,this.stabilityCheckMs=n.stabilityCheckMs??500}start(){if(this.isObserving)return!0;let e=this.adapter.getConversationContainer();return e?(this.observer=new MutationObserver(()=>this.handleMutation()),this.observer.observe(e,{childList:!0,subtree:!0,characterData:!0}),this.isObserving=!0,console.info(`[EpoClaim Observer] Started monitoring ${this.adapter.platformName} conversation.`),!0):(console.warn(`[EpoClaim Observer] Conversation container not found yet. Retrying in 1s...`),setTimeout(()=>{this.isObserving||this.start()},1e3),!1)}stop(){this.observer&&=(this.observer.disconnect(),null),this.debounceTimer!==null&&(clearTimeout(this.debounceTimer),this.debounceTimer=null),this.isObserving=!1,console.info(`[EpoClaim Observer] Stopped monitoring ${this.adapter.platformName}.`)}isActive(){return this.isObserving}resetFingerprint(){this.lastFingerprint=null}handleMutation(){this.isObserving&&(this.debounceTimer!==null&&clearTimeout(this.debounceTimer),this.debounceTimer=window.setTimeout(()=>{this.debounceTimer=null,this.evaluateLatestAnswer(!1)},this.debounceMs))}async evaluateLatestAnswer(e=!1){let n=this.adapter.getAssistantMessages(),r=n.length>0?n[n.length-1]:null;if(!r)return console.warn(`[EpoClaim Observer] No assistant message candidate found after filtering.`),null;if(console.info(`[EpoClaim Observer] Selected latest assistant candidate (index ${n.length-1} of ${n.length}).`),!e&&this.adapter.isStreaming(r))return console.info(`[EpoClaim Observer] Generation still in progress (streaming detected).`),this.isObserving&&(this.debounceTimer=window.setTimeout(()=>{this.debounceTimer=null,this.evaluateLatestAnswer(!1)},this.debounceMs)),null;let i=this.adapter.extractMessageContent(r);if(!i||i.length<5)return console.warn(`[EpoClaim Observer] Extracted snapshot is empty or too short (< 5 chars). Length:`,i?.length),null;if(!e&&(await new Promise(e=>setTimeout(e,this.stabilityCheckMs)),this.adapter.isStreaming(r)||i!==this.adapter.extractMessageContent(r)))return null;let a=t(i);if(!e&&this.lastFingerprint===a)return null;this.lastFingerprint=a;let o=this.adapter.getAssociatedPrompt(r),s={platform:this.adapter.platformId,prompt:o,text:i,fingerprint:a,timestamp:Date.now()};return console.info(`[EpoClaim Observer] Completed answer confirmed (fp: ${a.slice(0,8)}..., length: ${i.length} chars, manual: ${e}).`),e||this.onCompletedAnswer(s),s}},l=class{hostElement=null;shadowRoot=null;autoDismissTimer=null;callbacks;constructor(e){this.callbacks=e}show(e,t,n){this.clearAutoDismiss(),this.hostElement||(this.hostElement=document.createElement(`div`),this.hostElement.id=`epoclaim-notification-host`,this.hostElement.style.cssText=`all: initial; position: fixed; bottom: 24px; right: 24px; z-index: 2147483647;`,document.documentElement.appendChild(this.hostElement),this.shadowRoot=this.hostElement.attachShadow({mode:`closed`})),this.shadowRoot&&(this.render(e,t,n),(e===`completed`||e===`error`)&&(this.autoDismissTimer=window.setTimeout(()=>{this.dismiss()},15e3)))}dismiss(){this.clearAutoDismiss(),this.hostElement&&this.hostElement.parentElement&&this.hostElement.parentElement.removeChild(this.hostElement),this.hostElement=null,this.shadowRoot=null,this.callbacks.onDismiss()}clearAutoDismiss(){this.autoDismissTimer!==null&&(clearTimeout(this.autoDismissTimer),this.autoDismissTimer=null)}render(e,t,i){if(!this.shadowRoot)return;this.shadowRoot.replaceChildren();let a=document.createElement(`style`);a.textContent=`
      :host {
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
        font-size: 13px;
        line-height: 1.45;
        color: #f2e8d2;
      }
      .epoclaim-card {
        width: 320px;
        background: rgba(9, 39, 29, 0.95);
        border: 1px solid rgba(52, 211, 153, 0.35);
        border-radius: 12px;
        padding: 14px 16px;
        box-shadow: 0 10px 30px rgba(0, 0, 0, 0.55), 0 0 12px rgba(52, 211, 153, 0.15);
        backdrop-filter: blur(16px);
        -webkit-backdrop-filter: blur(16px);
        box-sizing: border-box;
        display: flex;
        flex-direction: column;
        gap: 10px;
        animation: enterSlide 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards;
      }
      @keyframes enterSlide {
        from { opacity: 0; transform: translateY(16px); }
        to { opacity: 1; transform: translateY(0); }
      }
      .card-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
      }
      .brand-title {
        display: flex;
        align-items: center;
        gap: 6px;
        font-weight: 700;
        font-size: 13px;
        color: #f2e8d2;
        letter-spacing: 0.02em;
      }
      .brand-dot {
        width: 8px;
        height: 8px;
        border-radius: 50%;
        background: #34d399;
        box-shadow: 0 0 8px #34d399;
      }
      .brand-dot.pulse {
        animation: pulseDot 1.4s infinite ease-in-out;
      }
      @keyframes pulseDot {
        0%, 100% { opacity: 1; transform: scale(1); }
        50% { opacity: 0.4; transform: scale(0.85); }
      }
      .btn-close {
        background: none;
        border: none;
        color: #a8a29e;
        cursor: pointer;
        font-size: 16px;
        line-height: 1;
        padding: 2px 4px;
        border-radius: 4px;
      }
      .btn-close:hover {
        color: #ffffff;
        background: rgba(255, 255, 255, 0.1);
      }
      .status-body {
        display: flex;
        flex-direction: column;
        gap: 6px;
      }
      .status-text {
        font-size: 12.5px;
        color: #d6c7a9;
      }
      .verdict-chip {
        display: inline-flex;
        align-items: center;
        gap: 5px;
        padding: 3px 8px;
        border-radius: 6px;
        font-size: 11px;
        font-weight: 700;
        letter-spacing: 0.05em;
        text-transform: uppercase;
        align-self: flex-start;
      }
      .metrics-row {
        display: flex;
        align-items: center;
        gap: 8px;
        font-size: 11.5px;
        color: #a8a29e;
        flex-wrap: wrap;
      }
      .metric-badge {
        font-weight: 600;
      }
      .metric-badge.green { color: #34d399; }
      .metric-badge.red { color: #f87171; }
      .metric-badge.amber { color: #fbbf24; }
      .btn-action {
        appearance: none;
        -webkit-appearance: none;
        background: rgba(16, 185, 129, 0.18);
        border: 1px solid rgba(52, 211, 153, 0.45);
        color: #34d399;
        font-weight: 600;
        font-size: 12px;
        padding: 6px 12px;
        border-radius: 6px;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 6px;
        transition: all 0.2s ease;
      }
      .btn-action:hover {
        background: rgba(16, 185, 129, 0.32);
        color: #6ee7b7;
        border-color: rgba(52, 211, 153, 0.7);
        transform: translateY(-1px);
      }
    `,this.shadowRoot.appendChild(a);let o=document.createElement(`div`);o.className=`epoclaim-card`;let s=document.createElement(`div`);s.className=`card-header`;let c=document.createElement(`div`);c.className=`brand-title`;let l=document.createElement(`span`);l.className=e===`verifying`||e===`detecting`?`brand-dot pulse`:`brand-dot`,c.appendChild(l);let u=document.createElement(`span`);u.textContent=`EpoClaim`,c.appendChild(u),s.appendChild(c);let d=document.createElement(`button`);d.className=`btn-close`,d.setAttribute(`aria-label`,`Dismiss notification`),d.textContent=`×`,d.onclick=()=>this.dismiss(),s.appendChild(d),o.appendChild(s);let f=document.createElement(`div`);if(f.className=`status-body`,e===`detecting`){let e=document.createElement(`div`);e.className=`status-text`,e.textContent=`New AI response detected.`,f.appendChild(e)}else if(e===`verifying`){let e=document.createElement(`div`);e.className=`status-text`,e.textContent=`Verifying temporal freshness & facts...`,f.appendChild(e)}else if(e===`error`){let e=document.createElement(`div`);e.className=`status-text`,e.style.color=`#f87171`,e.textContent=i||`Verification could not be completed. Please check backend.`,f.appendChild(e)}else if(e===`completed`&&t){let e=`SUPPORTED`;t.contradicted_claims>0?e=`CONTRADICTED`:t.outdated_claims>0?e=`OUTDATED`:t.partially_supported_claims>0?e=`PARTIALLY_SUPPORTED`:(t.unverified_claims>0||t.insufficient_evidence_claims>0)&&(e=`UNVERIFIED`);let i=r(e),a=document.createElement(`span`);a.className=`verdict-chip`,a.style.color=i.color,a.style.backgroundColor=i.bg,a.style.border=`1px solid ${i.border}`,a.textContent=n(e),f.appendChild(a);let o=document.createElement(`div`);o.className=`metrics-row`;let s=document.createElement(`span`);if(s.textContent=`${t.total_claims} claims evaluated`,o.appendChild(s),t.contradicted_claims>0){let e=document.createElement(`span`);e.className=`metric-badge red`,e.textContent=`• ${t.contradicted_claims} refuted`,o.appendChild(e)}if(t.outdated_claims>0){let e=document.createElement(`span`);e.className=`metric-badge amber`,e.textContent=`• ${t.outdated_claims} outdated`,o.appendChild(e)}if(t.supported_claims>0){let e=document.createElement(`span`);e.className=`metric-badge green`,e.textContent=`• ${t.supported_claims} supported`,o.appendChild(e)}f.appendChild(o);let c=document.createElement(`button`);c.className=`btn-action`,c.textContent=`View Full Analysis ➔`,c.onclick=()=>{this.callbacks.onOpenSidePanel(),this.dismiss()},f.appendChild(c)}o.appendChild(f),this.shadowRoot.appendChild(o)}},u=window,d=class{observer=null;notification=null;currentPlatform=`unsupported`;isDestroyed=!1;init(){let e=s.getAdapterForUrl(window.location.href);if(!e)return;this.currentPlatform=e.platformId,console.info(`[EpoClaim Content] Initialized for ${e.platformName} (${window.location.origin}).`),this.notification=new l({onOpenSidePanel:()=>{this.safeSendMessage({type:`OPEN_SIDE_PANEL`})},onDismiss:()=>{}}),this.observer=new c(e,e=>this.handleCompletedAnswer(e));let t={type:`CONTENT_SCRIPT_INITIALIZED`,platform:e.platformId,url:window.location.href};this.safeSendMessage(t,e=>{e&&e.success&&e.data&&e.data.isMonitoring&&!this.isDestroyed&&(console.info(`[EpoClaim Content] Tab monitoring is active in session. Starting observer.`),this.observer?.start())}),chrome.runtime.onMessage.addListener((e,t,n)=>(this.handleIncomingMessage(e,n),!0))}safeSendMessage(e,t){if(!this.isDestroyed)try{if(typeof chrome>`u`||!chrome.runtime||!chrome.runtime.id){this.destroy();return}chrome.runtime.sendMessage(e,e=>{if(chrome.runtime?.lastError){let e=chrome.runtime.lastError.message||``;(e.includes(`context invalidated`)||e.includes(`Receiving end does not exist`))&&this.destroy()}else t&&t(e)})}catch(e){String(e).includes(`context invalidated`)&&this.destroy()}}destroy(){this.isDestroyed||(this.isDestroyed=!0,this.observer&&=(this.observer.stop(),null),this.notification&&=(this.notification.dismiss(),null),u.__EPOCLAIM_CONTENT_INITIALIZED__=!1)}handleIncomingMessage(e,t){if(this.isDestroyed)t({success:!1,error:`Content script destroyed.`});else switch(e.type){case`PING`:case`CONTENT_SCRIPT_PING`:t({success:!0,data:{status:`PONG`,platform:this.currentPlatform,ready:!0}});break;case`SET_MONITORING_STATE`:e.isMonitoring?(this.observer?.start(),console.info(`[EpoClaim Content] Monitoring enabled for this tab.`)):(this.observer?.stop(),this.notification?.dismiss(),console.info(`[EpoClaim Content] Monitoring paused for this tab.`)),t({success:!0,data:{isMonitoring:e.isMonitoring}});break;case`VERIFY_LATEST_ANSWER`:if(console.info(`[EpoClaim Content] Received manual verify latest answer request.`),!this.observer){let e=s.getAdapterForUrl(window.location.href);e&&(this.observer=new c(e,e=>this.handleCompletedAnswer(e)))}if(!this.observer){t({success:!1,error:`No compatible adapter available for this page.`});break}this.observer.evaluateLatestAnswer(!0).then(e=>{e&&e.text&&e.text.trim().length>=5?(console.info(`[EpoClaim Content] Manual extraction successful (${e.text.length} chars, fp: ${e.fingerprint.slice(0,8)}).`),t({success:!0,data:e})):(console.warn(`[EpoClaim Content] Manual extraction found no eligible assistant message.`),t({success:!1,error:`Could not find a completed assistant message on the page.`}))}).catch(e=>{console.error(`[EpoClaim Content] Evaluation error:`,e),t({success:!1,error:String(e)})});break;case`STATUS_UPDATE`:this.notification&&this.notification.show(e.state,e.report,e.errorMessage),t({success:!0});break;default:t({success:!0})}}handleCompletedAnswer(e){if(this.isDestroyed)return;this.notification?.show(`verifying`);let t={type:`ANSWER_DETECTED`,answer:e};this.safeSendMessage(t)}};u.__EPOCLAIM_CONTENT_INITIALIZED__||(u.__EPOCLAIM_CONTENT_INITIALIZED__=!0,new d().init())})();