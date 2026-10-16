// Authentication and the backoffice path come from Umbraco's auth context.
export class SiteimproveApi {
    constructor(auth, fetcher = globalThis.fetch.bind(globalThis)) {
        this.auth = auth;
        this.fetcher = fetcher;
    }

    async request(path, { method = "GET", body, signal } = {}) {
        const config = this.auth.getOpenApiConfiguration();
        const redirect = new URL(this.auth.getRedirectUrl(), config.base || globalThis.location.origin);
        const backofficePath = redirect.pathname.replace(/\/oauth_complete\/?$/, "");
        const url = new URL(backofficePath + "/management/api/v1/siteimprove/" + path, config.base || redirect.origin);
        const token = await this.auth.getLatestToken();
        const response = await this.fetcher(url, {
            method,
            signal,
            credentials: config.credentials || "same-origin",
            headers: { Authorization: "Bearer " + token, Accept: "application/json",
                ...(body === undefined ? {} : { "Content-Type": "application/json" }) },
            ...(body === undefined ? {} : { body: JSON.stringify(body) })
        });
        if (!response.ok) {
            let problem;
            try { problem = await response.json(); } catch { /* Empty/non-JSON error body. */ }
            throw new Error(problem?.title || "Siteimprove request failed (" + response.status + ").");
        }
        return response.json();
    }

    getPublicUrl() { return this.request("public-url"); }
    setPublicUrl(publicUrl) { return this.request("public-url", { method: "PUT", body: { publicUrl } }); }
    version() { return this.request("version"); }
    pageUrl(id, culture, signal) {
        const query = culture ? "?culture=" + encodeURIComponent(culture) : "";
        return this.request("document/" + encodeURIComponent(id) + "/url" + query, { signal });
    }
}
