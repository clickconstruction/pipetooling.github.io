# prts.co → clicktooling.com: the box label's short link

Reference copy of the Cloudflare **zone** `prts.co`, made 2026-10-28 through
Cloudflare's API with a short-lived token (Zone, DNS, Zone Settings and Single
Redirect at Edit; deleted afterwards) and mirrored here like the
dashboard-edited Workers beside this file. A change to either copy is made to
both; a change through the API needs a new token with the same four
permissions.

## Why

Punch list #209, Materials on site: every cage and box of material on a big job
site gets a printed label with a QR code, and the crew scans it to open that
box's screen on their phone. The QR used to hold a 130-character link, a
49-module code. The label now encodes `PRTS.CO/B/7D759246` (the host, the `/b/`
route and the box's eight-character code, in capitals and with no scheme, so
the QR packs it in alphanumeric mode): 18 characters, a version-1, 21-module
code that prints bigger per module and scans from farther. prts.co ("parts") was
bought 2026-10-28 at Spaceship for this one job. Cloudflare answers every
request to it with a 301 to the same path on clicktooling.com, lower-cased, so
the app's `/b/:code` route receives `/b/7d759246`. The label's host constant is
`BOX_LINK_HOST` in `src/lib/materials/labels.ts` (on the #209 branch).

## Zone

| | |
|---|---|
| Zone | `prts.co`, Free plan, the owner's Cloudflare account (the same account as clicktooling.com, pipetooling.com, clickplumbing.com); zone id `3bba92658aa6ac66fc99145ae219a8b8` |
| Nameservers | `clay.ns.cloudflare.com`, `nelci.ns.cloudflare.com` (the pipetooling.com pair; what `dig +short NS prts.co` prints once the registrar change has propagated) |
| Registrar | Spaceship. Nameservers set to that pair at Spaceship → Domain Manager → Advanced DNS → prts.co → Nameservers → Change → Custom nameservers → Save nameserver settings |
| Hosts anything? | No. Nothing is served from this zone; no Worker, no origin. A Worker route on `prts.co/*` would never be reached while the redirect rule exists (Single Redirects run before Workers, as the `portal-link-shell` note beside this file records) |

## DNS records

Both **Proxied** (orange cloud). `192.0.2.1` is the RFC 5737 documentation
address: it routes nowhere and exists only so Cloudflare proxies the hostname,
which a redirect rule needs to fire. Proxied hostnames answer over IPv6 as well,
so there is no AAAA record.

| Type | Name | Content | Proxy |
|---|---|---|---|
| A | `@` (prts.co) | `192.0.2.1` | Proxied |
| A | `www` | `192.0.2.1` | Proxied |

## Redirect rule (Rules → Overview → Redirect Rules, a single redirect)

| | |
|---|---|
| Name | Forward every path to clicktooling.com, lower-cased |
| When incoming requests match | Custom filter expression: `(http.host eq "prts.co") or (http.host eq "www.prts.co")` |
| Then | URL redirect, type **Dynamic** |
| Expression | `concat("https://clicktooling.com", lower(http.request.uri.path))` |
| Status code | 301 |
| Preserve query string | On |
| Ids | ruleset `3a2197a9bbbb403998bcaabce6f343c7` (the zone's `http_request_dynamic_redirect` entrypoint), rule `9c738292cc5b4959bad8a09fba3f47d2` |

`lower()` is what keeps the QR's capitals (`/B/7D759246`) from reaching the app
as typed; the expression language has no conditional, so the query string rides
along through the rule's own *Preserve query string* setting rather than being
built into the expression. `concat` over `http.request.uri.path` is Cloudflare's
own example for forwarding a domain that has no origin.

## SSL/TLS

SSL/TLS → Edge Certificates → **Always Use HTTPS**: on, so `http://prts.co/…`
also ends on https. Universal SSL covers `prts.co` and `www.prts.co` once the
zone is Active; the SSL/TLS mode stays at the zone's default, Full (nothing is
behind it).

## The API calls, for the record

All against `https://api.cloudflare.com/client/v4` with `Authorization: Bearer <token>`:

```text
POST  /zones                       {"name":"prts.co","account":{"id":"<account>"},"type":"full"}
POST  /zones/<zone>/dns_records    {"type":"A","name":"prts.co","content":"192.0.2.1","proxied":true,"ttl":1}
POST  /zones/<zone>/dns_records    {"type":"A","name":"www","content":"192.0.2.1","proxied":true,"ttl":1}
PUT   /zones/<zone>/rulesets/phases/http_request_dynamic_redirect/entrypoint
      {"rules":[{"action":"redirect",
                 "expression":"(http.host eq \"prts.co\") or (http.host eq \"www.prts.co\")",
                 "description":"Forward every path to clicktooling.com, lower-cased","enabled":true,
                 "action_parameters":{"from_value":{"status_code":301,
                   "target_url":{"expression":"concat(\"https://clicktooling.com\", lower(http.request.uri.path))"},
                   "preserve_query_string":true}}}]}
PATCH /zones/<zone>/settings/always_use_https   {"value":"on"}
```

## Verify

```bash
dig +short NS prts.co
curl -sI https://prts.co/B/7D759246
curl -sIL http://prts.co/b/x
```

Expected: `clay.ns.cloudflare.com` and `nelci.ns.cloudflare.com`; `HTTP/2 301`
with `location: https://clicktooling.com/b/7d759246`; and the plain-http request
ending on `https://clicktooling.com/b/x`. Until the `/b/:code` route is on
`main` the landing is the app's 404 page: the redirect is what these check.
A `301` with the path still in capitals means the rule's type is *Static* or the
expression lost its `lower()`; a `curl` that cannot connect over https on an
Active zone means the Universal certificate has not issued yet (minutes); the
Spaceship nameservers (`launch1/launch2.spaceship.net`) still answering means
the registrar change has not propagated (up to 48 hours; Cloudflare re-checks
hourly, and *Check nameservers* on the zone's Overview forces one).
