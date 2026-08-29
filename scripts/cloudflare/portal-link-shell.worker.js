// portal-link-shell -- REFERENCE COPY of the Cloudflare Worker deployed on the
// clickplumbing.com zone, route my.clickplumbing.com/* (portal custom-links
// train, v2.2033). The live copy is edited in the Cloudflare dashboard
// (Workers & Pages -> portal-link-shell); keep this file in sync when it
// changes. It exists so texted portal links unfurl as rich cards:
//
//   iMessage/WhatsApp/Slack fetch the URL and read Open Graph tags; this
//   Worker returns a 200 HTML shell carrying those tags (branded card image
//   from clicktooling.com/portal-og-card.png, title personalized by
//   prettifying the slug -- no data lookup, nothing the URL doesn't already
//   say), then instantly bounces humans to clicktooling.com/p/<slug> via
//   meta-refresh + JS. Preview fetchers don't run JS, people never see it.
//
// NOTE: Cloudflare Redirect Rules run BEFORE Workers -- the old "portal short
// links" 301 rule had to be deleted when this Worker took over the route.
// noindex everywhere: customer slugs must not be indexed by search engines.

// clicktooling since the domain cutover (v2.2495); pipetooling 301s here anyway.
const TARGET = 'https://clicktooling.com/p/';
const HOME = 'https://clickplumbing.com/';
const CARD = 'https://clicktooling.com/portal-og-card.png';
const ICON = 'https://clicktooling.com/portal-og-icon.png';
const SLUG_RE = /^[a-z0-9][a-z0-9-]{1,58}[a-z0-9]$/;

function prettyName(slug) {
  return slug
    .split('-')
    .filter(Boolean)
    .map((w) => w[0].toUpperCase() + w.slice(1))
    .join(' ');
}

export default {
  async fetch(req) {
    const url = new URL(req.url);
    const slug = url.pathname.replace(/^\/+|\/+$/g, '').toLowerCase();
    if (!slug || slug === 'favicon.ico' || slug === 'apple-touch-icon.png') {
      if (slug) return Response.redirect(ICON, 302);
      return Response.redirect(HOME, 302);
    }

    const target = TARGET + encodeURIComponent(slug) + url.search;
    const name = SLUG_RE.test(slug) ? prettyName(slug) : null;
    const title = name ? `${name} \u00b7 Click Plumbing & Electrical` : 'Click Plumbing & Electrical';
    const desc = 'See open bills, pay online, or request a visit \u2014 no login needed.';
    const shortUrl = `https://my.clickplumbing.com/${slug}`;

    const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title}</title>
<meta name="robots" content="noindex, nofollow">
<meta property="og:site_name" content="Click Plumbing &amp; Electrical">
<meta property="og:type" content="website">
<meta property="og:title" content="${title}">
<meta property="og:description" content="${desc}">
<meta property="og:url" content="${shortUrl}">
<meta property="og:image" content="${CARD}">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${title}">
<meta name="twitter:image" content="${CARD}">
<link rel="apple-touch-icon" href="${ICON}">
<meta http-equiv="refresh" content="0; url=${target}">
<script>location.replace(${JSON.stringify(target)})</script>
<style>body{font-family:-apple-system,'Segoe UI',sans-serif;background:#f6f3ec;color:#16283c;display:grid;place-items:center;min-height:100vh;margin:0}a{color:#b0662f}</style>
</head>
<body><p>Opening your statement\u2026 <a href="${target}">Continue</a></p></body>
</html>`;

    return new Response(html, {
      status: 200,
      headers: {
        'content-type': 'text/html; charset=utf-8',
        'cache-control': 'public, max-age=300',
        'x-robots-tag': 'noindex, nofollow',
      },
    });
  },
};
