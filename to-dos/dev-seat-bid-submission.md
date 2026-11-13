---
name: "The dev seat files a bid's sent paper from Drive and links it: plan_bid_submission and read_drive_folder"
number: 339
group: ready
status: LIVE on `dev-mcp` 0.82.0 (2026-11-13, v2.7154, PR #7964): `read_drive_folder` and `plan_bid_submission` / `apply_bid_submission`, kernel `_shared/devMcpBidSubmission.ts` · walked on prod the same day on the owner's word: the read on b398's folder, on one file and on a folder the account cannot open, a dry run on b398 "ZZ Test", and one apply there (Drive's own copy into Team only › Sent by us, the link set, the note on its Notes, a second apply refused) · the three legs left were walked the same afternoon on a fresh ZZ bid, b605: the project folder made at the apply, `replace: true`, and a file from outside the company's Shared Drive read and uploaded · every leg has now run on prod · the bid train's pair 6 (card #317), briefed 2026-11-11 and added to the punch list on the owner's word 2026-11-13
summary: >
  Old proposal files are being copied into company Drive, a folder a bid, and each bid should
  link the paper that was sent. The dev seat can set the link, but it cannot read a Drive folder,
  make a bid's project folder, or copy a file into it, so the session doing the real case read
  Drive through a browser and left the links in bid notes. Two verbs close it: a read of a Drive
  folder and a file's facts, and a plan → apply pair that files a sent paper into the bid's own
  folder and links it, as the Files window would if it had the press.
next: Ask the owner the one design call below (the link as the Sent by us folder once a bid holds several papers), then retire this card and #317. b605 "ZZ Test Sent Paper Walk 2026-11-13" and its Drive folder are test leftovers, safe to delete.
size: M (one read verb, one write pair, no migration)
blocker: none
opinion: build — the old-proposals work waits on it, and every door it needs already exists on the server
mockup: not required — the verbs have no screen; each plan's reply is the design
---

# The dev seat files a bid's sent paper from Drive and links it

## The ask

The owner, 2026-11-11, on old proposal files copied into company Drive and tied to their bids:
"connected to their bids where a user links the submissions" and "if we don't have dev verbs to
support this, we should add those too". On 2026-11-13: "add build pair 6 to the punchlist".

The session working the real case (the Gun Dog proposals, 35 files for 14 bids) met four gaps.
One is closed: `plan_bid_update` sets `bid_submission_link`, `drive_link`,
`count_tooling_plans_link` and `plans_link`, the columns the Files window writes. Three are open.

## What to build

### `read_drive_folder` — a read

The seat cannot list a Drive folder or say who owns a file, who it is shared with and when it
changed, so the real case was read through a browser.

- `read_drive_folder { folder (an id or a link), page? }` lists a folder's files and folders: the
  name, the kind, the size, the modified time, the owner, whether the company's Shared Drive holds
  it. `read_drive_folder { file }` answers one file's facts the same way, with its parents.
- Read through the intake service account, as `devMcpDriveDoc.ts` reads a file today. Read-only by
  scope.
- A folder the account cannot open is answered in words naming the share that would fix it, as
  `driveFilingRefusal` words a refusal.

### `plan_bid_submission` → `apply_bid_submission` — the write

- **The ask**: `{ bid, drive_file_id | drive_url, replace? }`. One paper a call; a bid with several
  papers takes several calls.
- **The project folder**: when the bid has none, the apply makes it as the Files window's *Make the
  project folder* does, through `bid-photos` `make` as the dev (or `ensureBidPhotoFolder` in
  `_shared/bidFolder.ts`, the same rule), which writes `bids.drive_link` itself. A bid whose link is
  a personal folder the app cannot file into is refused with `bidFolderHoldWords`.
- **Where the paper lands**: Team only › Sent by us inside the bid's project folder, the app's
  fixed home for what we sent (`JOB_FOLDER_TREE.sentByUs`; `drive-link` `put` with `where: 'sent'`
  lands there for a job). Do not invent a Submission folder.
- **The copy**: read on the server, never through the agent. A file already in the company's
  Shared Drive is copied with Drive's own copy; a file elsewhere is read and uploaded. The plan
  commits to the file's name, size, sha256 or Drive's md5, and the bid's link before, so a file
  changed since the plan, or a link set since, refuses the apply.
- **The link**: `bids.bid_submission_link` set to the copied file. A bid that already has a link is
  refused unless `replace: true`, and the plan names the link it would replace.
- **Several papers on one bid** (a revision, a second option): the column holds one link. The plan
  says so and keeps the newest as the link. **Ask the owner** whether he wants the link to be the
  Sent by us folder instead once a bid holds more than one; that is the one design call left.
- **What it also says**: a note on the bid naming the file and where it was filed, written as
  `plan_activity_note` writes one, so the Bid Board's Notes show it.
- **Not done**: the Log contact press (a contact with its method, no verb yet), and anything sent
  to the customer.

## The doors that already exist

| Need | Door | Where |
|---|---|---|
| Set the link | `plan_bid_update` | live, v2.6945 |
| Make the project folder | `bid-photos` `make`, `ensureBidPhotoFolder` | `supabase/functions/bid-photos/index.ts`, `_shared/bidFolder.ts` |
| Read a Drive file's bytes and facts | the service account read | `_shared/devMcpDriveDoc.ts`, `_shared/driveUpload.ts` |
| Land a file in Sent by us | `drive-link` `put` with `where: 'sent'` | `supabase/functions/drive-link/index.ts` (`landingPath`) |
| A Drive refusal in words | `driveFilingRefusal` | `_shared/devMcpWrites.ts` |
| A note on the bid | `plan_activity_note` | live |

Until it is built: `plan_bid_update` links a file that is already where it belongs,
`plan_mail_file` files a submission that came by mail, and `plan_activity_note` leaves the words.

## How to build it

- One PR from fresh main: the kernel (`_shared/devMcpBidSubmission.ts`) with unit tests on a
  made-up bid, the wiring, the README rows, `EDGE_FUNCTIONS.md`, `GLOSSARY.md`,
  `ACCESS_CONTROL.md`, a release note and its fragment, a claimed version. Card #317's kit (branch
  `claude/bid-train-handoff`, and the scripts beside the bid train's hand-over note) shows how the
  last six seat PRs moved their pins.
- Other dev seat PRs land often and each bumps the server version: take the next free one at the
  merge-up and never push a version another open PR holds.
- No migration: the rows are `bids` under RLS as the dev; the Drive side is the service account's.

## As built (v2.7154)

- The ask is `submission = { bid, drive_file_id | drive_url, replace? }`; `bid` is an id or text that finds one bid.
- "The company's Shared Drive" is the one that holds the jobs root (Documents → Where files go). A file in it is copied by Drive; any other is read on the server and put through `drive-link`, 10 MB at most.
- A paper whose bytes are already in Sent by us (the same name, size and md5, or the file itself) is not copied again: only the link and the note are written.
- Several papers on one bid: each is filed in Sent by us and the newest filed keeps the link. The owner's call on the folder as the link is still open.
- A Google Doc, Sheet or Slides is refused: it can still be edited, so it is not the paper that was sent. Download it as a PDF.
- The plan reads Drive on a `drive.readonly` token; the full token is minted in the copy alone, after the hash matched.
- `read_drive_folder` runs with a dev's own key alone and is refused under `view_as`: the service account sees more than any one person.
- The fragment is `docs/recent-features/v2.7154.md`; the README row says what the pair does not do.

## Walked on prod (2026-11-13, server 0.82.0)

- `read_drive_folder` on b398's project folder listed its five folders and three files, each marked as in the company's Shared Drive. The `drive.readonly` token minted. One file's facts came back with its path and its sharing. A made-up folder id was refused in the words that name the share.
- `plan_bid_submission` on b398 with a made-up PDF from its own folder: how `copy`, the folder there already, Sent by us holding one other paper, the link before empty.
- `apply_bid_submission` of that plan: the copy is in Team only › Sent by us with the same md5 and sha256, `bid_submission_link` points at it, the note is on the bid's Notes. b398 now carries that link, so a plan on it needs `replace: true`.
- A second apply of the same plan was refused. The words were the plan's own ("already carries this paper"), since the dry run refuses before the call log is asked. The log's "already applied" sentence shows only where the dry run still passes.
- On a fresh ZZ bid, b605, made with `plan_bid` and no folder, the same afternoon:
  - **The folder made at the apply.** The plan named the folder it would get; the apply made it through `bid-photos` `make` under the jobs root, the function wrote `bids.drive_link`, and the paper was copied into its new Team only › Sent by us.
  - **`replace: true`.** A second paper without it was refused with the link named. With it, the copy was filed, the link moved to it, and the note says which link it took the place of.
  - **A file outside the company's Shared Drive.** A made-up PDF in the People Shared Drive planned as `upload`. The apply read it on the server and put it through `drive-link`; the filed copy has the plan's size, md5 and sha256.
  - The folder now holds three papers and the bid's link is the newest filed.
- Left on prod as test rows: b605, its Drive folder with three papers, and three notes on its Notes. b398 keeps the link from its walk.

## How to verify

- Dry run on b398 "ZZ Test": the plan names the folder it would make or use, the file's facts and
  the link before and after.
- With the owner's word, one apply on a ZZ bid with a made-up file: the file in Team only › Sent by
  us, the link on the bid, the note on its Notes, and a second apply of the same plan refused.
- `read_drive_folder` on the jobs root and on a folder the account cannot open.
