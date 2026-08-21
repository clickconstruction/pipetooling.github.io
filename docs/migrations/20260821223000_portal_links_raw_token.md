# 20260821223000_portal_links_raw_token.sql (2026-08-21, v2.1991)

Portal links v2: adds a raw `token` column (unique partial index),
`token_hash` becomes nullable, legacy hash-only rows are revoked (their raw
tokens are unrecoverable by design). `mint_customer_portal_link` v2 returns
the existing active link's token instead of demanding a rotate; new
`revoke_customer_portal_link(p_customer_id, p_audience)` kill switch (office
writers). Security tradeoff (hash-only → raw) is deliberate and documented
in the migration header: portal links expose the same data class as the
Stripe hosted-invoice URLs this schema already stores raw, and the globe
modal's copy/preview flow requires re-showing the link. Apply order free;
edge fns look up token-first with hash fallback.
