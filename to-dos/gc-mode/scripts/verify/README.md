# Verify scripts for GC migrations on prod

Each `verify-<stamp>.mjs` runs the "Verify after the push" steps of `docs/migrations/<stamp>_*.md` through the Supabase management API, every step in BEGIN … ROLLBACK. `verify-lib.mjs` reads `SUPABASE_MGMT_TOKEN` from `./.env.local` in the current directory, so copy this folder next to a checkout's `.env.local` (or run from the checkout root with the folder's path) and `node verify-<stamp>.mjs`. Write the next one in the same shape. See HANDOFF_2026-10-09.md → Recipes.
