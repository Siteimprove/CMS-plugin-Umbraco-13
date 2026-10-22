// Keep the assistant outside Umbraco's sandboxed page preview and scan only the rendered page.
(() => {
    const settings = document.querySelector("script[data-siteimprove-preview]");
    if (!settings || window.__siteimprovePreviewLoaded) return;
    window.__siteimprovePreviewLoaded = true;
    let host = window;
    try {
        if (window.frameElement?.getRootNode().host?.localName === "umb-preview"
            && window.parent.location.origin === window.location.origin) host = window.parent;
    } catch { /* Cross-origin hosts cannot own this preview's assistant. */ }
    const owner = {};
    host.__siteimprovePreviewOwner = owner;
    const si = host._si = host._si || [];
    // URL-less checks are cached by session. Each rendered preview needs its own context.
    si.push(["setSession", settings.dataset.previewSession || null, null, "Umbraco " + settings.dataset.umbracoVersion]);
    if (settings.dataset.pageUrl) si.push(["input", settings.dataset.pageUrl]);
    else si.push(["clear"]);
    si.push(["registerPrepublishCallback", () => [document, undefined, "Full page"]]);
    si.push(["onHighlight", info => {
        (host._si || si).push(["applyDefaultHighlighting", info, document]);
    }]);
    window.addEventListener("pagehide", () => {
        if (host.__siteimprovePreviewOwner !== owner) return;
        host.__siteimprovePreviewOwner = undefined;
        const current = host._si || si;
        current.push(["registerPrepublishCallback", null]);
        current.push(["onHighlight", null]);
        current.push(["clear"]);
    }, { once: true });
    if (host.__siteimprovePreviewOverlay) return;
    const overlay = host.document.createElement("script");
    host.__siteimprovePreviewOverlay = overlay;
    overlay.src = "https://cdn.siteimprove.net/cms/overlay-latest.js";
    overlay.onerror = () => {
        window.__siteimprovePreviewLoaded = false;
        if (host.__siteimprovePreviewOverlay === overlay) host.__siteimprovePreviewOverlay = undefined;
        overlay.remove();
        console.warn("Siteimprove Content Assistant could not load in this preview.");
    };
    host.document.body.appendChild(overlay);
})();
