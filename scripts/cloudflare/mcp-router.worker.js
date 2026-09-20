// mcp-router -- the Cloudflare Worker on mcp.clicktooling.com (v2.3633).
// Deployed FROM this file with wrangler (mcp-router.wrangler.toml beside it
// has the two commands) -- unlike the two older Workers here, which are edited
// in the dashboard and only mirrored. It gives the MCP servers one readable
// address with a path per audience (to-dos/mcp-servers.md is the naming
// scheme's home):
//
//   https://mcp.clicktooling.com/twin  ->  the twin-mcp edge function
//   https://mcp.clicktooling.com/dev   ->  dev-mcp (not built yet -- add the line)
//
// A pure pass-through: the servers are stateless JSON-RPC over POST (no SSE, no
// session), so forwarding the request and returning the response is the whole
// proxy. Auth, fences and rate limits stay in the edge function -- this Worker
// holds NO secrets and reads no key. The path is the audience, never the seat
// (estimator / pricer is decided by the key). An app that gets its own server
// goes in front of the audience: /count/twin, /takeoff/dev.
//
// The Supabase address keeps working, so installed Claude Desktop configs do
// not break.

const FUNCTIONS = 'https://yewfzhbofbbyvkvtaatw.supabase.co/functions/v1/';
const ROUTES = {
  '/twin': 'twin-mcp',
};

// Only what an MCP client sends; nothing Cloudflare adds (cf-*, x-forwarded-*)
// is forwarded, and no cookie ever is.
const PASS_HEADERS = [
  'content-type',
  'accept',
  'authorization',
  'x-twin-token',
  'x-dev-token',
  'mcp-protocol-version',
  'mcp-session-id',
];

export default {
  async fetch(req) {
    const url = new URL(req.url);
    const path = url.pathname.replace(/\/+$/, '') || '/';
    const fn = ROUTES[path];
    if (!fn) {
      return new Response('Not found. MCP servers: ' + Object.keys(ROUTES).join(', '), {
        status: 404,
        headers: { 'content-type': 'text/plain; charset=utf-8', 'x-robots-tag': 'noindex' },
      });
    }

    const headers = new Headers();
    for (const name of PASS_HEADERS) {
      const value = req.headers.get(name);
      if (value) headers.set(name, value);
    }

    // OPTIONS, GET (405) and POST all answer from the function itself, so the
    // two addresses behave identically.
    const hasBody = req.method !== 'GET' && req.method !== 'HEAD' && req.method !== 'OPTIONS';
    const upstream = await fetch(FUNCTIONS + fn, {
      method: req.method,
      headers,
      body: hasBody ? req.body : undefined,
      redirect: 'manual',
    });

    const out = new Headers(upstream.headers);
    out.set('x-robots-tag', 'noindex');
    out.set('cache-control', 'no-store');
    return new Response(upstream.body, { status: upstream.status, headers: out });
  },
};
