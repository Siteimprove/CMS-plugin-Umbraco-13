const ACTIVE_ATTRIBUTE = "data-siteimprove-document-active";

export function initializeVisibility() {
    if (document.querySelector("style[data-siteimprove-visibility]")) return;
    const style = document.createElement("style");
    style.dataset.siteimproveVisibility = "";
    // Scope both the launcher and an already-open panel to a document workspace.
    style.textContent = `html:not([${ACTIVE_ATTRIBUTE}]) .si-toggle-container,
        html:not([${ACTIVE_ATTRIBUTE}]) .si-iframe-container { display: none !important; }`;
    document.head.appendChild(style);
}

export function setDocumentVisibility(visible) {
    initializeVisibility();
    document.documentElement.toggleAttribute(ACTIVE_ATTRIBUTE, visible);
}
