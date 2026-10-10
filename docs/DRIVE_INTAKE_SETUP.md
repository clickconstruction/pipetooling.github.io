# Drive intake — service-account setup

---
file: docs/DRIVE_INTAKE_SETUP.md
type: Runbook / Setup
purpose: One-time Google setup for the drive-intake edge function (estimator-twin pipeline Wave 4.4) — a SERVICE ACCOUNT, never a user password. Five minutes in console.cloud.google.com, two supabase secrets, one deploy.
audience: Owner, Developers
last_updated: 2026-08-30
---

Why a service account: the function needs a robot identity that can write ONE shared
folder. A service account has no password, no inbox, no recovery flow — you share the
folder with its generated email like any collaborator, and revoking is unsharing (or
deleting the key). Never wire a human Google password into anything.

## One-time setup (any Google account can own it)

1. **console.cloud.google.com** → project picker → *New project* → name `pipetooling-drive`
   (any org). Wait for it to create, select it.
2. **APIs & Services → Library** → search *Google Drive API* → **Enable**.
3. **IAM & Admin → Service Accounts → Create service account** → name `drive-intake` →
   Create and continue → **skip roles entirely** (Drive access comes from folder sharing,
   not IAM) → Done.
4. On the new account → **Keys → Add key → Create new key → JSON** → a `*.json` file
   downloads. This file IS the credential — it goes into secrets and then gets deleted.
5. Copy the service account's email (`drive-intake@pipetooling-drive.iam.gserviceaccount.com`).
   Open the shared **jobs folder** in Drive → Share → paste that email → **Editor** → send
   (untick notify).
6. Secrets + deploy (PT project):

   ```bash
   supabase secrets set GOOGLE_SERVICE_ACCOUNT_JSON="$(cat ~/Downloads/pipetooling-drive-*.json)"
   supabase secrets set DRIVE_JOBS_FOLDER_ID=1HvqiyMzVGOLWiynl5Vib_RMuMGkmPbvL
   supabase functions deploy drive-intake
   rm ~/Downloads/pipetooling-drive-*.json
   ```

   (The folder id is the last path segment of the folder's Drive URL.)

## Using it

- **Agents**: twin-mcp `file_plans` (bid + optional plans_url) — twin token auth,
  assignment-is-the-grant.
- **Staff**: `POST /functions/v1/drive-intake` with the app session
  (`{"bid":"b403","plans_url":"…"}`) — estimator+.
- Behavior: finds-or-creates the job folder named after the bid's project, optionally
  fetches `plans_url` into it, stamps `drive_link`/`plans_link` on the bid (set-if-empty),
  and writes the `[pipeline STG-1]` audit note. Idempotent — re-runs reuse the folder.
- **Drive-hosted sources (v2.2499)**: a `plans_url` that is a Drive file link
  (`file/d/<id>`, `open?id=`, `uc?id=`) is fetched with the **SA's own token**, so plan
  intake from an existing Drive folder is a pure Drive-to-Drive copy keeping the source
  filename. The source (file or any ancestor folder) must be **shared with the SA**
  (Viewer is enough) — watch for Google's "sharing outside your organization → Share
  anyway" confirmation, which silently kills the share if dismissed (bit us live
  2026-08-30). Non-Drive URLs fetch unauthenticated as before; a failed upload never
  fails the call (`upload_note` says what to do).
- **GC mode's trade partner portal (P5a-1, v2.5172)**: `submit-gc-trade-portal`'s kind
  `file` uploads a trade's file into the GC job's own folder (`gc_projects.drive_folder_url`,
  made by `gc-drive-access`) with the same SA and the same secrets, no new one. A submittal's
  file goes to the job's **Submittals** folder; any other to **Team only → From trades →
  <company>**. Each folder is found or made by name, and each file is a new upload
  (`uploadBytes`) named so no two meet. The app keeps the link in `gc_trade_files`, never a copy.
  Since P5a-2 (v2.5175) a lien waiver the trade signs in its portal lands in the same **From trades
  → <company>** folder as the signed PDF the function builds, once `WAIVER_SIGN_LIVE` is on. Since
  P5b-2 (v2.NNNN) a trade's insurance certificate, which is its own and on no job, goes under the jobs
  root itself (`DRIVE_JOBS_FOLDER_ID`, the same secret) to **GC trade partners → <company>**; a missing
  root fails the upload, logged.

## The upload leg: RESOLVED — Shared Drive (live since 2026-08-29)

The jobs root now lives in a **Workspace Shared Drive**, which is why uploads work: files
in a Shared Drive belong to the drive, not a person, so the SA quota rule ("Service
Accounts do not have storage quota", found live 2026-08-29 — SAs cannot own file bytes in
a My Drive folder) never applies. Live config, end-to-end verified (folder create + PDF
byte-upload + both stamps through the deployed function):

- Shared Drive **"PipeTooling Jobs"** (`0AI1sqwYSeegpUk9PVA`), created by
  `bids@douglasmining.com`, with the SA added as a member.
- `DRIVE_JOBS_FOLDER_ID` = the **Jobs** folder inside it (`11Ul_SuChL_Gq7EVUaDf9DJQwZXJsma30`).
- `DRIVE_IMPERSONATE_USER` was **unset** at cutover: the domain-wide-delegation grant was
  never made, and with the var set but ungranted, every upload fails at token exchange —
  set it only after actually authorizing delegation in the admin console.

Found live during cutover:
- The SA **cannot create Shared Drives** (`userCannotCreateTeamDrives`) — a human creates
  the drive and shares it with the SA; after that the robot does everything (it finds the
  drive via `drives.list` as a member).
- The SA could upload but not delete its own probe file (404 on delete) — likely a
  member-role ceiling; harmless for intake (it only ever adds).

Domain-wide delegation remains a documented alternative (admin.google.com → Security →
API controls → Domain-wide delegation → SA's Unique ID + scope
`https://www.googleapis.com/auth/drive`, then set `DRIVE_IMPERSONATE_USER` and redeploy),
but the Shared Drive is the chosen path — tighter blast radius than impersonating a user.

## Rotation / kill

Delete the key in console (or `supabase secrets unset GOOGLE_SERVICE_ACCOUNT_JSON`);
unshare the folder to sever access entirely.
