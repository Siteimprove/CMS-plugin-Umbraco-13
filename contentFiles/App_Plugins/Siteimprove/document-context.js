import { UmbContextBase } from "@umbraco-cms/backoffice/class-api";
import { UMB_AUTH_CONTEXT } from "@umbraco-cms/backoffice/auth";
import { UMB_DOCUMENT_WORKSPACE_CONTEXT } from "@umbraco-cms/backoffice/document";
import { observeMultiple } from "@umbraco-cms/backoffice/observable-api";
import { SiteimproveApi } from "./api.js?v=1.0.0-beta.8";
import { assistant } from "./assistant.js?v=1.0.0-beta.8";

export class SiteimproveDocumentContext extends UmbContextBase {
    #api;
    #auth;
    #workspace;
    #owner = Symbol("SiteimproveDocument");
    #destroyed = false;
    #observationSequence = 0;
    constructor(host) {
        super(host, "Siteimprove.DocumentContext");
        assistant.register(this.#owner, () => !this.#destroyed && !!this.#api
            && !!this.#workspace && this.#auth?.getIsAuthorized() === true);
        this.consumeContext(UMB_AUTH_CONTEXT, auth => {
            if (this.#destroyed) return;
            this.#auth = auth;
            this.#api = undefined;
            this.#observeDocument();
            if (auth) this.observe(auth.isAuthorized, authorized => {
                if (this.#destroyed || this.#auth !== auth) return;
                this.#api = authorized ? new SiteimproveApi(auth) : undefined;
                this.#observeDocument();
            }, "siteimprove-authorization");
        });
        this.consumeContext(UMB_DOCUMENT_WORKSPACE_CONTEXT, workspace => {
            this.#workspace = workspace;
            this.#observeDocument();
        });
    }
    #observeDocument() {
        if (this.#destroyed) return;
        const sequence = ++this.#observationSequence;
        if (!this.#api || !this.#workspace) {
            assistant.suspend(this.#owner);
            return;
        }
        const workspace = this.#workspace;
        const api = this.#api;
        this.observe(observeMultiple([
            workspace.unique, workspace.isNew, workspace.persistedData,
            workspace.splitView.activeVariantsInfo
        ]), ([id, isNew, , variants]) => {
            if (this.#destroyed || sequence !== this.#observationSequence) return;
            // One global overlay: in split view, use the first (left-hand) culture.
            assistant.select(this.#owner, api, id, variants[0]?.culture, isNew);
        }, "siteimprove-document");
    }
    destroy() {
        this.#destroyed = true;
        this.#workspace = undefined;
        this.#api = undefined;
        this.#auth = undefined;
        assistant.release(this.#owner);
        super.destroy();
    }
}
export { SiteimproveDocumentContext as api };
