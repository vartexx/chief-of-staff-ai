const crypto = require("node:crypto");

const { google } = require("googleapis");

const GOOGLE_CALENDAR_PROVIDER = "google_calendar";
const GOOGLE_SCOPES = [
  "openid",
  "email",
  "profile",
  "https://www.googleapis.com/auth/calendar",
];

class GoogleCalendarService {
  constructor(database) {
    this.database = database;
  }

  isConfigured() {
    return Boolean(
      process.env.GOOGLE_CLIENT_ID &&
      process.env.GOOGLE_CLIENT_SECRET &&
      process.env.GOOGLE_REDIRECT_URI,
    );
  }

  getConnectionStatus() {
    const integration = this.database.getIntegration(GOOGLE_CALENDAR_PROVIDER);

    return {
      configured: this.isConfigured(),
      connected: Boolean(integration?.refresh_token),
      accountEmail: integration?.account_email || null,
    };
  }

  createOAuthClient() {
    if (!this.isConfigured()) {
      throw new Error("Google Calendar is not configured. Add GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, and GOOGLE_REDIRECT_URI.");
    }

    return new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI,
    );
  }

  createAuthUrl() {
    const oauth2Client = this.createOAuthClient();
    const state = crypto.randomUUID();

    this.database.createAuthState(GOOGLE_CALENDAR_PROVIDER, state);

    const url = oauth2Client.generateAuthUrl({
      access_type: "offline",
      include_granted_scopes: true,
      prompt: "consent",
      scope: GOOGLE_SCOPES,
      state,
    });

    return { url, state };
  }

  async completeOAuth(code, state) {
    const record = this.database.consumeAuthState(GOOGLE_CALENDAR_PROVIDER, state);

    if (!record) {
      throw new Error("Invalid or expired Google OAuth state.");
    }

    const oauth2Client = this.createOAuthClient();
    const { tokens } = await oauth2Client.getToken(code);

    oauth2Client.setCredentials(tokens);

    const oauth2 = google.oauth2({
      auth: oauth2Client,
      version: "v2",
    });
    const profile = await oauth2.userinfo.get();

    const integration = this.database.upsertIntegration({
      provider: GOOGLE_CALENDAR_PROVIDER,
      accountEmail: profile.data.email || null,
      accessToken: tokens.access_token || null,
      refreshToken: tokens.refresh_token || this.database.getIntegration(GOOGLE_CALENDAR_PROVIDER)?.refresh_token || null,
      scope: tokens.scope || null,
      expiryDate: tokens.expiry_date || null,
      tokenType: tokens.token_type || null,
      meta: {
        id: profile.data.id || null,
        name: profile.data.name || null,
        picture: profile.data.picture || null,
      },
    });

    return integration;
  }

  async disconnect() {
    const integration = this.database.getIntegration(GOOGLE_CALENDAR_PROVIDER);

    if (!integration) {
      return;
    }

    if (this.isConfigured() && integration.refresh_token) {
      try {
        const oauth2Client = this.createOAuthClient();
        await oauth2Client.revokeToken(integration.refresh_token);
      } catch (_error) {
        // Best effort revoke for hackathon ergonomics.
      }
    }

    this.database.deleteIntegration(GOOGLE_CALENDAR_PROVIDER);
  }

  async getAuthorizedCalendar() {
    const integration = this.database.getIntegration(GOOGLE_CALENDAR_PROVIDER);

    if (!integration?.refresh_token) {
      return null;
    }

    const oauth2Client = this.createOAuthClient();

    oauth2Client.setCredentials({
      access_token: integration.access_token || undefined,
      refresh_token: integration.refresh_token,
      expiry_date: integration.expiry_date || undefined,
      scope: integration.scope || undefined,
      token_type: integration.token_type || undefined,
    });

    oauth2Client.on("tokens", (tokens) => {
      this.database.upsertIntegration({
        provider: GOOGLE_CALENDAR_PROVIDER,
        accountEmail: integration.account_email || null,
        accessToken: tokens.access_token || integration.access_token || null,
        refreshToken: tokens.refresh_token || integration.refresh_token || null,
        scope: tokens.scope || integration.scope || null,
        expiryDate: tokens.expiry_date || integration.expiry_date || null,
        tokenType: tokens.token_type || integration.token_type || null,
        meta: integration.meta || {},
      });
    });

    return google.calendar({
      version: "v3",
      auth: oauth2Client,
    });
  }
}

module.exports = {
  GoogleCalendarService,
  GOOGLE_CALENDAR_PROVIDER,
};
