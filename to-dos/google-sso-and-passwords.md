---
name: "Google sign-in beside the password: the assessment"
number: 447
group: gated
status: assessment written 2026-11-26 in a docs-only PR, unarmed, for the owner to read · nothing built · nothing changed on prod
summary: >
  The owner wants Google single sign-on, under one rule: a person who signs in with Google must also be
  able to sign in with a username and password, and the devs need a control surface for it. This card is
  the read-only look at how accounts and passwords work today, what Supabase Auth offers for linking a
  Google identity to an existing login, where the risks are, what the dev surface would show, and a plan
  in seven pieces. Short answer: possible, and most of the way is already there, because every row-level
  rule reads the account's id and never the way it signed in. The work is a spike, one migration, a
  sign-in button, a desk row and a switch.
next: The owner reads the card and answers the eight questions at its foot. Then piece 1 (the config drift fix) and piece 2 (the spike on a throwaway project), each on his yes.
size: L as a train of seven (S · S · M · M · M · S · S); the assessment itself is done
blocker: The owner's calls on the eight questions; a Google Cloud OAuth client the owner makes; every migration push and function deploy on its own yes at the time.
mockup: not required — an assessment card; the control surface is sketched in words in section 6, and piece 5 brings its drawing
---

# Google sign-in beside the password (#447)

## The ask

The owner wants to add Google single sign-on, but only once account management is understood well enough
that a Google sign-in and a username-and-password sign-in both reach the same account, with a dev-facing
control surface. The rule, in one line:

> A person who signs in with Google must also be able to sign in with a username and password, and devs
> need a control surface to manage this.

This card answers seven questions about the app as it is on 2026-11-26, then sizes the work. It was
written read-only: no row on prod was written, no setting changed, no function deployed. The one read of
prod outside the repo was the project's auth settings through the Management API (read-only, secrets
left out), to compare them with `supabase/config.toml`.

## The short answer

Yes. The app already has one identity model that makes the rule cheap: **the Supabase Auth user id is
the `public.users` id**, and every fence in the database (`is_dev()`, `is_read_only()`,
`caller_is_archived()`, `is_digital_twin()`, the own-row policies) reads that id through `auth.uid()`
and never asks how the session was opened. Supabase Auth links a Google identity to the existing login
whose address matches, so a Google sign-in lands on the same `auth.users.id`, the same `users` row and
the same role, and the password stays set. Three things need building: a spike that proves the linking
rules on a throwaway project, one migration (a per-person switch, a dev-only read of a login's
identities, and a token hook that can refuse Google for a person or for everyone), and the screens: a
Google press on the sign-in page and a row on the person's desk. One drift is worth fixing first:
`supabase/config.toml` says sign-ups are open, prod says they are closed, and a `supabase config push`
would reopen them.

## 1. The identity model today

**One id, two rows, three copies of the address.**

- `auth.users.id` **is** `public.users.id`. Until v2.6511 a foreign key held that
  (`users_id_fkey`, `users.id → auth.users.id`); `20261104190000_users_login_attached_at.sql` dropped it
  so a worker can be a `users` row with no login. `users.login_attached_at` says whether an auth account
  stands behind the row.
