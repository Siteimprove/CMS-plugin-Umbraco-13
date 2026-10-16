import { setDocumentVisibility } from "./visibility.js";

const OVERLAY_URL = "https://cdn.siteimprove.net/cms/overlay-latest.js";

// randomUUID requires HTTPS; getRandomValues also works on HTTP backoffices.
function newResultSession() {
    if (crypto.randomUUID) return crypto.randomUUID();
    const bytes = crypto.getRandomValues(new Uint8Array(16));
    bytes[6] = (bytes[6] & 15) | 64;
    bytes[8] = (bytes[8] & 63) | 128;
    const hex = Array.from(bytes, byte => byte.toString(16).padStart(2, "0")).join("");
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function send(command) {
    (window._si = window._si || []).push(command);
}

let overlayPromise;
export function loadOverlay(version) {
    if (overlayPromise) return overlayPromise;
    assistant.initialize(version);
    overlayPromise = new Promise((resolve, reject) => {
        const script = document.createElement("script");
        script.src = OVERLAY_URL;
        script.dataset.siteimproveOverlay = "";
        const timer = setTimeout(() => {
            script.remove();
            reject(new Error("Siteimprove Content Assistant timed out."));
        }, 15000);
        script.onload = () => { clearTimeout(timer); resolve(); };
        script.onerror = () => {
            clearTimeout(timer);
            script.remove();
            reject(new Error("Siteimprove Content Assistant could not load."));
        };
        document.body.appendChild(script);
    }).catch(error => { overlayPromise = undefined; throw error; });
    return overlayPromise;
}

// Workspaces retain their nesting order while the shared assistant follows the
// newest eligible workspace. A sequence number rejects responses after a switch.
export class SiteimproveAssistant {
    #workspaces = new Map();
    #owner;
    #sequence = 0;
    #abort;
    #session = newResultSession();
    #plugin = "Umbraco";
    constructor(push = send, warn = message => console.warn(message), visibility = setDocumentVisibility) {
        this.push = push;
        this.warn = warn;
        this.visibility = visibility;
    }
    initialize(version) {
        this.#plugin = "Umbraco " + version;
        this.#setSession(this.#session);
    }
    #setSession(id) {
        this.#session = id;
        this.push(["setSession", id, null, this.#plugin]);
    }
    register(owner, isEligible = () => true) {
        if (!this.#workspaces.has(owner)) this.#workspaces.set(owner, { isEligible });
    }
    async select(owner, api, id, culture, isNew) {
        this.register(owner);
        const selection = { api, id, culture, isNew };
        this.#workspaces.get(owner).selection = selection;
        // Parent updates are retained without taking focus from an open child.
        if (this.#currentWorkspace()?.[0] !== owner) return;
        return this.#activate(owner, selection);
    }
    #currentWorkspace() {
        const entry = [...this.#workspaces].findLast(([, state]) => state.selection && state.isEligible());
        return entry && [entry[0], entry[1].selection];
    }
    async #activate(owner, { api, id, culture, isNew }) {
        this.#owner = owner;
        this.visibility(true);
        const sequence = ++this.#sequence;
        this.#abort?.abort();
        this.#abort = new AbortController();
        // Isolate drafts before the URL request can complete or fail.
        this.#setSession(newResultSession());
        this.push(["clear", ""]);
        if (!id || isNew !== false) return;
        try {
            const { url } = await api.pageUrl(id, culture, this.#abort.signal);
            if (sequence === this.#sequence && this.#owner === owner && url) {
                this.#setSession(null);
                this.push(["input", url, ""]);
            }
        } catch (error) {
            if (sequence === this.#sequence && error.name !== "AbortError")
                this.warn("Siteimprove: " + error.message);
        }
    }
    suspend(owner) {
        if (!this.#workspaces.has(owner)) return;
        this.#workspaces.get(owner).selection = undefined;
        if (this.#owner === owner) return this.#restore();
    }
    release(owner) {
        this.#workspaces.delete(owner);
        if (this.#owner === owner) return this.#restore();
    }
    #restore() {
        const parent = this.#currentWorkspace();
        return parent ? this.#activate(...parent) : this.#reset();
    }
    clear() {
        // Keep registration order across sign-in, but discard every cached page.
        for (const state of this.#workspaces.values()) state.selection = undefined;
        this.#reset();
    }
    #reset() {
        this.#owner = undefined;
        this.visibility(false);
        ++this.#sequence;
        this.#abort?.abort();
        this.#setSession(newResultSession());
        this.push(["clear", ""]);
    }
}
export const assistant = new SiteimproveAssistant();
