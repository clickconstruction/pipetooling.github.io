# 20261026193000_lien_release_sign_code

The leader's signing code (v2.5788's `user_sign_codes`) reaches the Release of Lien window
(v2.5924). Two functions, no table or constraint changes:

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

`job_lien_releases` has no signature-mode CHECK and no guard trigger, so mode `code` lands with
no DDL on the table; the RPC is the gate (a direct client write could already set any mode —
unchanged by this migration).

Rollback: `DROP FUNCTION public.sign_lien_release_with_code(uuid, uuid, text); DROP FUNCTION
public.check_lien_sign_code(uuid, text);` — the desk's signing is unaffected.
