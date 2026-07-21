import chalk from 'chalk';
import { generatePKCE, randomState } from './pkce.js';
import { saveOAuthTokens, loadOAuthTokens, isOAuthExpired, type OAuthTokens } from './store.js';
import { openInBrowser } from '../browser-login.js';
import { createServer } from 'node:http';
import { loadConfig, saveConfig } from '../../config/store.js';
import { browserFreeLoginCaptureKey } from '../clipboard-login.js';

/**
 * Gemini free login:
 * 1) Prefer Google OAuth if GOOGLE_CLIENT_ID/SECRET (or saved config) exist — no API key paste
 * 2) Else open AI Studio free key page + auto-detect AIza… from clipboard
 */

const AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const SCOPES = 'https://www.googleapis.com/auth/generative-language';
const CALLBACK_PORT = 8765;
const REDIRECT_URI = `http://localhost:${CALLBACK_PORT}/oauth2callback`;

function successHtml(): string {
  return `<!doctype html><html><body style="font-family:system-ui;padding:40px;text-align:center">
    <h1>Signed in to PKA (Gemini)</h1>
    <p>You can close this tab.</p>
  </body></html>`;
}

function getGoogleClient(): { clientId: string; clientSecret: string } | null {
  const config = loadConfig() as ReturnType<typeof loadConfig> & {
    googleOAuth?: { clientId?: string; clientSecret?: string };
  };
  const clientId = process.env.GOOGLE_CLIENT_ID || config.googleOAuth?.clientId || '';
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET || config.googleOAuth?.clientSecret || '';
  if (clientId && clientSecret) return { clientId, clientSecret };
  return null;
}

async function loginGeminiGoogleOAuth(client: { clientId: string; clientSecret: string }): Promise<OAuthTokens> {
  const { verifier, challenge } = generatePKCE();
  const state = randomState();

  const authUrl =
    `${AUTH_URL}?` +
    new URLSearchParams({
      client_id: client.clientId,
      redirect_uri: REDIRECT_URI,
      response_type: 'code',
      scope: SCOPES,
      access_type: 'offline',
      prompt: 'consent',
      code_challenge: challenge,
      code_challenge_method: 'S256',
      state,
    }).toString();

  console.log(chalk.bold.cyan('\n  Sign in with Google (Gemini free)'));
  console.log(chalk.dim('  Browser opens Google login — no API key paste.\n'));

  const code = await new Promise<string>((resolve, reject) => {
    const server = createServer((req, res) => {
      try {
        const url = new URL(req.url || '/', `http://127.0.0.1:${CALLBACK_PORT}`);
        if (url.pathname !== '/oauth2callback') {
          res.writeHead(404);
          res.end('Not found');
          return;
        }
        const err = url.searchParams.get('error');
        if (err) {
          res.writeHead(400);
          res.end(err);
          reject(new Error(err));
          server.close();
          return;
        }
        const codeParam = url.searchParams.get('code');
        const stateParam = url.searchParams.get('state');
        if (!codeParam || stateParam !== state) {
          res.writeHead(400);
          res.end('Invalid');
          reject(new Error('Invalid OAuth callback'));
          server.close();
          return;
        }
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(successHtml());
        resolve(codeParam);
        setTimeout(() => server.close(), 200);
      } catch (e) {
        reject(e);
        server.close();
      }
    });
    server.on('error', reject);
    server.listen(CALLBACK_PORT, '127.0.0.1', () => {
      openInBrowser(authUrl);
      console.log(chalk.dim(`  Waiting on ${REDIRECT_URI} …\n`));
    });
    setTimeout(() => {
      server.close();
      reject(new Error('Login timed out.'));
    }, 5 * 60_000);
  });

  const body = new URLSearchParams({
    code,
    client_id: client.clientId,
    client_secret: client.clientSecret,
    redirect_uri: REDIRECT_URI,
    grant_type: 'authorization_code',
    code_verifier: verifier,
  });

  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`Gemini token exchange failed (${res.status}): ${text}`);
  const data = JSON.parse(text) as {
    access_token: string;
    refresh_token?: string;
    expires_in: number;
  };

  const tokens: OAuthTokens = {
    provider: 'gemini',
    accessToken: data.access_token,
    refreshToken: data.refresh_token || '',
    expiresAt: Date.now() + (data.expires_in || 3600) * 1000 - 60_000,
  };
  saveOAuthTokens(tokens);
  console.log(chalk.green('\n  ✓ Google / Gemini login successful.\n'));
  return tokens;
}

async function loginGeminiAiStudioClipboard(): Promise<OAuthTokens> {
  const key = await browserFreeLoginCaptureKey({
    providerLabel: 'Gemini (Google AI Studio free)',
    signupUrl: 'https://aistudio.google.com/apikey',
    tip: 'Free Google login → Create API key → Copy. PKA picks it up from clipboard.',
    match: (text) => {
      const m = text.match(/AIza[0-9A-Za-z_-]{20,}/);
      return m ? m[0] : null;
    },
  });
  if (!key) throw new Error('Cancelled — no Gemini key.');

  const cfg = loadConfig();
  cfg.apiKeys.gemini = key;
  saveConfig(cfg);

  const tokens: OAuthTokens = {
    provider: 'gemini',
    accessToken: key,
    refreshToken: '',
    expiresAt: Date.now() + 365 * 24 * 3600 * 1000,
  };
  saveOAuthTokens(tokens);
  return tokens;
}

export async function loginGeminiOAuth(): Promise<OAuthTokens> {
  const client = getGoogleClient();
  if (client) return loginGeminiGoogleOAuth(client);
  return loginGeminiAiStudioClipboard();
}

export async function getValidGeminiAccessToken(): Promise<string | null> {
  let tokens = loadOAuthTokens('gemini');
  if (!tokens) return null;

  // AI Studio API keys are stored as accessToken and start with AIza
  if (tokens.accessToken.startsWith('AIza')) return tokens.accessToken;

  if (isOAuthExpired(tokens)) {
    const client = getGoogleClient();
    if (!client || !tokens.refreshToken) return null;
    try {
      const body = new URLSearchParams({
        client_id: client.clientId,
        client_secret: client.clientSecret,
        refresh_token: tokens.refreshToken,
        grant_type: 'refresh_token',
      });
      const res = await fetch(TOKEN_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body,
      });
      const text = await res.text();
      if (!res.ok) return null;
      const data = JSON.parse(text) as { access_token: string; expires_in: number };
      tokens = {
        ...tokens,
        accessToken: data.access_token,
        expiresAt: Date.now() + data.expires_in * 1000 - 60_000,
      };
      saveOAuthTokens(tokens);
    } catch {
      return null;
    }
  }
  return tokens.accessToken;
}

/** True when token is Google OAuth bearer (not AI Studio API key). */
export function isGeminiOAuthBearer(token: string): boolean {
  return Boolean(token) && !token.startsWith('AIza');
}
