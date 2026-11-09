---
name: "Messages: an email as rich text, the HTML part kept"
number: 259
group: close
status: built 2026-11-08 on the owner's yes of 2026-11-07 · PR 1 v2.6675 (#7280) and PR 2 v2.6676 (#7289) merged, the migration pushed and gmail-sync redeployed (edge drift clean) · the walk of 2026-11-08 found an older email drawing no switch, as designed; the first email the reader kept whole landed 2026-11-08 22:30 UTC and the Rich text, Show pictures and reload presses ran on it 2026-11-09 as the card says; nothing left but the owner's look
summary: >
  Grace asked to read an email as rich text or as plain words, the reader's choice. The bids@ reader
  now keeps each inbound email's HTML part at <line id>/body.html in the message-attachments bucket,
  messages.body_html_path naming it, and the message window draws Rich text · Plain over the words,
  the rich view through DOMPurify pinned with pictures off until Show pictures. Older lines stay plain.
next: The presses ran 2026-11-09 on the first email the reader kept whole (under *Where it stands*): Rich text drew the sender's layout, Show pictures turned the one picture on, a reload reopened on Rich text. Nothing left but the owner's look. One small follow-up when wanted: a signature's `cid:` picture is dropped by design (its bytes are in Gmail), so its frame stays blank after Show pictures even though the message window lists the same picture as an attachment kept on arrival; drawing it from that copy is a PR of its own.
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

**Walked 2026-11-08** (read-only, as the owner in his Chrome, the client at v2.6691): `npm run check:edge-drift` read every function current, `gmail-sync` among them, so the reader keeps the HTML part from here on. No inbound email had reached bids@ or the team box since the redeploy (the newest was 2026-11-06), so no line carries `body_html_path` yet and the Rich text and Show pictures presses could not be walked. An email from 2026-11-06 opened in the message window draws no Rich text · Plain chips and reads as plain words, as the release note says an older line does. Left: the owner's press on the first new email (`next`).

**Walked 2026-11-09** (the deployed client, signed in through the pane magic link in the Chrome the owner handed the session;
read-only). The dev seat found one inbound email line with `body_html_path` set: a GC's *Addendum 1* to bids@, sent Friday
Nov 6 and read by the reader at 22:30 UTC on 2026-11-08, after the redeploy, kept at `<line id>/body.html`. Opened from the
thread (`/messages?thread=<contact>&at=<line>`), the message window drew the two chips **Rich text** · **Plain** over the words
for the first time, Plain pressed. **Rich text** drew the sender's HTML on a white card as laid out (the bid date line, the
paragraphs, the signature block with name, title, address and two numbers) with **Show pictures** · *1 picture is off.* above
it. **Show pictures** took the off line away; the one picture is the signature's `cid:` inline image, which `richAttr` drops
by design (its bytes are in Gmail), so its frame drew empty; the same image is listed above as an attachment, *our copy kept
on arrival*, which is the follow-up in `next`. The reload reopened the window on **Rich text** (pressed) with pictures off
again, as designed. Nothing was deleted. Screenshots `259-1` to `259-4` in the walk session's scratchpad.

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
