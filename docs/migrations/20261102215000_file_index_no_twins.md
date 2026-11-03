# 20261102215000_file_index_no_twins.sql (2026-11-02, v2.6396)

Search every file deeply (punch list #240): **`file_index_select` is replaced**, `(SELECT is_office_or_estimator()) AND NOT (SELECT is_digital_twin())`. A digital twin holds the estimator role, so v2.6319's policy let the three twins read every job's file text through `file_index` and `search_file_index` (SECURITY INVOKER, so the policy decides), while `drive-link` refuses a twin every action and the card says never a twin. A rolled-back read as each role on prod found it on 2026-11-02. The office and the estimators read as before, the other roles and anon as before, and the service role writes as before. No column, index or function changes, and the fences are untouched.

**Apply order**: push right after the merge. Nothing in the client or a function depends on it. A twin's Find a file then finds nothing in the index and is refused by Drive's search, as it was before v2.6319.

**Verify** in a rolled-back transaction: `BEGIN READ ONLY; SET LOCAL ROLE authenticated; SELECT set_config('request.jwt.claims', '{"sub":"<a twin's id>","role":"authenticated"}', true); SELECT count(*) FROM public.file_index; ROLLBACK;` answers 0 as a twin and every row as a human estimator.
