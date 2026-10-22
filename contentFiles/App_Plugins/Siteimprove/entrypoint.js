import { UmbControllerBase } from "@umbraco-cms/backoffice/class-api";
import { UMB_MODAL_MANAGER_CONTEXT } from "@umbraco-cms/backoffice/modal";
import { UMB_AUTH_CONTEXT } from "@umbraco-cms/backoffice/auth";
import { SiteimproveApi } from "./api.js?v=1.0.0";
import { assistant, loadOverlay } from "./assistant.js?v=1.0.0";
import { initializeVisibility, setWorkspaceModalVisibility } from "./visibility.js?v=1.0.0";

let controller;
export function onInit(host) {
    // Umbraco also loads backoffice entry points in its preview shell.
    // The rendered page initializes the preview assistant with its own document callback.
    if (host.getHostElement?.().localName === "umb-preview") return;
    initializeVisibility();
    controller?.destroy();
    controller = new UmbControllerBase(host);
    const activeController = controller;
    let activeModals;
    controller.consumeContext(UMB_MODAL_MANAGER_CONTEXT, manager => {
        if (controller !== activeController) return;
        activeModals = manager;
        setWorkspaceModalVisibility([]);
        if (manager) activeController.observe(manager.modals, modals => {
            if (controller === activeController && activeModals === manager)
                setWorkspaceModalVisibility(modals);
        }, "siteimprove-workspace-modals");
    });
    let authSequence = 0;
    let activeAuth;
    controller.consumeContext(UMB_AUTH_CONTEXT, auth => {
        if (controller !== activeController) return;
        activeAuth = auth;
        ++authSequence;
        if (!auth) { assistant.clear(); return; }
        return activeController.observe(auth.isAuthorized, async authorized => {
            if (controller !== activeController || activeAuth !== auth) return;
            const sequence = ++authSequence;
            if (!authorized) { assistant.clear(); return; }
            try {
                const { version } = await new SiteimproveApi(auth).version();
                if (controller !== activeController || sequence !== authSequence) return;
                await loadOverlay(version);
            } catch (error) {
                if (controller === activeController && sequence === authSequence)
                    console.warn("Siteimprove: " + error.message);
            }
        }, "siteimprove-auth");
    });
}
export function onUnload() {
    controller?.destroy();
    controller = undefined;
    assistant.clear();
    setWorkspaceModalVisibility([]);
}
