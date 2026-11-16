# 20261116110000_lien_notice_code_full_name

A lien notice signed with the leader's code carries his full name (v2.7395, Taunya's ask of
2026-11-15). One function re-defined, no table touched, no row rewritten.

- `sign_lien_desk_item_with_code(p_item_id, p_signer_id, p_code, p_fields_hash, p_approve)`:
  the name it stamps in `signer_printed_name` and returns as `printed_name` is now the waiver's
  rule (`check_lien_sign_code`, `20261026193000`; `lienSignatureName` in the client). A leader is
  named by his "Full name and title" (`users.notes`) up to the first comma, else his account
  name, else his email. A dev is named by his account name, else his email, since a dev's notes
  are licence numbers. It stamped `users.name` before: *Malachi* in the cursive face above a line
  that reads *Malachi Whites, Master Plumber (#RMP41130)*.
- The two messages that name him (no code set, a wrong code) keep the short name, through a
  second variable. Everything else in the body is as `20261023150000` left it, and prod's body was
  read and matched that file before this was written.
- `CREATE OR REPLACE` keeps the owner; the `REVOKE` and `GRANT` restate `authenticated` only.

No notice had been signed in the app when this was written (all 44 rows read with no
signature), so there is nothing to correct in place.

**Order.** The client does not wait on this: the function's name and arguments are unchanged.
The typed, drawn and pen paths take the same rule in the client (`lienSignaturePrintedName`), so
only the code path needs the push.

**Bed.** `lien-release-sign` (`scripts/pgtest-lien-release-sign.sh`) applies this file a second
time, which must change nothing, and runs `supabase/tests/lien_release_sign/35_notice_code.sql`:
his code signs and approves at the office's screen in his full name, a dev signs in his account
name, a leader with no title line in his account name, a sign-only press at his own screen names
no device, the messages keep the short name, and the function stays closed to `anon`.

**Rollback.** Re-apply the function from `20261023150000_lien_sign_code.sql`.
