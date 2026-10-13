import { UmbControllerBase } from "@umbraco-cms/backoffice/class-api";
import { UMB_AUTH_CONTEXT } from "@umbraco-cms/backoffice/auth";
import { UMB_DOCUMENT_WORKSPACE_CONTEXT } from "@umbraco-cms/backoffice/document";
import { observeMultiple } from "@umbraco-cms/backoffice/observable-api";
import { SiteimproveApi } from "./api.js";
import { assistant } from "./assistant.js";

export class SiteimproveDocumentContext extends UmbControllerBase {
    #api;
    #workspace;
    #owner = Symbol("SiteimproveDocument");
    constructor(host) {
        super(host);
        this.consumeContext(UMB_AUTH_CONTEXT, auth => {
            this.#api = auth ? new SiteimproveApi(auth) : undefined;
            this.#observeDocument();
        });
        this.consumeContext(UMB_DOCUMENT_WORKSPACE_CONTEXT, workspace => {
            this.#workspace = workspace;
            this.#observeDocument();
        });
    }
    #observeDocument() {
        if (!this.#api || !this.#workspace) {
            assistant.release(this.#owner);
            return;
        }
        const workspace = this.#workspace;
        this.observe(observeMultiple([
            workspace.unique, workspace.isNew, workspace.persistedData,
            workspace.splitView.activeVariantsInfo
        ]), ([id, isNew, , variants]) => {
            // One global overlay: in split view, use the first (left-hand) culture.
            assistant.select(this.#owner, this.#api, id, variants[0]?.culture, isNew);
        }, "siteimprove-document");
    }
    destroy() {
        assistant.release(this.#owner);
        super.destroy();
    }
}
export { SiteimproveDocumentContext as api };
