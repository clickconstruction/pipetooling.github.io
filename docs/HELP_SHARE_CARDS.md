# Help-guide share pages and cards

> What happens when someone texts or posts a guide's link, what a guide's author has to get right for it, and how to check it. Nothing is built per guide by hand: the build draws every guide's page and card from the guide file itself.

last_updated: 2026-09-29

## What a shared link shows

Every guide has a share address, **`https://clicktooling.com/g/<slug>/`** (the slug is the guide's filename; **Copy share link** on an open guide copies it). Texted or posted, the link unfurls as a card: the guide's question as the title, its first sentence under it, and a picture drawn for that guide — the app's dark card with the wordmark, *HELP GUIDE · <category>*, and the question written on it. Opened by a person, the page shows the same question, sentence and an **Open in ClickTooling ›** button, then opens the guide in the app (`/help?g=<slug>`) on its own about a second and a half later.

The Vite build (`helpSharePagesPlugin` in `vite.config.ts`, pure helpers in `src/lib/helpShareCard.ts`) writes, for every `src/content/help/*.md`:

- `dist/g/<slug>/index.html` — the landing page with the Open Graph and Twitter tags (`og:title`, `og:description`, `og:image`, `og:url`, `canonical`, …).
- `dist/g/<slug>/card.png` — the 1200×630 card, rasterised from `helpShareCardSvg` with Playwright's Chromium (the deploy workflow installs it; without a browser the pages point at the site card `public/og-card.png` and the build log says so).

Two kinds of fetcher read the page. Crawlers that never run scripts (Slack, Facebook, WhatsApp) read the tags. **Apple's Messages runs a real WebKit** — which is why the page must not bounce on load: v2.3147's instant redirect landed Messages on the sign-in page and the text showed a bare `clicktooling.com` (v2.4190 fixed it). The redirect now runs only after `load`, after `HELP_SHARE_REDIRECT_MS`, never in a hidden tab, and never for a user agent matching `HELP_SHARE_PREVIEW_AGENTS`.

The pages are `noindex`: the guides are the company's operating manual, not a public site. "SEO" here means the link unfurl.

## What a guide's author gets right (the card is made from these)

1. **The title completes "How do I…"**, lowercase, under about 90 characters — it is the card's headline and the page's `<h1>` ("How do I bill a customer and get paid?"). Longer titles shrink to fit four lines; past that the build refuses.
2. **The first paragraph is the card's line.** Open with a sentence or two of plain prose (the first 200 characters, cut at a sentence end). A guide that opens with a heading, a list, an example panel or a `{{gif:}}` token has no line — the card would say only "A ClickTooling help guide."
3. **The category is the card's eyebrow** — one of `HELP_GUIDE_CATEGORIES`.

That is all. There is no per-guide image to make, no tag to write, no list to add the guide to.

`src/lib/helpShareCard.guides.test.ts` runs over every real guide in CI and fails a PR whose title would not fit the card, whose first paragraph is missing or carries a token, or whose page or card would not build. `src/lib/helpShareCard.test.ts` covers the helpers.

## How to check

- **Locally**: `npm run build` → open `dist/g/<slug>/index.html` and `dist/g/<slug>/card.png`. `HELP_SHARE_CARDS=0 npm run build` skips the cards (faster; the pages carry the site card).
- **Live, after the deploy**: `curl -s https://clicktooling.com/g/<slug>/ | grep og:` shows the guide's title, line and `…/g/<slug>/card.png`; `curl -sI https://clicktooling.com/g/<slug>/card.png` is `200 image/png`.
- **As a preview agent** (what Messages does): load the live URL in Playwright's Chromium with the user agent `facebookexternalhit/1.1 Facebot Twitterbot/1.0`, wait three seconds — the URL must still be the `/g/` page and `meta[property="og:image"]` must be the guide's card. A plain browser must be in the app (`/help/?g=…`, then sign-in when signed out) after about two seconds.
- **For real**: text the link from an iPhone. The bubble shows the card and the question; tapping it opens the guide.

## Where the same pattern lives

The portal shell (a Cloudflare Worker, v2.2033) and job-share (an edge function) draw their cards server-side because their data is per link; the guides' data is known at build time, so theirs is static. The site-wide card on every app URL is `index.html`'s tags + `public/og-card.png` (v2.3147).
