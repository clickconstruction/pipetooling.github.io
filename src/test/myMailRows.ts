/**
 * Made-up mail for the My email smokes (punch list #230 PR 3): Marisol Vega's own box, as the mock-up draws it
 * (`to-dos/messages-my-email/mockup.html`). Dale Okafor at Ridgeway Builders, Priya Nair at Cedar Bend HOA, Harlan
 * Freight, a newsletter, and a mail the bids@ reader already holds. Nobody here is a real person, and nothing is a live
 * row. `fakeMyMailIo` answers the four actions over these rows, each a `vi.fn` the smoke can read or replace.
 */
import { vi, type Mock } from 'vitest'
import type { MyMailJobChip, MyMailListOk, MyMailOpenOk, MyMailRow, MyMailTagOk, MyMailUntagOk } from '../lib/myMail/contract'
import type { MyMailIo } from '../lib/myMail/myMailIo'

export const MARISOL = 'marisol@clickplumbing.example'
/** The rows' clock: 2 PM in Chicago on Sunday, Nov 1. */
export const MY_MAIL_NOW = '2026-11-01T20:00:00.000Z'

export const ELM: MyMailJobChip = { kind: 'pipeline', id: 'job-elm', key: 'pipeline:job-elm', num: 'JP1077', name: '4 Elm Ct' }
export const CEDAR: MyMailJobChip = { kind: 'bid', id: 'bid-cedar', key: 'bid:bid-cedar', num: 'BP523', name: 'Cedar Bend clubhouse' }

export function mailRow(gmailId: string, over: Partial<MyMailRow> = {}): MyMailRow {
  return {
    gmailId,
    threadId: `t-${gmailId}`,
    direction: 'in',
    who: { name: 'Dale Okafor', address: 'dale@ridgeway.example' },
    subject: 'Re: 4 Elm Ct water heater',
    snippet: 'Owner wants the 50-gal, not the 40. Can you price the difference before Thursday?',
    at: '2026-11-01T15:12:00.000Z',
    files: 0,
    folded: null,
    tagged: null,
    guess: null,
    inMessages: null,
    ...over,
  }
}

/** The page the mock-up's list draws, newest first once a view sorts it. */
export const MY_MAIL_ROWS: MyMailRow[] = [
  mailRow('dale-new', { files: 1, guess: { ...ELM, why: 'the subject names 4 Elm Ct' } }),
  mailRow('priya-out', {
    direction: 'out',
    who: { name: 'Priya Nair', address: 'priya@cedarbend.example' },
    subject: 'Cedar Bend clubhouse · our number',
    snippet: 'Attached is the pricing package for the clubhouse re-pipe. Alternates on page 3.',
    at: '2026-10-31T17:30:00.000Z',
    guess: { ...CEDAR, why: 'the subject names Cedar Bend clubhouse' },
  }),
  mailRow('harlan', {
    who: { name: 'Harlan Freight', address: 'ap@harlanfreight.example' },
    subject: 'Invoice 88412',
    snippet: 'Please find attached invoice 88412 for delivery on Oct 27.',
    at: '2026-10-26T14:00:00.000Z',
    files: 1,
  }),
  mailRow('dale-old', { threadId: 't-dale-old', snippet: 'Yes, go ahead with the 40 for now.', at: '2026-10-24T19:03:00.000Z', tagged: { ...ELM, messageId: 'm-elm-1' } }),
  mailRow('news', { who: { name: 'Pipe Weekly', address: 'news@pipeweekly.example' }, subject: 'This week in pipe', snippet: 'Five fittings you should know.', at: '2026-10-30T12:00:00.000Z', folded: 'bulk' }),
  mailRow('box', { who: { name: 'Dale Okafor', address: 'dale@ridgeway.example' }, subject: 'JP1077 permit', snippet: 'Permit is posted.', at: '2026-10-20T15:00:00.000Z', inMessages: { messageId: 'm-box-1', jobKey: ELM.key } }),
]

export const MY_MAIL_PAGE: MyMailListOk = { ok: true, address: MARISOL, rows: MY_MAIL_ROWS, nextPageToken: 'tok-2', folded: 1 }

/** The mail whole, for the reader. */
export function openedMail(row: MyMailRow, over: Partial<MyMailOpenOk['mail']> = {}): MyMailOpenOk {
  return {
    ok: true,
    mail: {
      ...row,
      to: row.direction === 'out' ? [row.who] : [{ name: 'Marisol Vega', address: MARISOL }],
      cc: [],
      bodyText: `Marisol,\n\n${row.snippet}\n\nDale`,
      bodyHtml: null,
      fileList: row.files > 0 ? [{ name: 'elm-ct-spec-sheet.pdf', mime: 'application/pdf', size: 212_000 }] : [],
      threadCount: 3,
      threadRows: [],
      ...over,
    },
  }
}

export const TAG_OK: MyMailTagOk = { ok: true, jobKey: ELM.key, lines: 2, tied: 1, files: 1, contactId: 'c-dale', unknownSender: null }
export const UNTAG_OK: MyMailUntagOk = { ok: true, removed: 3, keptForMatter: false }

export type FakeMyMailIo = { [K in keyof MyMailIo]: Mock<MyMailIo[K]> }

/** The four actions over the rows above; pass any to answer otherwise. */
export function fakeMyMailIo(over: Partial<MyMailIo> = {}): FakeMyMailIo {
  return {
    list: vi.fn<MyMailIo['list']>(over.list ?? (async () => MY_MAIL_PAGE)),
    open: vi.fn<MyMailIo['open']>(over.open ?? (async ({ gmailId }) => openedMail(MY_MAIL_ROWS.find((r) => r.gmailId === gmailId) ?? mailRow(gmailId)))),
    tag: vi.fn<MyMailIo['tag']>(over.tag ?? (async () => TAG_OK)),
    untag: vi.fn<MyMailIo['untag']>(over.untag ?? (async () => UNTAG_OK)),
  }
}
