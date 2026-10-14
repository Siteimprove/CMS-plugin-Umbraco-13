import { UmbControllerBase } from "@umbraco-cms/backoffice/class-api";
import { UMB_AUTH_CONTEXT } from "@umbraco-cms/backoffice/auth";
import { SiteimproveApi } from "./api.js";
import { assistant, loadOverlay } from "./assistant.js";
import { initializeVisibility } from "./visibility.js";

let controller;
export function onInit(host) {
    // Umbraco also loads backoffice entry points in its preview shell.
    // The rendered preview iframe owns the assistant and its callbacks.
    if (host.getHostElement?.().localName === "umb-preview") return;
    initializeVisibility();
    controller?.destroy();
    controller = new UmbControllerBase(host);
    const activeController = controller;
    let authSequence = 0;
    controller.consumeContext(UMB_AUTH_CONTEXT, async auth => {
        const sequence = ++authSequence;
        if (!auth) { assistant.clear(); return; }
        try {
            const { version } = await new SiteimproveApi(auth).version();
            if (controller !== activeController || sequence !== authSequence) return;
            await loadOverlay(version);
        } catch (error) {
            if (controller === activeController && sequence === authSequence)
                console.warn("Siteimprove: " + error.message);
        }
    });
}
export function onUnload() {
    controller?.destroy();
    controller = undefined;
    assistant.clear();
}
