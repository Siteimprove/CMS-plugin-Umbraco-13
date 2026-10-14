const MODAL_ATTRIBUTE = "data-siteimprove-non-content-modal";
const ACTIVE_ATTRIBUTE = "data-siteimprove-document-active";

export function initializeVisibility() {
    if (document.querySelector("style[data-siteimprove-visibility]")) return;
    const style = document.createElement("style");
    style.dataset.siteimproveVisibility = "";
    // Scope both the launcher and an already-open panel to a document workspace.
    style.textContent = `html:not([${ACTIVE_ATTRIBUTE}]) .si-toggle-container,
        html:not([${ACTIVE_ATTRIBUTE}]) .si-iframe-container,
        html[${MODAL_ATTRIBUTE}] .si-toggle-container,
        html[${MODAL_ATTRIBUTE}] .si-iframe-container { display: none !important; }`;
    document.head.appendChild(style);
}

export function setDocumentVisibility(visible) {
    initializeVisibility();
    document.documentElement.toggleAttribute(ACTIVE_ATTRIBUTE, visible);
}

export function setWorkspaceModalVisibility(modals) {
    initializeVisibility();
    // The innermost workspace determines whether the overlay has content to inspect.
    const workspace = [...modals].reverse().find(modal => modal.alias?.toString() === "Umb.Modal.Workspace");
    document.documentElement.toggleAttribute(MODAL_ATTRIBUTE,
        !!workspace && workspace.data?.entityType !== "document");
}
