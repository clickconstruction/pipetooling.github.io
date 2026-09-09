# 20260909233000_twin_question_choices.sql (2026-09-09, v2.3210)

Tap-answerable robot questions. Two nullable columns on `twin_questions`: `choices jsonb` (2–4 short answer labels the robot offered, a JSON array of strings) and `recommended text` (the robot's own pick, one of the choices). A CHECK keeps `choices` NULL or a JSON array. Written only by the `twin-mcp` edge function (service role) on `ask_question`; read by the Standing rulings card (Bids → Audits) and the operator console (Settings → Digital twins), which render them as buttons.

- **Additive and idempotent**: `ADD COLUMN IF NOT EXISTS` ×2, `DROP CONSTRAINT IF EXISTS` + `ADD CONSTRAINT`. No new table, so no fence appliers; no RLS change — the existing estimator write policy covers `answer`/`status`, and the restrictive "Twins never update/delete" policies stand, so a robot cannot edit its own choices after filing.
- **Apply**: `supabase db push` after the v2.3210 merge, then `supabase functions deploy twin-mcp` (the function retries the insert without the two columns when they are absent, so either order is safe; until both land, robots are refused for shape but choices are not stored). Then `npm run gen-types:linked` (the PR hand-adds the two columns to `database.ts`).
- **Verify after push** (rolled back):

  ```sql
  begin;
  update twin_questions set choices = '["Yes","No"]'::jsonb, recommended = 'Yes' where id = (select id from twin_questions order by created_at desc limit 1) returning choices, recommended;
  update twin_questions set choices = '"Yes"'::jsonb where id = (select id from twin_questions order by created_at desc limit 1); -- must raise twin_questions_choices_is_array
  rollback;
  ```
