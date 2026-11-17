
class TwitchApi {
  constructor(config, http = fetch) {
    this.config = config;
    this.http = http;
    this.token = null;
    this.expiresAt = 0;
  }

  async getAccessToken() {
    if (this.token && Date.now() < this.expiresAt) return this.token;

    const response = await this.http('https://id.twitch.tv/oauth2/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: this.config.twitchClientId,
        client_secret: this.config.twitchClientSecret,
        grant_type: 'client_credentials'
      })
    });
    if (!response.ok) throw new Error(`Twitch-OAuth: HTTP ${response.status}`);

    const data = await response.json();
    if (!data.access_token) throw new Error('Twitch hat keinen Access-Token geliefert.');
    this.token = data.access_token;
    this.expiresAt = Date.now() + Math.max(0, (data.expires_in - 60) * 1000);
    return this.token;
  }

  async getLiveStreams(logins) {
    if (!logins.length) return [];
    // Twitch akzeptiert bis zu 100 user_login-Werte je Request.
    const results = [];
    for (let offset = 0; offset < logins.length; offset += 100) {
      const params = new URLSearchParams();
      for (const login of logins.slice(offset, offset + 100)) params.append('user_login', login);
      const url = `https://api.twitch.tv/helix/streams?${params}`;

      let response;
      for (let attempt = 0; attempt < 2; attempt += 1) {
        const token = await this.getAccessToken();
        response = await this.http(url, {
          headers: { 'Client-ID': this.config.twitchClientId, Authorization: `Bearer ${token}` }
        });
        if (response.status !== 401 || attempt === 1) break;
        this.token = null; // bei abgelaufenem Token einmal neu anmelden
      }
      if (!response.ok) throw new Error(`Twitch-Streams: HTTP ${response.status}`);
      const payload = await response.json();
      if (!Array.isArray(payload.data)) throw new Error('Ungültige Twitch-API-Antwort.');
      results.push(...payload.data);
    }
    return results;
  }
}

module.exports = { TwitchApi };

