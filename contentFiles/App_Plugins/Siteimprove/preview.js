// Classic deferred script: runs in the rendered preview window, outside the backoffice.
(() => {
    const settings = document.querySelector("script[data-siteimprove-preview]");
    if (!settings || window.__siteimprovePreviewLoaded) return;
    window.__siteimprovePreviewLoaded = true;
    const si = window._si = window._si || [];
    // URL-less checks are cached by session. Each rendered preview needs its own context.
    si.push(["setSession", settings.dataset.previewSession || null, null, "Umbraco " + settings.dataset.umbracoVersion]);
    if (settings.dataset.pageUrl) si.push(["input", settings.dataset.pageUrl]);
    else si.push(["clear"]);
    si.push(["registerPrepublishCallback", () => [document, undefined, "Full page"]]);
    si.push(["onHighlight", info => {
        (window._si || si).push(["applyDefaultHighlighting", info, document]);
    }]);
    const overlay = document.createElement("script");
    overlay.src = "https://cdn.siteimprove.net/cms/overlay-latest.js";
    overlay.onerror = () => {
        window.__siteimprovePreviewLoaded = false;
        console.warn("Siteimprove Content Assistant could not load in this preview.");
    };
    document.body.appendChild(overlay);
})();
