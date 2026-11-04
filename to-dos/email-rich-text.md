---
name: "Messages: an email as rich text, the HTML part kept"
number: 259
group: gated
status: proposed 2026-11-04 from Grace's ask on the email viewer · v2.6508 shipped the plain view's one-press links and bold
summary: >
  Grace asked to read an email as rich text or as plain words, the reader's choice. The bids@ reader
  keeps an email's words as text and its links as rows; the HTML part is kept nowhere, so there is
  nothing to draw yet. Keeping it is a gmail-sync change with a storage cost and a migration, and the
  owner's call before any switch is built.
next: The owner says whether every inbound email's HTML is worth keeping. Then PR 1 keeps it and PR 2 draws it behind a Rich text · Plain switch.
size: M · PR 1 the reader's write and a migration · PR 2 the switch, a sanitizer and images off until pressed
blocker: The owner's call on storing the HTML part of every inbound email; the repo holds no sanitizer for mail HTML yet
opinion: keep it as `<line id>/body.html` in the private message-attachments bucket, never a column; draw it through DOMPurify pinned, scripts, forms, remote styles and tracking pixels stripped, images off until Show pictures; every link opening in a new tab as the plain view's do
mockup: not required — the switch is two chips over the words the viewer already draws; the decision is about storage, not a screen
---

# Messages: an email as rich text, the HTML part kept (#259)

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

Dev server as the dev, a ZZ Test thread with an email that carries a table and a linked word: Plain
reads the v2.6508 view, Rich text reads the table, the linked word opens in a new tab, pictures stay
blank until pressed, the choice survives a reload. Delete the ZZ rows after.
