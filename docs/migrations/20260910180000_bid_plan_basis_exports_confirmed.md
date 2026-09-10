# 20260910180000_bid_plan_basis_exports_confirmed.sql (2026-09-10, v2.3226)

Widens `bid_plan_basis_exports.save_method` from `reported | manual` to `reported | confirmed | manual`: CountTooling's export now uses the browser's save picker where it exists (Chrome / Edge) and reports `saveMethod: 'confirmed'` with the exact name the person chose; a plain download stays `reported` (the intended name). The card shows "name confirmed by your browser" on confirmed rows.

Apply order: client first is fine (a client that never sends `confirmed` is unaffected); apply with `supabase db push` after the PR is on `main`. No type change (the column is text).
