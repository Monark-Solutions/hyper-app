class JSO {
    constructor(config) {
        this.config = config;
    }

    callback() {
        const params = new URLSearchParams(window.location.search);
        const code = params.get('code');
        if (code) {
            return code;
        }
        return null;
    }

    getToken() {
        const code = this.callback();
        if (!code) {
            // Redirect to authorization
            const authUrl = new URL(this.config.authorization);
            authUrl.searchParams.append('client_id', this.config.client_id);
            authUrl.searchParams.append('redirect_uri', this.config.redirect_uri);
            authUrl.searchParams.append('response_type', 'code');
            authUrl.searchParams.append('scope', this.config.scopes.request.join(' '));
            window.location.href = authUrl.toString();
            return new Promise(() => {}); // Never resolves since we're redirecting
        }
        return Promise.resolve({ code });
    }
}
