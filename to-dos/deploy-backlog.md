# Deploy backlog: edge functions and migrations the merges did not deploy

Status: ops chore, do at the next quiet moment · CI deploys only the client (CLAUDE.md → three deploy tracks); these are the two manual tracks' known arrears

## Edge functions (from v2.2924's drift read, 2026-09-06)

`npm run check:edge-drift` showed two reds, and three more functions import `_shared` files the script cannot see:

```bash
supabase functions deploy get-mercury-account-balances mercury-reconcile
```

then `preview-stripe-invoice`, `log-estimate-option-view`, `get-contract-for-signer`. `create-user` keeps `verify_jwt = false` on any redeploy.

## Migrations (the 2026-09-06 subs train)

Nine migrations are claimed in the sessions ledger for v2.2927–v2.2934 (`20260906000000` … `20260906100000`). Confirm they are applied — `npm run check:migration-drift` from a linked checkout — and `supabase db push` any that are pending; the role-sweep predicate migration (`20260906010000`) needed the v2.2926 fix before it would apply.

## When it is done

Both checks green → delete this file.
