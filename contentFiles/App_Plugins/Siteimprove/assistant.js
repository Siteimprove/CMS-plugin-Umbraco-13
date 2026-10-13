export const OVERLAY_URL = "https://cdn.siteimprove.net/cms/overlay-latest.js";

export function send(command) {
    (window._si = window._si || []).push(command);
}

let overlayPromise;
export function loadOverlay(version) {
    if (overlayPromise) return overlayPromise;
    send(["setSession", null, null, "Umbraco " + version]);
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
    constructor(push = send, warn = message => console.warn(message)) {
        this.push = push;
        this.warn = warn;
    }
    async select(owner, api, id, culture, isNew) {
        this.#owner = owner;
        const sequence = ++this.#sequence;
        this.#abort?.abort();
        this.#abort = new AbortController();
        this.push(["clear", ""]);
        if (!id || isNew !== false) return;
        try {
            const { url } = await api.pageUrl(id, culture, this.#abort.signal);
            if (sequence === this.#sequence && this.#owner === owner && url)
                this.push(["input", url, ""]);
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
        ++this.#sequence;
        this.#abort?.abort();
        this.push(["clear", ""]);
    }
}
export const assistant = new SiteimproveAssistant();
