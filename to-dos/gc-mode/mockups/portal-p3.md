# P3: every email to a trade partner, from one sender (Portal lane)

The plan for P3 of `PORTAL_REAL_BUILD.md` (*The PRs, in order*, item 5). Today nothing emails a trade partner. After P3, every lane that writes to a company calls one function by kind:

- B4's Ask window: `invite` and `nudge`.
- New project's step 7: `plans`.
- The questions window: `answer`.
- B5, B6, U6, O3 and the schedule: their kinds, as they land.

There is no migration: the messages table rode in P1a. It comes as two PRs:

- **P3-a, the sender:** `gc-trade-email`, the frame `_shared/gcTradeEmail.ts`, the sent copy, What customers see's step and sample, and the docs. Nothing calls it yet, so nothing is sent until a lane presses.
- **P3-b, the first caller:** `answer` from the questions window. When the office records an answer, every company on the trade it was sent to gets it. Step 7 (Helper 6) and the Ask window (Helper 2) switch to the sender in their own PRs the evening P3-a is deployed.

## The contract (agreed with Helpers 2 and 6, 2026-10-08)

`POST { companyId, kind, key, projectId | null, lang, subject, lines, group? }`, with a staff JWT.

- **`lines`** is `Array<string | { title?: string, items: string[] }>`: a string is a paragraph, and an object is a list under its title. The lines come without the greeting. The server trims each and drops the empty ones.
- **`key`** is the message's dedupe key, unique per company. An invitation's key is `<invite id>:invite`, and a set's is `<projectId>:plans:<rev>`.
- **`lang`** comes from the company's record. While Spanish is held it must be `en`.
- **`group`** is only for kind `paper` (the company window's paper sends): `contracts` or `pay`. Every other kind takes its group from the kind.
- **Success:** `200 { companyId, messageId, emailSendLogId, to }`, where `to` is the names it went to.
- **A repeated key** answers `200 { …the first send's ids, already: true }` and sends nothing.

## The checks, in order

1. `OPTIONS` answers CORS. Anything but `POST` is `405 badRequest`.
2. **The caller**: a staff JWT is required, else `401 signIn`.
   - Dev only until the portal's door, else `403 officeOnly`. At the door it becomes the office roles, `gc_office_team()`'s.
   - A training account or a digital twin is `403 readOnly`.
3. **The shape** (`parseTradeEmail`, pure): the kind is one of the 19 `PortalMessage` kinds or `paper`, and the ids are uuids.
   - The key is 1 to 200 characters, the subject 1 to 200, and there are at most 40 lines of 2,000 characters each.
   - `paper` needs its group.
   - Anything else is `400 badRequest`.
4. **Spanish held**: `es` while `PORTAL_SPANISH_ON` is false is `400 spanishHeld`. The flag is copied, and a test holds it equal.
5. **The company** must exist, else `404 notFound`.
6. **The project**, when given: the company must have an ask on it (`gc_invites` by package), else `409 notOnProject`. A message about the company itself, such as the master agreement, passes `null`.
7. **Sent once**: a row in `gc_trade_messages` with the same company and key answers `already: true` with that row's ids.
8. **The recipients**: the kind's group, the same rule as main's `mailRecipients` and `portalMailGroup`.
   - `plans` and `answer` on a project past bidding go to `job`. The rest follow `KIND_GROUP`.
   - The people ticked for the group come first, then the main contact when the main contact gets it.
   - The rule is copied into `_shared/gcTradeEmail.ts`, and a test holds the copy to main's kernels on the same records.
   - Anyone without an email is skipped. No one left is `422 noEmail`, with no row.
9. **The link**: the company's link that is on. If none is, the function makes one, with the same rules as `mint_gc_trade_portal_link` (a 64-character token, its hash, and one on per company).
   - A first invitation carries the company's link. Before the door only a dev can call this, so only a dev's press makes a link.
10. **The frame**: `buildGcTradeEmail({ lang, recipients, subject, lines, linkUrl, signer, gc })`. It is pure, and the function and What customers see's sample read the same builder.
11. **Send**: `sendEmailViaResend`.
    - `to` is the first recipient and `cc` is the rest.
    - It is from `Click Construction <the EMAIL_FROM address>`, built by `mailboxWithName`, not `COMPANY_EMAIL_FROM`, which names the plumbing company.
    - Reply-To is the project's project manager, else the sender.
    - `emailType: 'gc_trade_email'` (a new `EMAIL_CATALOG` row), and `file:` for the sent copy.
    - A Resend failure is `502 sendFailed`. It writes no `gc_trade_messages` row, and `email_send_log` keeps it.
12. **The message row**: `gc_trade_messages` with:
    - the company, project, kind, group, key, language and subject;
    - `lines` as sent (after trimming), and `to_names`;
    - `sent_on` = the office's day, and `sent_by`;
    - `email_send_log_id`, looked up by the Resend id. It is best effort: null when the log row is not there.

## The frame

It uses the portal's paper look, in English, with the Spanish built and held.

- **Greeting**: `mHello` with the recipients' first names: "Hello Dana," then "Hello Marcus and Dana," then "Hello Marcus, Ana and Dana,". The words are `and` / `y`.
- **The lines**: a string is a paragraph, and a titled list is the title then its items.
- **The button**: `openPortal` to `APP_ORIGIN/t/<token>`, with the address printed under it. Then `linkYours`, and `thanks` with the signer and the company.
- **The words** live in a small table in `_shared/gcTradeEmail.ts` (`mHello`, `and`, `openPortal`, `linkYours`, `thanks`). A test holds each equal to `portalI18n.ts`.

## The sent copy, without the key

`file: { kind: 'gc_trade_email', title: subject, recipientName: company, source: { table: 'gc_trade_messages', id }, sentBy }`, filed after the message row is written.

The link in a trade email is a key to the company's portal. So `sentCopyKeptHtml` gains the kind `gc_trade_email`: the kept copy shows `/t/…` and never the token, the same as the law firm's link (SENT_COPIES.md, *A key is never kept*). That has a test.

`sent_documents` has no company key yet. The copy is found by kind and by its message row (`source_id`). A company column is SENT_COPIES' step 4 to decide.

## What customers see

- `CUSTOMER_SURFACES`: `{ kind: 'sender', ref: 'gc-trade-email', audience: 'sub', steps: [S('gc-trade-email')] }`.
- A step in the `sub` journey, after the portal: **GC mode: an email to a trade partner**.
  - It renders the email `gc-trade-email`, a new `SampleEmailId`.
  - It is built in the browser by the same `buildGcTradeEmail` from the sample company's invitation: `inviteMessage` on the sample state, to Dana Ortiz, linking `/t/sample`.
  - Its guide is the new `email-a-trade-partner-from-gc-mode`.
- `personJourney` answers it `na` for a sub, as it does the portal.

## Errors, as keys

| Key | Status | When |
|---|---|---|
| `badRequest` | 400 | a shape it cannot read |
| `spanishHeld` | 400 | `es` while Spanish is held |
| `signIn` | 401 | no staff session |
| `officeOnly` | 403 | not a dev (the office roles after the door) |
| `readOnly` | 403 | a training account or a digital twin |
| `notFound` | 404 | no company with that id |
| `notOnProject` | 409 | the company has no ask on that project |
| `noEmail` | 422 | nobody in the group has an email |
| `sendFailed` | 502 | Resend refused it |

The callers are office screens, so each says its refusal in office words from one map, `gcTradeEmailRefusal(key)`, in `src/lib/gc/`.

## Tests (P3-a)

- `gcTradeEmail.test.ts`:
  - the shape, good and bad, for every kind;
  - the group for each kind, with `plans` and `answer` turning to `job` past bidding;
  - the recipients against main's `mailRecipients` on the made-up companies;
  - the greeting for one, two and three names;
  - the frame's lines and its titled list;
  - the button's address;
  - the words held equal to `portalI18n.ts`;
  - the Spanish flag held equal.
- `sentCopyEmail.test.ts`: `gc_trade_email`'s kept copy shows `/t/…`, not the token.
- `customerSurfaceRegistry.test.ts` and `personJourney.test.ts` cover the new sender and step. `sentCopiesEmailCoverage.test.ts` passes, because the function files.
- Live, a dev's press on the test company only: an invitation to the inbox the owner names (his call 3) on "Test trade, delete me". It reaches the inbox with the link, reads the same on What customers see, sends once for the same key, and shows as sent in the company's Messages. The lead presses or confirms with Grace.

## Docs (P3-a)

- `docs/EDGE_FUNCTIONS.md`: a section and TOC line, plus the `config.toml` block if the function keeps `verify_jwt` (it reads the JWT itself, like `gc-plan-question-email`).
- `docs/SENT_COPIES.md`: the new kind and its key rule.
- `ACCESS_CONTROL.md`: who may send.
- The guide `email-a-trade-partner-from-gc-mode`.
- `GLOSSARY.md`.
- A release note and its fragment.
