# 20261026193000_lien_release_sign_code

The leader's signing code (v2.5788's `user_sign_codes`) reaches the Release of Lien window
(v2.5924). The mode CHECK widened and two functions:

- `job_lien_releases_signature_mode_check` admits `code` beside `type` and `draw` (dropped and
  re-added, as the desk's was in v2.5788). The foundation migration (`20260902001517`, v2.2616)
  made it with only `type` and `draw`, so without this every code signature failed the row's
  check. The column's comment names the three modes.

- `check_lien_sign_code(p_signer_id, p_code)` — the one checker over `user_sign_codes`, factored
  out of the desk's rules so the waiver RPC shares the exact lockout behavior (format, none,
  locked, wrong with tries left, five wrong = fifteen minutes; the right code resets the counter
  and stamps `last_used_at`). SECURITY DEFINER; EXECUTE revoked from clients — only other
  definer functions call it. The desk's own `sign_lien_desk_item_with_code` is left untouched.
- `sign_lien_release_with_code(p_release_id, p_signer_id, p_code)` — the waiver twin of the
  desk's RPC: caller must be the office set or a leader and not read-only; the signer a live
  master/dev; the release unvoided and `issued` or `awaiting_signature`. The right code stamps
  the row `signed` in mode `code` with `signed_on_device_of` naming the screen. The client then
  stores the signed PDF best-effort, as the pad's path does.

`job_lien_releases` has no guard trigger, so the RPC is the gate (a direct client write could
already set `type` or `draw`; it can now set `code` too — unchanged in kind by this migration).

The `lien-release-sign` SQL bed (`scripts/pgtest-lien-release-sign.sh`,
`supabase/tests/lien_release_sign/`) signs a waiver with the leader's code as the office over the
whole schema, and holds every refusal.

Verify after the push: `select pg_get_constraintdef(oid) from pg_constraint where conname =
'job_lien_releases_signature_mode_check';` carries `'code'`.

Rollback: `DROP FUNCTION public.sign_lien_release_with_code(uuid, uuid, text); DROP FUNCTION
public.check_lien_sign_code(uuid, text);` — the desk's signing is unaffected; the wider CHECK can
stay.
