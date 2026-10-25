# 20261025140000_legal_plan_deadline_key.sql (2026-10-25, v2.5842)

Punch list #170: a planned step on the Legal desk's Timeline may name the lien clock deadline it serves. `legal_plan_add` and `legal_plan_update` gain `p_deadline_key text DEFAULT NULL` (`meta.deadline_key`, the clock's own key `deadline:<job id>:<step key>`; on update NULL leaves the tie and `''` clears it). The five-argument signatures are dropped first so PostgREST resolves one function of each name; `dev_legal_plan_write` calls both positionally and keeps working with the default. No table change, no fence. The deadlines themselves are not stored: the Timeline draws them from the packet's lien clock on both sides.

Apply order: the client sends `p_deadline_key` only when a deadline is picked, so plain planned steps keep working against the old function; a step tied to a deadline fails with PostgREST's unknown-argument error until the push. Push right after the merge. Applied with `supabase db push`.
