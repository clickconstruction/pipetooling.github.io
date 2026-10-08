# P2b: the trade portal's first presses (Portal lane)

The plan for P2b of `PORTAL_REAL_BUILD.md` (*The PRs, in order*, item 4). It follows P2a (#4958), whose twelve `gc_trade_<verb>` functions it calls, and P1b-ii-b (#4955), whose page it adds the presses to. It has no migration.

It comes as two PRs:

- **P2b-i, the function:** `submit-gc-trade-portal`, its pure rules in `_shared/gcTradeSubmit.ts`, the shared link resolution, and the words for every refusal. There are no presses yet, so nothing on screen changes. The lead deploys it after the merge, together with `gc-trade-portal`, which moves to the shared resolution.
- **P2b-ii, the presses:** the page's forms and buttons, each calling the function and then reading the slice again (decision 10). It needs P2a's types after the lead's push.

## P2b-i: `submit-gc-trade-portal`

`POST { token, kind, website?, ...fields }`. It has `verify_jwt = false`, uses the service role, and answers `{ ok: true, id? }` or `{ error: key }`.

### The order of the checks

1. **Method.** Not `POST`: `405 badRequest`. `OPTIONS` answers CORS.
2. **Honeypot.** A filled `website` answers `{ ok: true }` and writes nothing, as on the sub portal.
3. **Shape.** `parseTradeSubmit(body)` checks the kind and its fields:
   - each id is a uuid and each day is `YYYY-MM-DD`;
   - texts are trimmed and kept under their caps: a name up to 120, a role up to 80, an email up to 254, a note or a question up to 2,000;
   - the kinds of email are filtered to the four known.
   A shape it cannot read answers `400 badRequest`.
4. **The sample token** (`sample`, `sampleStateFromToken`) answers `{ ok: true, sample: true }` and writes nothing, so What customers see's walk never errors (decision 12).
5. **Token length.** Under 16 or over 128 answers `400 badRequest`.
6. **The link.** `resolveTradeLink(token, find)` tries the raw token, then its SHA-256 hash, and treats a link with `revoked_at` as off. No link, or an off one, answers `404 linkOff`.
   - It lives in `_shared/gcTradeLink.ts`, and `gc-trade-portal` moves to it too, so the read and the writes resolve a link one way.
7. **Spanish held.** `set_lang` with `es` while `PORTAL_SPANISH_ON` is false answers `400 spanishHeld` (decision 8). The flag is copied into `_shared/gcTradeSubmit.ts`, and a test holds the copy equal to `portalI18n.ts`'s.
8. **The hourly cap.** The free-text kinds are `submit_quote`, `quote_day`, `add_person` and `ask_question`. Each is refused with `429 tooMany` once the company has made **10** free-text writes in the last hour. The count is the sum of four counts, with no new table:
   - its `gc_plan_questions` rows;
   - its `gc_company_people` rows `added_by = 'trade'`;
   - its `gc_quotes` rows `source = 'trade'`;
   - its `gc_company_contacts` lines `how = 'portal'`.
   The rule is `overHourlyCap(counts)` in the kernel. The other kinds are clicks, not text, and the cap does not apply.
9. **The verb.** The function calls the kind's `gc_trade_<verb>` with the link's company first. A refusal from the SQL is `P0001` with the key as its message. `tradeErrorOf(error)` passes a known key through with its status. Anything else answers `500 failed` and is logged.

### The kinds and their fields

| kind | fields | calls |
|---|---|---|
| `got_it` | none | `gc_trade_got_it(company)` |
| `set_lang` | `lang` (en, es) | `gc_trade_set_lang` |
| `add_person` | `name`, `email`, `role`, `gets[]` | `gc_trade_add_person` |
| `remove_person` | `personId` | `gc_trade_remove_person` |
| `set_gets` | `personId` (null: the main contact), `gets[]` | `gc_trade_set_gets` |
| `open_plans` | `inviteId` | `gc_trade_open_plans` |
| `quote_day` | `inviteId`, `by` | `gc_trade_quote_day` |
| `submit_quote` | `inviteId`, `quote` `{amount, includes, note, goodForDays, alternates, sov, exclusions, exclusionsAnswered}` | `gc_trade_submit_quote` |
| `confirm_quote` | `inviteId` | `gc_trade_confirm_quote` |
| `answer_lines` | `inviteId`, `answers` `{lineId: yes \| no}` | `gc_trade_answer_lines` |
| `decline` | `inviteId` | `gc_trade_decline` |
| `ask_question` | `packageId`, `text`, `sheets[]` | `gc_trade_ask_question` |

### The error keys the page says

Every key has words in both languages in `portalI18n.ts`. The words test fails when a key the function or the SQL can answer has none. The keys come from three places:

- **The function:** `badRequest` 400, `linkOff` 404, `spanishHeld` 400, `tooMany` 429 and `failed` 500.
- **The SQL, refusing a state:** each answers 409. They are `notYours`, `projectLost`, `youPassed`, `openFirst`, `alreadyQuoted`, `noQuote`, `nothingToAnswer`, `dayPassed`, `notOnTrade`, `questionsClosed` and `everyKindNeedsSomeone`.
- **The SQL, refusing a field:** each answers 400. They are `amountNeeded`, `answerEach`, `sovMustAdd`, `nameNeeded`, `emailNeeded`, `pickAKind`, `questionNeeded` and `tooLong`. The SQL's own `notFound` answers 404.

The words are the portal's voice, one sentence each, with no blame. For example, `tooMany` reads: *That is a lot at once. Give us an hour, or call our office.*

### Tests (P2b-i)

- **`gcTradeSubmit.test.ts`:**
  - every kind's shape, good and bad: a field missing, a non-uuid id, an over-long text, an unknown kind, unknown kinds of email dropped;
  - `overHourlyCap` at 9 and at 10, and only for the free-text kinds;
  - `tradeErrorOf` for every SQL key, an unknown P0001 message, and a non-P0001 error;
  - the sample token recognized;
  - the Spanish flag equal to `portalI18n.ts`'s.
- **`gcTradeLink.test.ts`:** the raw token found first, the hash found when the raw is not, an off link answering null, and no lookup by hash when the raw matched.
- **The words test:** every key in `TRADE_SUBMIT_ERROR_KEYS` has words in both languages, and passes the voice scan.

### Docs (P2b-i)

- `docs/EDGE_FUNCTIONS.md`: a section and TOC line for `submit-gc-trade-portal`, and `gc-trade-portal`'s section noting the shared resolution.
- `config.toml`'s `verify_jwt = false` block.
- The dev-mcp catalog, regenerated.
- `ACCESS_CONTROL.md`'s Trade portal section gains the write path.
- A release note and a fragment.

## P2b-ii: the presses

These are ported from the spike's `GcTradePortal.tsx` (BidBlock), `GcPortalBidExtras.tsx`, `GcPortalQuestions.tsx`, `GcPortalPeople.tsx` and `GcPortalHome.tsx` (Welcome). Each press posts to the function with `staffAwarePublicHeaders()`, then reads the slice again.

- **Got it** on a first visit's welcome. **Español** stays hidden while Spanish is held.
- **Who gets our emails:** add a person, take one off, and tick the kinds of email for each person and for the main contact.
- **Open the plans:** a tap on the plans link calls `open_plans` first.
- **The quote day.**
- **The quote form:** the number, a tick for each line, how long it is good for, a note, their schedule of values, alternates, and what it leaves out. There is no file until P5a, so the picker says to email it to the project manager.
- **Confirm** after a new set, **answer the lines**, **Pass**, and **ask about the plans**.
- **The office's preview** (`?preview=1`) shows the presses, but each says *Preview. Nothing is saved from here.* and posts nothing.
- **A refusal** shows its words under the press that made it.
- **Tests:** a render test per press with the function faked, checking the call, the second read and the error words. Plus a live walk on the test link.

## Checks (the plan's, from PORTAL_REAL_BUILD.md)

On the test link (`ff11d0fb`):

- the quote day shows on the office's Follow up;
- a quote shows on the Trades tab and on Compare;
- a question appears in the questions window as from the test company;
- a second person ticked for pay is kept;
- eleven questions in an hour are refused on the eleventh, in the portal's words.
