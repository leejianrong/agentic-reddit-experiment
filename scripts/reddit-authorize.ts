/**
 * One-time interactive helper to mint a Reddit OAuth refresh token for a
 * "script" app (reddit.com/prefs/apps). Run with:
 *
 *   npm run reddit:authorize
 *
 * (reads REDDIT_CLIENT_ID / REDDIT_CLIENT_SECRET from .env)
 *
 * It starts a local HTTP server on the redirect URI, prints an authorization
 * URL to open in a browser where you're logged into the target Reddit
 * account, and on approval exchanges the returned code for a refresh token
 * — printed once, to paste into .env as REDDIT_REFRESH_TOKEN. Nothing here
 * ever writes .env for you; it only prints, since it can't know which
 * account you actually meant to authorize until you approve it yourself.
 */
import { randomBytes } from 'node:crypto';
import http from 'node:http';

const PORT = 8765;
const REDIRECT_URI = `http://localhost:${PORT}/callback`;

const clientId = process.env.REDDIT_CLIENT_ID;
const clientSecret = process.env.REDDIT_CLIENT_SECRET;

if (!clientId || !clientSecret) {
  console.error('Set REDDIT_CLIENT_ID and REDDIT_CLIENT_SECRET in the environment first.');
  process.exit(1);
}

const state = randomBytes(16).toString('hex');
const authorizeUrl = new URL('https://www.reddit.com/api/v1/authorize');
authorizeUrl.searchParams.set('client_id', clientId);
authorizeUrl.searchParams.set('response_type', 'code');
authorizeUrl.searchParams.set('state', state);
authorizeUrl.searchParams.set('redirect_uri', REDIRECT_URI);
authorizeUrl.searchParams.set('duration', 'permanent');
authorizeUrl.searchParams.set('scope', 'identity read submit history');

console.log('\nOpen this URL in a browser logged into the Reddit account the bot should use:\n');
console.log(authorizeUrl.toString());
console.log(`\nWaiting for the redirect on ${REDIRECT_URI} ...`);
console.log(
  '(In the app settings on reddit.com/prefs/apps, "redirect uri" must be exactly ' +
    `${REDIRECT_URI})\n`,
);

const server = http.createServer((req, res) => {
  void handleRequest(req, res);
});

async function handleRequest(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
  const url = new URL(req.url ?? '/', REDIRECT_URI);
  if (url.pathname !== '/callback') {
    res.writeHead(404).end();
    return;
  }

  const returnedState = url.searchParams.get('state');
  const code = url.searchParams.get('code');
  const error = url.searchParams.get('error');

  if (error) {
    res
      .writeHead(400, { 'Content-Type': 'text/plain' })
      .end(`Reddit denied authorization: ${error}`);
    console.error(`Authorization denied: ${error}`);
    server.close();
    process.exit(1);
  }

  if (returnedState !== state || !code) {
    res.writeHead(400, { 'Content-Type': 'text/plain' }).end('State mismatch or missing code.');
    return;
  }

  res.writeHead(200, { 'Content-Type': 'text/plain' }).end('Authorized. You can close this tab.');
  server.close();

  const basicAuth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
  const tokenResponse = await fetch('https://www.reddit.com/api/v1/access_token', {
    method: 'POST',
    headers: {
      Authorization: `Basic ${basicAuth}`,
      'User-Agent': 'agentic-reddit-experiment/0.0.0 (oauth-setup)',
    },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: REDIRECT_URI,
    }),
  });

  const body = (await tokenResponse.json()) as { refresh_token?: string; error?: string };
  if (!tokenResponse.ok || !body.refresh_token) {
    console.error('Token exchange failed:', body);
    process.exit(1);
  }

  console.log('\nSuccess. Add this to your .env as REDDIT_REFRESH_TOKEN:\n');
  console.log(body.refresh_token);
  console.log();
}

server.listen(PORT);
