export const normalizeMessage = message => message.replace(/^(?:Error|TypeError): /, "");
export const firstSourceFrame = error => error.stack?.split("\n").slice(1).find(line => line.trim())?.trim() || "";
export const errorSignature = error => normalizeMessage(error.message) + "\n" + firstSourceFrame(error);

// WebKit adds the failed expression to this source-confirmed CMS teardown error.
const disposedViewMessage = /^([a-zA-Z_$][\w$]*)\.provideAt is not a function(?:\. \(In '\1\.provideAt\([a-zA-Z_$][\w$]*\)', '\1\.provideAt' is undefined\))?$/;
const disposedViewFrame = /\/umbraco\/backoffice\/[^/]+\/packages\/core\/(?:constants-[\w-]+\.js|router\/index\.js):\d+:\d+\)?$/;

export const knownCmsError = error =>
    (["Tree context is not set", "Could not request children, repository is missing"].includes(normalizeMessage(error.message))
        && (error.stack?.includes("/packages/core/tree-view-element-base-")
            || (!firstSourceFrame(error) && normalizeMessage(error.message) === "Could not request children, repository is missing")))
    || (normalizeMessage(error.message) === "Missing repository for [object Object]"
        && error.stack?.includes("/packages/media/media-collection.context-"))
    || (error.message === "ResizeObserver loop completed with undelivered notifications." && !firstSourceFrame(error))
    || (disposedViewMessage.test(normalizeMessage(error.message)) && disposedViewFrame.test(firstSourceFrame(error)));
