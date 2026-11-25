# 20261124214500_take_back_dev_and_controller.sql (2026-11-24, v2.8530)

Who takes a trade company's own paper back: a dev and the controller. One function restated, `take_back_company_paper(p_document_id uuid)`, with its door changed and nothing else.

- **Why**: punch list #403 asked *Who may take a paper back?* It was built for the leader and a dev, the app's rule for deleting a paper anywhere. The answer of 2026-11-24 is a dev and the controller only.
- **What changes**: the door. The body asked `is_master_or_dev()` and now asks `is_dev() OR is_controller()`. Its refusal reads *Only a dev or the controller takes a paper back.* So the leader is refused, and the controller's press goes through.
- **What does not change**: what the function deletes, each refusal and its words, and its three answers (`taken`, `signed`, `gone`). They are [`20261124103000`](20261124103000_take_back_company_paper.md)'s, word for word. It is still `SECURITY DEFINER`, and a training account, a digital twin and an archived caller are still refused first.
- **An outside party's paper** is not touched here. It is taken back by a plain delete under `person_contract_documents`' own policy, which answers the office's four roles. The app draws that press for the same two roles (`canTakeBackPapers`).
- **Order**: the client ships first. Until the push, the controller's press on a company's paper is refused by the old door in its own words, and the leader's press is already gone. Nothing is deleted on either side.
- **Types**: the function's name, argument and answer are unchanged, so `src/types/database.ts` does not move.
- **Bed**: `supabase/tests/take_back_company_paper/20_scenario.sql` (`bash scripts/pgtest-take-back-company-paper.sh`), which re-applies both migrations in order. A dev and the controller take a paper back. The leader, an assistant, an estimator and a sub are refused in the new words, and a training controller in the training words.
- **Idempotent**: `CREATE OR REPLACE`, so a second run changes nothing. No table is made, so no fence call closes the file.

**Applied** to prod by 2026-11-25: `npm run check:migration-drift` read 1,490 local files and 1,490 remote versions, fully applied (read in the docs pass after #9739); no new name in `database.ts`, since the function is replaced under its own name.
