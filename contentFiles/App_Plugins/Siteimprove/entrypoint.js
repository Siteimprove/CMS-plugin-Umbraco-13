import { UmbControllerBase } from "@umbraco-cms/backoffice/class-api";
import { UMB_AUTH_CONTEXT } from "@umbraco-cms/backoffice/auth";
import { SiteimproveApi } from "./api.js";
import { assistant, loadOverlay } from "./assistant.js";

let controller;
export function onInit(host) {
    // Umbraco also loads backoffice entry points in its preview shell.
    // The rendered preview iframe owns the assistant and its callbacks.
    if (host.getHostElement?.().localName === "umb-preview") return;
    controller?.destroy();
    controller = new UmbControllerBase(host);
    controller.consumeContext(UMB_AUTH_CONTEXT, async auth => {
        if (!auth) return;
        try {
            const { version } = await new SiteimproveApi(auth).version();
            await loadOverlay(version);
        } catch (error) {
            console.warn("Siteimprove: " + error.message);
        }
    });
}
export function onUnload() {
    controller?.destroy();
    controller = undefined;
    assistant.clear();
}
