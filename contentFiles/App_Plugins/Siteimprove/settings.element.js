import { LitElement, html, css } from "@umbraco-cms/backoffice/external/lit";
import { UmbElementMixin } from "@umbraco-cms/backoffice/element-api";
import { UMB_AUTH_CONTEXT } from "@umbraco-cms/backoffice/auth";
import { SiteimproveApi } from "./api.js?v=1.0.0";

export class SiteimproveSettingsElement extends UmbElementMixin(LitElement) {
    static properties = {
        publicUrl: { state: true }, configured: { state: true },
        busy: { state: true }, message: { state: true }, error: { state: true },
        loaded: { state: true }
    };
    #api;
    constructor() {
        super();
        this.publicUrl = "";
        this.configured = false;
        this.busy = false;
        this.loaded = false;
        this.message = "";
        this.error = false;
        this.consumeContext(UMB_AUTH_CONTEXT, auth => {
            if (!auth) return;
            this.#api = new SiteimproveApi(auth);
            this.#load();
        });
    }
    async #load() {
        this.busy = true;
        try {
            const result = await this.#api.getPublicUrl();
            this.publicUrl = result.publicUrl;
            this.configured = result.isConfigured;
            this.loaded = true;
        } catch (error) {
            this.error = true;
            this.message = error.message;
        } finally { this.busy = false; }
    }
    async #save(event) {
        event.preventDefault();
        if (!this.#api || this.busy || this.configured || !this.loaded) return;
        this.busy = true;
        this.message = "";
        this.error = false;
        try {
            const result = await this.#api.setPublicUrl(this.publicUrl.trim());
            this.publicUrl = result.publicUrl;
            this.message = "Public URL saved.";
        } catch (error) {
            this.error = true;
            this.message = error.message;
        } finally { this.busy = false; }
    }
    render() {
        return html`<uui-box headline="Siteimprove public URL">
            <p>Use a public domain when the site's Umbraco address differs from the address checked by Siteimprove.
               Leave this blank to use Umbraco's published URLs.</p>
            <form @submit=${this.#save}>
                <label for="public-url">Public domain</label>
                <input id="public-url" type="url" placeholder="https://www.example.com"
                    .value=${this.publicUrl} ?disabled=${this.busy || this.configured || !this.loaded}
                    @input=${event => { this.publicUrl = event.target.value; }}
                    aria-describedby="public-url-help" />
                <p id="public-url-help">Use an HTTP or HTTPS origin without a path. Page paths are preserved.</p>
                ${this.configured ? html`<p>This value is managed by application configuration.</p>`
                    : html`<uui-button type="submit" look="primary" label="Save public URL"
                          ?disabled=${this.busy || !this.loaded}>${this.busy ? "Saving…" : "Save"}</uui-button>`}
                <p role=${this.error ? "alert" : "status"}>${this.message}</p>
            </form>
        </uui-box>`;
    }
    static styles = css`
        :host { display: block; padding: var(--uui-size-layout-1, 24px); }
        form { max-width: 42rem; }
        label { display: block; margin-bottom: 8px; font-weight: bold; }
        input { width: 100%; box-sizing: border-box; padding: 10px; font: inherit;
            color: var(--uui-color-text); background: var(--uui-color-surface);
            border: 1px solid var(--uui-color-border); border-radius: 3px; }
        input:focus { outline: 2px solid var(--uui-color-focus); outline-offset: 2px; }
    `;
}
customElements.define("siteimprove-settings", SiteimproveSettingsElement);
export { SiteimproveSettingsElement as element };