- **How the link is made**: the trigger `handle_new_user` on `auth.users` INSERT
  (`20261104190000_users_login_attached_at.sql`, lines 51 to 78) inserts the `users` row with the
  login's id, email and name, the role from `raw_user_meta_data.invited_role` (else `helpers`), and
  `login_attached_at = now()`; when a row with that id already exists (Attach a login, which creates the
  auth account on the person's own id) it stamps `login_attached_at` and takes the login's address. The
  trigger `on_auth_user_deleted` clears `login_attached_at` instead of deleting the row.
  `sync_last_sign_in_at` (`20260703160000_sync_last_sign_in_from_auth.sql`) copies
  `auth.users.last_sign_in_at` onto `users.last_sign_in_at` on every sign-in, whatever the method.
- **Is email the key?** No. The id is the key. The address is a unique attribute (`users_email_key`),
  nullable since v2.6511 for a worker with no login (`users_login_has_email` requires one once a login is
  attached). It lives in three places: `auth.users.email` (what the person signs in with),
  `users.email` (the app's copy) and `people.email` (the roster row). `change-user-email` moves the
  three together; `handle_new_user` lets the login's address win on attach. Several doors look a person
  up **by address**: `add_worker` refuses an address another `users` row holds, `invite-user` and
  `create-user` check `users.email` for a duplicate, `dev-login` and `login-as-user` find the auth
  account by address through `_shared/authUserByEmail.ts`.
- **An auth user with no `users` row**: not in practice. The trigger inserts the row in the same
  transaction as the auth insert, so a failed insert fails the sign-up; `create-user` deletes the auth
  account when its own `users` upsert fails. The one way is a hand-made auth user in the Supabase
  dashboard, which the trigger would give a `helpers` row. Keep that in mind for section 5: **a new auth
  user from any door becomes a helper by default.**
- **A `users` row with no auth user**: yes, by design (punch list #260): every person added to the roster
  is a `users` row first (`add_worker`, `20261104200000_add_worker.sql`), a login attached later or
  never. The pickers that hand out an app task ask for `withLogin`; every roster, crew and pay list lists
  everyone.
- **What the row holds**: `role` (the nine, plus two legacy enum values no account uses), `read_only`
  (training mode), `archived_at` (the seal), `is_sample` (View as), `is_digital_twin`, `is_walk_tester`,
  `needs_supervision`, `trial_prospect_id`, `login_attached_at`, `last_sign_in_at`,
  `counttooling_user_id` (a seat in the sister app, joined by uuid, never by address), the trades
  columns, the dashboard and card preferences. The guard trigger `users_guard_privileged_columns`
  decides who may change which of these from a signed-in client; the service role (every edge function)
  passes it.
- **What reads the session**: `src/hooks/useAuth.ts` reads `users` by `session.user.id` for `role`,
  `name`, `read_only` and the two access flags, and reads the seal's refusal (`PT403`) as the Away page.
  Every RLS helper reads `public.users WHERE id = auth.uid()`. The only place the **method** of sign-in is
  read is `session_opened_by_imitation()` (v2.8251), which looks for `magiclink` in the token's `amr`
  claim to hold View as's background saves; a Google session carries `oauth` there, so it is not mistaken
  for an imitation.
- **The `auth.identities` table is never read.** Every login today has exactly one identity, provider
  `email`. Neither the client (`src/types/database.ts` carries no auth schema), the functions nor a
  migration names it. Google adds a second row per linked person there and nowhere else.

## 2. Every door that creates, invites, renames or deletes an account

| Door | Who presses | What it writes | Where |
|---|---|---|---|
| Hire → *Email them a link* | dev | `auth.admin.generateLink({ type: 'invite' })` makes the auth user unconfirmed with `invited_role` in its metadata; `handle_new_user` makes the `users` row; the function upserts `users` again with role, name, trades and `read_only`; `ensureLinkedRosterRow` finds or makes the `people` row; the link goes by Resend on the Settings *invitation* template. A pending invite re-sent is deleted and re-made on the same id. Refuses an address whose `users` row has no login (*Attach a login from their desk instead*). | `supabase/functions/invite-user/index.ts`; `src/lib/people/hireWrites.ts` `inviteHire` |
| Hire → *Set a password now*; the sample accounts card; the Digital twins panel; Hiring → *Try out*; Attach a login | dev (Try out: a Hiring-board holder) | `auth.admin.createUser` with `email_confirm: true` and, on the attach door, the person's own `id`; the `users` upsert (role, name, trades, `read_only`, `is_sample`); the roster row. Try out makes a `helpers` login with an unguessable password; Attach a login makes one with the typed password or an unguessable one and then sends the sign-in email. | `supabase/functions/create-user/index.ts`; `_shared/attachLoginDoor.ts`; `src/lib/people/attachLogin.ts` |
| Add to roster, Hire with no email, the step form, the sub-sheet form, Banking's pickers | dev, master, assistant, controller | `add_worker` RPC: a `users` row with `login_attached_at NULL` and the `people` row, one transaction. No auth account. | `supabase/migrations/20261104200000_add_worker.sql` |
| Sign-in → *Remove the login…* | dev | `auth.admin.deleteUser(id)`; the trigger clears `login_attached_at`; the person and every row that points at them stay; push devices go. Refused for one's own account, a sample, a twin, a person with no login. | `supabase/functions/detach-login/index.ts` |
| Email → *Change…* | dev | `auth.admin.updateUserById(id, { email, email_confirm: true })` (no confirmation mail goes out), then `users.email`, then `people.email` where it still held the old address; the login is put back if the app's copy fails. A row with no login changes the app's copy alone. | `supabase/functions/change-user-email/index.ts` |
| Name, trades, extra access, supervision, Charged as | the office roles the update policies admit | A client PATCH on `users` under `users_guard_privileged_columns`. | `src/lib/people/accountWrites.ts` |
| Role | dev | A client PATCH on `users.role`; the guard refuses anyone else. | `src/lib/people/accountWrites.ts` |
| Status → Archive, End employment, Restore, Bring back | dev, controller, pay-approved master | `users.archived_at`, and the auth ban `ban_duration: '876000h'` (or `'none'` to lift it). With an Away note on, the ban is skipped and the seal holds the sign-in to one RPC. | `supabase/functions/archive-user/index.ts`, `restore-user`, `away-note` |
| Status → *Merge a duplicate…* | dev | `merge_user_accounts` RPC moves every reference to the survivor; the absorbed login is banned. | `supabase/functions/merge-users/index.ts` |
| Status → *Delete…* (a row made by mistake) | the archive set | `delete_fresh_person` RPC: a `users` row with no login and its `people` row, when nothing points at them. | `docs/ACCESS_CONTROL.md` → *A row made by mistake can be deleted* |
| Settings → Advanced → claim dev | any signed-in person with the code, only when no usable dev exists | `claim_dev_attempt` RPC sets `users.role = 'dev'`. | `supabase/functions/claim-dev/index.ts` |
| The dev seat | a dev's agent, as the dev | `plan_account` / `apply_account`, `plan_login` / `apply_login`, `plan_password_reset` / `apply_password_reset` call the same functions above as the dev's own session; `get_login_state` reads the auth stamps (`invited_at`, `confirmation_sent_at`, `email_confirmed_at`, `recovery_sent_at`, `last_sign_in_at`, `banned_until`) by id as the service role. | `supabase/functions/dev-mcp/index.ts`; `docs/dev-mcp/README.md` |
| Self sign-up | nobody | The `/sign-up` route is gone since v2.2837 and the project's `disable_signup` has been on since 2026-09-03 (confirmed on prod on 2026-11-26). | `docs/ACCESS_CONTROL.md` → *`users` readable only by signed-in users* |

Every door but `add_worker` and the client PATCHes runs as the service role inside an edge function that
checks the caller's role itself (`verify_jwt = false` in `config.toml`, the Bearer read with `getUser`,
then `refuseArchivedCaller`).

## 3. How passwords are set and reset, and what goes around them

**Set**

- By the person, from the invite link: `/accept-invite` (`src/pages/AcceptInvite.tsx`) calls
  `supabase.auth.updateUser({ password })` on the session the invite link opened; the form arms only for
  a session that arrived through the invite (`src/lib/acceptInviteState.ts`). Minimum six characters,
  no character classes (prod: `password_min_length: 6`, `password_required_characters: ""`,
  `password_hibp_enabled: false`).
- By a dev: Hire → *Set a password now* and Attach → *Attach with this password* (`create-user` with a
  password), and the desk's *Set a password* dialog → `set-user-password`
  (`auth.admin.updateUserById(id, { password })`, no old password asked, dev only).
- By nobody: Try out and Attach-by-email set an unguessable password the person is never told; they sign
  in by the emailed link and may never set one. **So today a login can exist whose only working way in is
  the mailbox.** The rule's "must also be able to sign in with a password" is met in the sense that the
  door exists, not that a password is known.

**Reset**

- `/reset-password` (`src/pages/ResetPassword.tsx`, `resetPasswordForEmail`) and
  `/reset-password-confirm` exist and work, but nothing links to them: the owner's decision of
  2026-08-26 (v2.2330) is that recovery goes through the office, and the comment at the foot of
  `src/pages/SignIn.tsx` says not to re-fix the "gap". The dev seat's `apply_password_reset` uses the
  same call, one send per address per ten minutes, never on the caller's own account, or
  `set-user-password`.
- Prod's `security_update_password_require_reauthentication` is off, so a signed-in session changes
  its password with no second factor.

**The ways in that need no password** (each is a session with the person's own JWT, so the fences treat
it as the person):

1. The sign-in page's fallback (v2.2524): after two failed tries on one address, *Email me a sign-in
   link* calls `signInWithOtp({ shouldCreateUser: false })`; the link lands through supabase-js's
   `detectSessionInUrl`. GoTrue's own mailer sends it on the project's custom SMTP (set on prod).
2. The desk's *Send sign-in email* (`send-sign-in-email`, dev): `generateLink({ type: 'magiclink' })`
   sent by Resend on the Settings *sign_in* template; `AuthHandler` in `src/App.tsx` sets the session
   from the `type=magiclink` hash.
3. View as and Imitate (`login-as-user`, dev, master or assistant; never onto a dev): a magic link
   verified on the current origin, every one recorded in `user_imitations` first (v2.6290).
4. `dev-login` (the shared secret; a dev, a twin or the walk tester only since v2.6639) and
   `twin-login` (the twin fleet).
5. The invite link and the recovery link themselves open a session before any password is set.

Multi-factor is off (`mfa_totp_enroll_enabled: false`). Sessions: a ten-hour JWT, rotating refresh
tokens, no timebox and no inactivity timeout.

**What this means for Google**: the mailbox is already a credential equal to the password. A Google
Workspace sign-in is the same mailbox's owner proving it a third way, so the rule adds no new class of
holder. It also means a "require a password" switch would not close the account to a person without one
while the magic links stay.

## 4. What Supabase Auth offers, and what the app would have to do

Prod's auth server is GoTrue v2.199.0 (read from the project's health endpoint on 2026-11-26).
`@supabase/supabase-js` is pinned at `^2.47.10` and resolves to 2.99.2, which carries
`signInWithOAuth`, `linkIdentity`, `unlinkIdentity` and `getUserIdentities`. The provider is off on prod
(`external_google_enabled: false`, no client id) and `config.toml` has no `[auth.external.google]`
block yet.

**The identities table.** `auth.identities` holds one row per (provider, provider id) with
`identity_data` (what Google said: `sub`, `email`, `email_verified`, `hd` for a Workspace account,
`name`, `picture`), a generated `email` column, `created_at` and `last_sign_in_at`. A linked person has
two rows: `email` and `google`. `auth.users.raw_app_meta_data.providers` lists them.

**Automatic linking** (Supabase's docs: *"automatically links identities with the same email address to
a single user"*): on a Google sign-in GoTrue looks for the one existing user whose address equals the
address Google reports as verified. One match → the identity is linked to that user and the session is
that user's. No match → a new user, which **prod's `disable_signup` refuses** (*Signups not allowed for
this instance*). Two matches cannot arise (one address per user). The docs do not state the
verified-email condition outright; GoTrue's linking code reads only the provider's verified addresses,
and the spike (piece 2) proves it.

**Manual linking** (`linkIdentity({ provider: 'google' })`, beta): a signed-in person adds a Google
identity, even one with a different address. Off on prod (`security_manual_linking_enabled: false`).
Not needed for the rule when the roster address is the Google address; leave it off (question 4).

**Unlinking**: `unlinkIdentity` is for the signed-in person, with at least two identities. A dev acting
on someone else has no confirmed admin door in the GoTrue version on prod; the spike settles whether the
admin API has one, and the fallback is a dev-only SECURITY DEFINER RPC that does what GoTrue's unlink
does (delete the `google` row of `auth.identities` and take `google` out of
`raw_app_meta_data.providers`).

**A password for a Google-made login**: the docs' FAQ says `updateUser({ password })` adds password
sign-in to an account made through a provider; `set-user-password` (`updateUserById`) does the same
from the dev's side. Whether an `email` identity row appears is not stated, so "has a password" must be
read from `auth.users.encrypted_password IS NOT NULL` (never the hash), not from the identities table.
Under the rule this case never arises while sign-ups stay closed: every login is made by a dev with a
password or an unguessable one, so Google is always the **second** identity.

**What the app would have to do so both sign-ins land on one `users` row and one role**: nothing in the
database for the landing itself. The session's `sub` is the same id, `useAuth` reads the same row,
every fence reads the same `auth.uid()`. The work is at the edges:

- **The sign-in page**: a Google press calling `signInWithOAuth({ provider: 'google', options: {
  redirectTo, queryParams: { hd, prompt: 'select_account' } } })`, with `redirectTo` carrying the
  waiting return address (`src/lib/signInReturnAddress.ts`, v2.7182) so a scanned code still opens its
  page. The client runs the implicit flow (no `flowType` set in `src/lib/supabase.ts`), so the tokens
  come back in the URL hash and `detectSessionInUrl` consumes them; `AuthHandler` only handles
  `type=magiclink` and leaves the OAuth hash alone, which is right. Keep the implicit flow: switching to
  PKCE would change how every `generateLink` magic link lands and break `AuthHandler`'s hash read. The
  landing then does what the password path does after sign-in: clear the caches and reload
  (`src/pages/SignIn.tsx` `handleSubmit`).
- **The words**: GoTrue answers an unknown address with *Signups not allowed for this instance*; the
  page says *No account with that Google address. Ask the office.*, as `friendlyOtpError` does for the
  magic link.
- **The redirect allow-list** already covers `https://clicktooling.com/**` and the two localhost ports.
  Google's console needs the Supabase callback (`https://<project-ref>.supabase.co/auth/v1/callback`)
  as an authorized redirect URI and the site as an authorized origin.
- **The Workspace fence**: `hd` is a hint to Google's account chooser, not a rule. If the owner wants
  Workspace addresses only, the token hook of piece 3 reads `identity_data.hd` and refuses the rest.

## 5. The risks

1. **A Google address that differs from the roster address.** No match, so GoTrue tries to make a new
   user, and prod's `disable_signup` refuses it. The fence is a **prod setting, not a repo file**:
   `supabase/config.toml` still reads `enable_signup = true` under `[auth]`, so a `supabase config push`
   (which `docs/DOMAIN_CUTOVER.md` names as the way to push the redirect list) would reopen sign-ups,
   and then **any Google account could sign in and `handle_new_user` would make it a `helpers`
   login**. Piece 1 fixes the drift. A `before_user_created` hook would be a second lock, if the spike
   shows it leaves the admin creates (`create-user`, `invite-user`) alone.
2. **An unverified address.** GoTrue links on addresses the provider reports verified; a Google account
   with an unverified address matches nothing and is refused as above. The other direction matters
   more: an invite that was never accepted is an auth user with `email_confirmed_at` null, and the docs
   say linking to a user with an unverified address *"removes any other unconfirmed identities"*. What a
   Google sign-in does to a pending invite is a spike case.
3. **Sample accounts, twins, the walk tester.** Their addresses are on `samples.pipetooling.local`,
   `twins.pipetooling.local` and `walk.pipetooling.local`; no Google account carries such an address,
   so Google can never reach them. Their doors stay `login-as-user`, `twin-login` and `dev-login`.
4. **Training mode, the seal, the twin fence.** All three read the caller's `users` row by
   `auth.uid()`, so a Google session is held exactly as a password session. An archived login is banned
   at the auth server (`banned_until`), and GoTrue refuses a banned user at the OAuth callback as at the
   password door; with an Away note on, the ban is off and the seal holds the session to `my_away_note()`
   whichever way it signed in.
5. **Account takeover by email change.** In the app, nothing a person can press calls
   `updateUser({ email })`; the one address mover is `change-user-email`, dev only. A Google account
   renamed on Google's side keeps its `sub`, so the link holds and `auth.users.email` does not move.
   The real exposure is organisational: whoever administers the Workspace can reset any Workspace
   password and so sign in to the matching PipeTooling account. That is already true through the magic
   link (the Workspace admin can read the mailbox), so Google widens nothing, but it should be said out
   loud.
6. **A dev's address change as a door.** A dev who sets a roster address to one they control on Google
   can sign in as that person. Also already true through the sign-in email. The imitation record of
   v2.6290 does not see a Google sign-in; if that matters, the dev surface's "last sign-in by method"
   is the evidence.
7. **What today's RLS and fences assume about `auth.uid()`**: that it is a `users.id` and nothing else.
   No policy reads the provider, the `amr` claim or `app_metadata`, except `session_opened_by_imitation()`
   (reads `magiclink`; an OAuth session is `oauth`, so not confused) and `gmail-mine`'s imitation
   check (reads `user_imitations` and the magic-link timing). Both stay right.
8. **Two auth users, one address**: impossible, GoTrue keeps one per audience. The three copies of the
   address can still disagree if a function fails half way; `change-user-email` puts the login back on
   a failed row write, and the dev surface should show all three.
9. **Google One Tap and native sign-in** need `skip_nonce_check` in some set-ups; the plain web
   `signInWithOAuth` does not. Build the web press alone.
10. **The service worker.** After a password sign-in the page wipes the caches and reloads so a stale
    build never greets the person; the OAuth landing must do the same.

## 6. The dev control surface, sketched

**What exists today.** The person desk's *Access & account* section
(`src/components/personDesk/sections/PersonDeskAccessSection.tsx`): Name, Login (Attach a login with
*email* or *password*), Email (*Change…*), Charged as, Role, Trades, Supervision, Extra access, Training
mode, the Watch row, Sign-in (*Send sign-in email*, *Remove the login…*), CountTooling, Status (Merge,
Away note, Delete, Bring back, Archive), and the *Set a password* dialog. People → Users
(`src/components/people/PeopleUsersTab.tsx`) lists every account with its role, flags and
`last_sign_in_at`. Settings → People & accounts holds the sample accounts card; Settings → Your account
holds the dev's own MCP keys. The dev seat's `get_login_state` reads the auth stamps by id and says in
words where a person stands.

**What Google adds, where.**

- **The desk, under the Sign-in row: a *Ways in* row** (dev only, like the Sign-in row). One line per
  identity: *Password · set · last used 3 days ago* and *Google · their Workspace address · last used
  today*, or *Google · not linked*. The password line reads set or not set (no date: GoTrue keeps none),
  the Google line the identity's own address and `last_sign_in_at`. Presses: **Unlink Google** (a
  confirm naming what stays: the password, the person, everything), **Set a password** (the existing
  dialog), **Send a reset link** (the existing `resetPasswordForEmail`, office-directed), **Google off
  for this person** (unlinks and refuses a re-link). A chip when the Google address and the roster
  address differ.
- **People → Users: a lens cell** *Signs in with: password · Google*, so the office sees at a glance who
  has linked, and a filter for *Google linked* and *no password set*.
- **Settings → People & accounts: a *Google sign-in* card** (dev only): the company switch (off until
  piece 6 turns it on), the Workspace domain, a count of linked accounts, and a line that says what the
  switch does and does not do (the magic links stay).
- **The dev seat**: `get_login_state` gains the identities; `plan_login` / `apply_login` gain the
  unlink.

**What it needs in the database.**

- `users.google_sign_in_allowed boolean NOT NULL DEFAULT true`, a dev's column under
  `users_guard_privileged_columns`.
- `app_settings` key `google_sign_in_v1`: `{ enabled, hosted_domain }`, read by the sign-in page and the
  hook.
- A dev-only SECURITY DEFINER read `dev_login_identities(user_id)`: the identities' provider, address
  and `last_sign_in_at`, and `has_password` as `encrypted_password IS NOT NULL`; nothing else from
  `auth.users`, never a hash. Edge functions cannot read the `auth` schema through PostgREST, so the
  RPC is the way.
- A `custom_access_token` hook function: when the company switch is off, or the person's switch is off,
  or the Workspace domain is set and `identity_data.hd` is not it, and the token's `authentication_method`
  is `oauth` (or its `amr` says the session began by `oauth`), refuse with a plain message; every other
  method passes untouched. One primary-key read, like `is_read_only()`. Owned by `postgres`, EXECUTE to
  `supabase_auth_admin` alone. The hook is the only server-side way to refuse Google for one person
  while leaving the provider on for everyone else; it needs enabling in the dashboard or through the
  Management API, never `config push`.
- The unlink: the admin API if the spike finds one, else a dev-only definer RPC on `auth.identities`.

## 7. The plan, in pieces

| # | Piece | Size | Needs | Owner's call |
|---|---|---|---|---|
| 1 | **Config truth.** `config.toml` → `enable_signup = false` to match prod; a short note in `docs/EDGE_FUNCTIONS.md` → Authentication that prod's auth settings are read through the Management API and that `config push` is never run without a diff first. | S | nothing | none |
| 2 | **The spike, off prod.** A throwaway Supabase project (this Mac has no Docker for a local stack) with its own Google OAuth client in test mode: prove same address → same id with the password still working; different address → refused with sign-ups off; a pending invite's address; `updateUser({ password })` on a Google-made login; whether the admin API unlinks; the token hook refusing an `oauth` token and passing a refresh; what `identity_data` holds. Written up in `docs/GOOGLE_SIGN_IN.md`. | S | a throwaway project the owner or a dev makes | where it runs (question 7) |
| 3 | **The database half.** One migration: the column, the setting key, `dev_login_identities`, the hook function and its grants; the guard trigger extended. The `dev-mcp` seat's `get_login_state` reads the new RPC (its bundled deploy). | M | a migration push; a `dev-mcp` deploy | the push, on its yes |
| 4 | **The sign-in page.** The Google press (drawn only when the company switch is on), the return address carried, the landing's cache wipe and reload, the words for a refused address, the guide `sign-in-when-my-password-wont-work` amended and a new guide *sign in with Google*. | M | nothing on the server | the words (question 1 sets who may) |
| 5 | **The dev surface.** The desk's *Ways in* row, the Users lens cell, the Settings card, the `unlink-identity` function (or the RPC), the seat's unlink verbs. Its drawing comes with this piece. | M | a function deploy | the deploy, on its yes |
| 6 | **Turning it on.** The owner makes the Google OAuth client in the Google Cloud console (authorized origin and the Supabase callback), a dev sets the provider and the hook on prod through the dashboard or the Management API, then the company switch. A runbook section in `docs/GOOGLE_SIGN_IN.md`, and the lines in `docs/ACCESS_CONTROL.md`, `docs/GLOSSARY.md` and `docs/EDGE_FUNCTIONS.md`. | S | the owner at hand | the day |
| 7 | **The walk.** A dev's own Workspace account first, then a ZZ Test person with a test Workspace address the owner lends: link, sign in both ways, unlink, Google off for one person, the Away note, training mode. | S | nothing | a test Workspace address |

Pieces 1 and 2 can run now and change nothing on prod. Piece 3 is the one migration. Pieces 4 and 5
are client work plus one function. Piece 6 is the owner's day.

## Questions for the owner, with a pick on each

1. **Who may sign in with Google?** Any roster address that Google verifies, or Workspace addresses
   only? **Pick: Workspace only**, by the `hd` hint and the hook's check, since the office controls
   those accounts and a personal Gmail address on the roster is a weaker claim.
2. **May a login exist with Google alone?** **Pick: no.** Every login keeps a password door; sign-ups
   stay closed so a Google-first account cannot happen; the desk shows *no password set* and offers the
   two presses.
3. **Does a per-person Google switch ship at launch, or is the company switch plus Unlink enough?**
   **Pick: ship it**, because the hook is the only server-side refusal and it is small once the hook
   exists for the company switch.
4. **Manual linking** (a person linking a Google account with another address)? **Pick: off.** The way
   to a different address is *Change…* on the desk, by a dev.
5. **Do the magic links stay once Google is on?** **Pick: yes.** They are the office's recovery path and
   the rule does not forbid them. Say so on the Settings card.
6. **Google One Tap or a native button?** **Pick: no**, the web press alone.
7. **Where does the spike run?** A throwaway Supabase project (**pick**), or prod with Google on for a
   day (no: every account would be reachable while it is on).
8. **Fix the `enable_signup` drift now?** **Pick: yes**, piece 1, before anything else, since it is
   the fence everything in section 5 leans on.

## Where it stands

Written 2026-11-26 as a docs-only PR, unarmed, for the owner to read. Nothing built; no setting, row or
function on prod changed. Pieces 1 and 2 wait on his word; the rest on the answers above.
