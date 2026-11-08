---
name: "Messages: an email as rich text, the HTML part kept"
number: 259
group: close
status: built 2026-11-08 on the owner's yes of 2026-11-07 · PR 1 v2.6675 (#7280, the reader keeps the HTML part, one migration) and PR 2 v2.6676 (the Rich text · Plain switch) queued with auto-merge · the live check is the owner's
summary: >
  Grace asked to read an email as rich text or as plain words, the reader's choice. The bids@ reader
  now keeps each inbound email's HTML part at <line id>/body.html in the message-attachments bucket,
  messages.body_html_path naming it, and the message window draws Rich text · Plain over the words,
  the rich view through DOMPurify pinned with pictures off until Show pictures. Older lines stay plain.
next: The owner's live check once PR 1's migration is pushed and gmail-sync redeployed, then PR 2 deployed. Open one real email in Messages that came in after the redeploy, press Rich text, press Show pictures. Delete nothing, the check reads.
ver: v2.6675 (PR 1) · v2.6676 (PR 2)
size: M · PR 1 the reader's write and a migration · PR 2 the switch, a sanitizer and images off until pressed
blocker: none since the owner's yes of 2026-11-07
opinion: keep it as `<line id>/body.html` in the private message-attachments bucket, never a column; draw it through DOMPurify pinned, scripts, forms, remote styles and tracking pixels stripped, images off until Show pictures; every link opening in a new tab as the plain view's do
mockup: not required — the switch is two chips over the words the viewer already draws; the decision is about storage, not a screen
---

# Messages: an email as rich text, the HTML part kept (#259)

## Where it stands

Built 2026-11-08, the night after the owner's yes. PR 1 (v2.6675, #7280) is the reader's write: `EmailIn.html`,
`keepHtml` in `gmail-sync`, the column `messages.body_html_path` (`20261108020000_messages_body_html_path.sql`). PR 2
(v2.6676) is the switch: `RichMailView.tsx` over `richMailIo.ts`, `richMail.ts` and `richMailDom.ts`, DOMPurify 3.4.17
pinned, the guide section *Read an email as the sender laid it out*. Order on prod: push the migration, deploy
`gmail-sync`, then PR 2's client (`check:calls-ahead` holds it until the push). The live check below is the owner's.

## The ask

Grace, 2026-11-04, on Glenn Geling's invitation to bid in the message window: "when looking at an
email, I would like the option to see it as rich text or in the current format". The plain view's
half of the ask shipped as v2.6508: a web address in the words is one press with a link mark, the
doubled `url <url>` reads once, the sender's `*bold*` reads bold.

## What exists and what does not

- `gmail-sync` reads both the plain and the HTML part of every email that reaches bids@
  (`readGmailMessage`), keeps the text (the plain part, else the HTML read as text) in
  `messages.body` and the HTML's `href`s as `message_attachments` rows of kind `link`, and drops
  the HTML.
- `messages` has no HTML column. No bucket holds the raw message for bids@ mail. The My email tag
  (v2.6266) keeps `mine/<line id>.eml` for a tagged conversation only, a MIME file the client cannot
  read, and not the path an invitation takes.
- `src/lib/sanitizeContractSigningHtml.ts` sanitizes the office's own contract HTML, written by us;
  it was never meant for a stranger's email and is not the sanitizer for this.

## What it would store, where, and why

- **What:** the `text/html` part of each inbound email as it came, once per line, after the reader
  has kept the text. A signature's inline pictures (`cid:`) stay in Gmail as today; the view shows
  them off until pressed. Roughly 20 to 200 KB per email against the few KB the text takes.
- **Where:** the private `message-attachments` bucket, at `<line id>/body.html`, read through the
  same office policy and minute-long signed URL the kept files use (`/files/messages/<id>`). A
  column on `messages` would make every thread read heavier for a part most lines never open.
- **Why:** the sender's layout — tables of scope, numbered addenda, a GC's formatted schedule —
  reads as a flat list in the text, and a linked word loses its link (the plain part carries the
  address only where the mail client wrote it in). The HTML keeps both.

## The plan

1. **PR 1, the reader keeps it.** `gmail-sync` writes the HTML part to the bucket after the line is
   written, best effort, and a column `messages.body_html_path` (or a `message_attachments` row of
   a new kind `body_html`) names it. Migration with `SET lock_timeout = '3s'`; the fences on any new
   table. Back-fill: none. Older lines stay plain.
2. **PR 2, the switch.** Two chips at the top of the message window's words, **Rich text** ·
   **Plain**, remembered per person on the device (localStorage in try/catch), the HTML drawn through
   DOMPurify from a pinned version with scripts, forms, event handlers, remote stylesheets and
   tracking pixels stripped, images off by default with **Show pictures**, every link
   `target="_blank" rel="noopener noreferrer"` as `MessageBody` draws them. A line with no kept HTML
   shows no switch. The guide section *Open a link in an email's words* gains the switch.

## How to verify

The owner, on the live app once the reader is redeployed: open one real email in Messages that came in
after the redeploy (an older line draws no chips). Plain reads the v2.6508 view. Press **Rich text**: the
sender's table and linked words read as laid out, a linked word opens in a new tab, pictures are blank.
Press **Show pictures**: the sender's pictures load. Reload: the window opens on Rich text. Nothing to
delete, the check only reads.
