import { setDocumentVisibility } from "./visibility.js";

export const OVERLAY_URL = "https://cdn.siteimprove.net/cms/overlay-latest.js";

export function send(command) {
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

// A single assistant serves all document workspaces. Ownership and a sequence
// number prevent late responses or an old workspace's teardown changing the page.
export class SiteimproveAssistant {
    #owner;
    #sequence = 0;
    #abort;
    #session = crypto.randomUUID();
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
    async select(owner, api, id, culture, isNew) {
        this.#owner = owner;
        this.visibility(true);
        const sequence = ++this.#sequence;
        this.#abort?.abort();
        this.#abort = new AbortController();
        // Isolate drafts before the URL request can complete or fail.
        this.#setSession(crypto.randomUUID());
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
    release(owner) {
        if (this.#owner !== owner) return;
        this.clear();
    }
    clear() {
        this.#owner = undefined;
        this.visibility(false);
        ++this.#sequence;
        this.#abort?.abort();
        this.#setSession(crypto.randomUUID());
        this.push(["clear", ""]);
    }
}
export const assistant = new SiteimproveAssistant();
