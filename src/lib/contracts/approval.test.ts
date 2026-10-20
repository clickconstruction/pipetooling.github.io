import { describe, expect, it } from 'vitest'
import { APPROVERS, GREG, MARIA, MSA, MSA_CLAUSES, ROBERT, ROSA, WENDI, idsFrom } from '../../test/fixtures/clauseBookDemo'
import { plainWordsFailures } from '../plainWords'
import {
  CLAUSE_NOTIFY_LIVE,
  approveProposal,
  approvedToast,
  changeProblem,
  cleanScope,
  clauseNeeds,
  declineProposal,
  declinedToast,
  editClause,
  proposedToast,
  publishedToast,
  reachOfTold,
  scopeFor,
  type ClauseBook,
  type ClauseChange,
  type ClauseProposal,
  type DecideResult,
  type EditResult,
} from './approval'
import { assemblePaper, signedCopyOf } from './assemble'

const BOOK: ClauseBook = { paper: MSA, clauses: MSA_CLAUSES }
const AT = '2026-10-12T15:00:00Z'
const LATER = '2026-10-12T17:00:00Z'
const ctx = (newId = idsFrom('id'), at = AT, why = 'the insurer asked for it') => ({ at, why, approvers: APPROVERS, newId })
const editTwo: ClauseChange = { kind: 'edit', clauseId: 'msa-2', en: 'Insurance: general liability of $2,000,000 per occurrence.', es: '', scope: 'all' }
const when = (at: string) => (at === AT ? 'today, 10:00 AM' : 'today, 12:00 PM')

function proposed(r: EditResult): ClauseProposal {
  if (r.kind !== 'proposed') throw new Error(`expected a proposal, got ${r.kind}`)
  return r.proposal
}
function published(r: EditResult): ClauseBook {
  if (r.kind !== 'published') throw new Error(`expected a publish, got ${r.kind}`)
  return r.book
}
function decided(r: DecideResult) {
  if (r.kind !== 'decided') throw new Error(`expected a decision, got ${r.kind}: ${r.kind === 'refused' ? r.why : ''}`)
  return r
}

describe('editClause: the two paths', () => {
  it("sends Rosa's edit for approval and leaves the paper as it was", () => {
    const r = editClause(BOOK, editTwo, ROSA, { ...ctx(), told: false })
    const p = proposed(r)
    expect(p).toMatchObject({ paperId: 'msa', kind: 'edit', clauseId: 'msa-2', baseV: 1, by: 'Rosa', why: 'the insurer asked for it', state: 'proposed' })
    expect(p.en).toBe(editTwo.kind === 'edit' ? editTwo.en : '')
    expect(r.kind === 'proposed' && r.toast).toBe('It waits for Robert or Maria to approve it. Until then it is on their Needs you.')
    expect(BOOK.paper.revision).toBe(1)
    expect(BOOK.clauses[1]?.v).toBe(1)
  })

  it('says who got the push and the email once the sends are live (messages-notify)', () => {
    expect(CLAUSE_NOTIFY_LIVE).toBe(true)
    const r = editClause(BOOK, editTwo, ROSA, ctx())
    expect(r.kind === 'proposed' && r.toast).toBe('Sent to Robert and Maria with a push and an email. It goes out once one of them approves it. Until then it waits on their Needs you.')
  })

  it('says how the call reached them: both ways, one way, or nobody told', () => {
    expect(proposedToast(['Maria'], reachOfTold({ pushSent: 2, emailSent: 1 }))).toBe('Sent to Maria with a push and an email. It goes out once Maria approves it. Until then it waits on their Needs you.')
    expect(proposedToast(['Maria'], reachOfTold({ pushSent: 0, emailSent: 1 }))).toBe('Sent to Maria by email. It goes out once Maria approves it. Until then it waits on their Needs you.')
    expect(proposedToast(['Maria'], reachOfTold({ pushSent: 1, emailSent: 0 }))).toBe('Sent to Maria with a push. It goes out once Maria approves it. Until then it waits on their Needs you.')
    expect(proposedToast(['Maria'], reachOfTold(null))).toBe('It waits for Maria to approve it. Until then it is on their Needs you.')
    expect(proposedToast(['Maria'], reachOfTold({ pushSent: 0, emailSent: 0 }))).toBe('It waits for Maria to approve it. Until then it is on their Needs you.')
  })

  it("publishes Maria's own edit at once: the clause's version and the paper's revision each one up", () => {
    const r = editClause(BOOK, editTwo, MARIA, ctx())
    const book = published(r)
    expect(book.paper).toMatchObject({ revision: 2, publishedAt: AT })
    expect(book.clauses.find((c) => c.id === 'msa-2')).toMatchObject({ v: 2, en: 'Insurance: general liability of $2,000,000 per occurrence.' })
    expect(r.kind === 'published' && r.change).toEqual({ kind: 'edit', clauseId: 'msa-2', v: 2, revision: 2, by: 'Maria', proposedBy: null, at: AT, why: 'the insurer asked for it' })
    expect(r.kind === 'published' && r.toast).toBe('Published as version 2. The next master services agreement sent carries it. Signed copies keep their words.')
  })

  it('publishes a dev’s edit at once too', () => {
    expect(editClause(BOOK, editTwo, ROBERT, ctx()).kind).toBe('published')
  })

  it('refuses anyone outside the office, the superintendent first', () => {
    expect(editClause(BOOK, editTwo, WENDI, ctx())).toEqual({ kind: 'refused', why: 'Only the office changes a clause.' })
    expect(editClause(BOOK, editTwo, { ...ROSA, role: null }, ctx()).kind).toBe('refused')
  })

  it('adds a new clause after the last one, as version 1, with its trades cleaned', () => {
    const book = published(editClause(BOOK, { kind: 'new', en: ' Paving: a proof roll before the base course. ', es: '', scope: [' Paving ', 'paving', 'Sitework'] }, ROBERT, ctx(idsFrom('clause'))))
    expect(book.clauses.slice(-1)[0]).toEqual({ id: 'clause-1', order: 9, en: 'Paving: a proof roll before the base course.', es: '', scope: ['Paving', 'Sitework'], v: 1, retiredAt: null, retiredBy: null })
    expect(book.paper.revision).toBe(2)
  })

  it('retires a clause without deleting it, and keeps its version', () => {
    const r = editClause(BOOK, { kind: 'retire', clauseId: 'msa-6' }, MARIA, ctx())
    const book = published(r)
    expect(book.clauses).toHaveLength(MSA_CLAUSES.length)
    expect(book.clauses.find((c) => c.id === 'msa-6')).toMatchObject({ v: 1, retiredAt: AT, retiredBy: 'Maria' })
    expect(r.kind === 'published' && r.toast).toBe('Retired. The next master services agreement sent leaves it out. Signed copies keep it.')
  })
})

describe('changeProblem', () => {
  it('names what is missing or wrong, in the editor’s words', () => {
    expect(changeProblem(BOOK, { ...editTwo, en: '   ' })).toBe('Write the clause.')
    expect(changeProblem(BOOK, { kind: 'new', en: 'x', es: '', scope: [' ', ''] })).toBe('Pick who it applies to.')
    expect(changeProblem(BOOK, { ...editTwo, clauseId: 'nope' })).toBe('That clause is not on the master agreement.')
    const retired = { ...BOOK, clauses: MSA_CLAUSES.map((c) => (c.id === 'msa-2' ? { ...c, retiredAt: AT, retiredBy: 'Maria' } : c)) }
    expect(changeProblem(retired, editTwo)).toBe('That clause is retired already.')
    expect(changeProblem(retired, { kind: 'retire', clauseId: 'msa-2' })).toBe('That clause is retired already.')
  })

  it('calls the same words and the same trades no change, however they are spelled', () => {
    const six = MSA_CLAUSES[5]!
    expect(changeProblem(BOOK, { kind: 'edit', clauseId: 'msa-6', en: ` ${six.en} `, es: '', scope: [' sitework'] })).toBe('Nothing changed.')
    expect(changeProblem(BOOK, { kind: 'edit', clauseId: 'msa-6', en: six.en, es: '', scope: ['Sitework', 'Paving'] })).toBeNull()
    expect(changeProblem(BOOK, { kind: 'edit', clauseId: 'msa-6', en: six.en, es: '', scope: 'all' })).toBeNull()
    expect(changeProblem(BOOK, { kind: 'edit', clauseId: 'msa-6', en: six.en, es: 'Servicios: …', scope: ['Sitework'] })).toBeNull()
  })

  it('keeps each trade once, in the order picked', () => {
    expect(cleanScope(['Electrical', ' electrical ', 'Electrical,  low voltage', ''])).toEqual(['Electrical', 'Electrical, low voltage'])
    expect(cleanScope('all')).toBe('all')
  })
})

describe('approveProposal and declineProposal', () => {
  it("publishes Rosa's change as she wrote it once Maria approves", () => {
    const p = proposed(editClause(BOOK, editTwo, ROSA, ctx()))
    const r = decided(approveProposal(BOOK, p, MARIA, { at: LATER, newId: idsFrom('clause'), told: false }))
    expect(r.book?.clauses.find((c) => c.id === 'msa-2')).toMatchObject({ v: 2, en: 'Insurance: general liability of $2,000,000 per occurrence.' })
    expect(r.book?.paper.revision).toBe(2)
    expect(r.proposal).toMatchObject({ state: 'approved', decidedBy: 'Maria', decidedAt: LATER })
    expect(r.change).toMatchObject({ by: 'Maria', proposedBy: 'Rosa', why: 'the insurer asked for it', v: 2 })
    expect(r.toast).toBe('Approved by Maria. The next paper sent carries it.')
    expect(decided(approveProposal(BOOK, p, MARIA, { at: LATER, newId: idsFrom('clause') })).toast).toBe('Approved by Maria. Rosa gets an email that it went out. The next paper sent carries it.')
  })

  it('gives an approved new clause its id and its place at the end', () => {
    const p = proposed(editClause(BOOK, { kind: 'new', en: 'Notices: by email to the address on file.', es: '', scope: 'all' }, ROSA, ctx()))
    expect(p).toMatchObject({ clauseId: null, baseV: null })
    const r = decided(approveProposal(BOOK, p, ROBERT, { at: LATER, newId: idsFrom('clause') }))
    expect(r.book?.clauses.slice(-1)[0]).toMatchObject({ id: 'clause-1', order: 9, v: 1, scope: 'all' })
  })

  it('retires a clause once a retire is approved, and says the next paper leaves it out', () => {
    const p = proposed(editClause(BOOK, { kind: 'retire', clauseId: 'msa-6' }, ROSA, ctx()))
    expect(p).toMatchObject({ kind: 'retire', clauseId: 'msa-6', baseV: 1, en: MSA_CLAUSES[5]?.en, scope: ['Sitework'] })
    const r = decided(approveProposal(BOOK, p, MARIA, { at: LATER, newId: idsFrom('clause'), told: false }))
    expect(r.book?.clauses.find((c) => c.id === 'msa-6')).toMatchObject({ retiredAt: LATER, retiredBy: 'Maria' })
    expect(r.toast).toBe('Approved by Maria. The next paper sent leaves it out.')
  })

  it('refuses a proposal the clause has moved on from, so a newer publish is never overwritten', () => {
    const p = proposed(editClause(BOOK, editTwo, ROSA, ctx()))
    const robert = published(editClause(BOOK, { ...editTwo, en: 'Insurance: $1,500,000 per occurrence.' }, ROBERT, ctx()))
    expect(approveProposal(robert, p, MARIA, { at: LATER, newId: idsFrom('clause') })).toEqual({
      kind: 'refused',
      why: 'Clause 2 changed since Rosa proposed this. Decline it and ask Rosa to propose it again.',
    })
    expect(robert.clauses.find((c) => c.id === 'msa-2')?.en).toBe('Insurance: $1,500,000 per occurrence.')
  })

  it('makes the second of two proposals on one clause stale once the first is approved', () => {
    const first = proposed(editClause(BOOK, editTwo, ROSA, ctx(idsFrom('a'))))
    const second = proposed(editClause(BOOK, { ...editTwo, en: 'Insurance: $3,000,000 per occurrence.' }, { ...ROSA, name: 'Ana', userId: 'u-ana', role: 'estimator' }, ctx(idsFrom('b'))))
    const after = decided(approveProposal(BOOK, first, MARIA, { at: LATER, newId: idsFrom('clause') }))
    const r = approveProposal(after.book!, second, MARIA, { at: LATER, newId: idsFrom('clause') })
    expect(r.kind === 'refused' && r.why).toBe('Clause 2 changed since Ana proposed this. Decline it and ask Ana to propose it again.')
  })

  it('refuses a change to a clause retired since', () => {
    const p = proposed(editClause(BOOK, editTwo, ROSA, ctx()))
    const retired = published(editClause(BOOK, { kind: 'retire', clauseId: 'msa-2' }, MARIA, ctx()))
    expect(approveProposal(retired, p, MARIA, { at: LATER, newId: idsFrom('clause') })).toEqual({ kind: 'refused', why: 'That clause is retired since Rosa proposed this. Decline it with a why.' })
  })

  it('lets only a controller or a dev decide, and only once', () => {
    const p = proposed(editClause(BOOK, editTwo, ROSA, ctx()))
    expect(approveProposal(BOOK, p, ROSA, { at: LATER, newId: idsFrom('clause') })).toEqual({ kind: 'refused', why: 'Only a controller or a dev approves a clause.' })
    expect(declineProposal(p, WENDI, { at: LATER, why: 'no' }).kind).toBe('refused')
    const done = decided(approveProposal(BOOK, p, MARIA, { at: LATER, newId: idsFrom('clause') }))
    expect(approveProposal(done.book!, done.proposal, ROBERT, { at: LATER, newId: idsFrom('clause') })).toEqual({ kind: 'refused', why: 'This change is decided already.' })
    expect(declineProposal(done.proposal, ROBERT, { at: LATER, why: 'no' })).toEqual({ kind: 'refused', why: 'This change is decided already.' })
  })

  it('declines only with a why, which Rosa reads on the history and gets by email', () => {
    const p = proposed(editClause(BOOK, editTwo, ROSA, ctx()))
    expect(declineProposal(p, MARIA, { at: LATER, why: '  ' })).toEqual({ kind: 'refused', why: 'Say why, for Rosa.' })
    const r = decided(declineProposal(p, MARIA, { at: LATER, why: 'keep the old wording; the insurer wants the dollar figure', told: false }))
    expect(r.proposal).toMatchObject({ state: 'declined', decidedBy: 'Maria', decidedAt: LATER, declineWhy: 'keep the old wording; the insurer wants the dollar figure' })
    expect(r.book).toBeNull()
    expect(r.toast).toBe("Declined. Rosa sees your why on the clause's history.")
    expect(decided(declineProposal(p, MARIA, { at: LATER, why: 'no' })).toast).toBe('Declined. Rosa gets an email with your why.')
  })
})

describe('clauseNeeds: the approvers’ Needs you rows', () => {
  const edit = proposed(editClause(BOOK, editTwo, ROSA, ctx(idsFrom('p1'), AT)))
  const added = proposed(editClause(BOOK, { kind: 'new', en: 'Paving: a proof roll before the base course.', es: '', scope: ['Paving', 'Sitework'] }, ROSA, ctx(idsFrom('p2'), LATER, '')))
  const retire = proposed(editClause(BOOK, { kind: 'retire', clauseId: 'msa-6' }, ROSA, ctx(idsFrom('p3'), LATER, 'the yard closed')))
  const declined = { ...proposed(editClause(BOOK, editTwo, ROSA, ctx(idsFrom('p4'), AT))), state: 'declined' as const }
  const all = [retire, declined, added, edit]
  const needCtx = { approvers: APPROVERS, when, told: false }

  it('gives Maria and Robert every waiting proposal, the longest waiting first', () => {
    const rows = clauseNeeds('controller', all, [BOOK], needCtx)
    expect(rows.map((r) => r.title)).toEqual([
      'Rosa changed clause 2 of the master agreement.',
      'Rosa proposed a new clause for the master agreement.',
      'Rosa wants to retire clause 6 on the Sitework exhibit of the master agreement.',
    ])
    expect(rows[0]).toMatchObject({
      badge: 'Waiting on your approval',
      facts: ['for everyone', 'today, 10:00 AM', 'the insurer asked for it'],
      words: 'Insurance: general liability of $2,000,000 per occurrence.',
    })
    expect(rows[1]?.facts).toEqual(['for Paving and Sitework', 'today, 12:00 PM'])
    // The rule, not a record of one call: true whether or not a call went.
    expect(clauseNeeds('controller', all, [BOOK], { approvers: APPROVERS, when })[0]?.facts.slice(-1)).toEqual(['Robert and Maria get a push and an email.'])
    expect(clauseNeeds('controller', all, [BOOK], { approvers: ['Maria'], when })[0]?.facts.slice(-1)).toEqual(['Maria gets a push and an email.'])
    expect(clauseNeeds('controller', all, [BOOK], { approvers: [], when })[0]?.facts.slice(-1)).toEqual(['The approvers get a push and an email.'])
    expect(clauseNeeds('dev', all, [BOOK], needCtx)).toHaveLength(3)
  })

  it('gives nobody else a row, since nobody else can decide one', () => {
    for (const role of ['assistant', 'estimator', 'master_technician', 'superintendent', null] as const) expect(clauseNeeds(role, all, [BOOK], needCtx)).toEqual([])
  })
})

describe('a round trip', () => {
  it("carries an approved change on Greg's next paper while his signed copy keeps the old words", () => {
    const forGreg = { company: GREG.company, trades: GREG.trades, job: null, lang: 'en' as const }
    const signed = signedCopyOf(assemblePaper(BOOK.paper, BOOK.clauses, forGreg), AT)
    const p = proposed(editClause(BOOK, { kind: 'edit', clauseId: 'msa-6', en: 'Utilities: a locate before any dig.', es: '', scope: ['Sitework'] }, ROSA, ctx()))
    const after = decided(approveProposal(BOOK, p, MARIA, { at: LATER, newId: idsFrom('clause') })).book!
    const next = assemblePaper(after.paper, after.clauses, forGreg)
    expect(next.exhibit).toEqual([{ id: 'msa-6', v: 2, n: 6, text: 'Utilities: a locate before any dig.' }])
    expect(next.revision).toBe(2)
    expect(signed.exhibit).toEqual([{ id: 'msa-6', v: 1, n: 6, text: MSA_CLAUSES[5]?.en }])
    expect(signed.revision).toBe(1)
  })
})

describe('plain words', () => {
  it('keeps every toast, refusal, title and fact in plain words', () => {
    const rows = clauseNeeds('dev', [proposed(editClause(BOOK, editTwo, ROSA, ctx()))], [BOOK], { approvers: APPROVERS, when })
    const words = [
      proposedToast(APPROVERS, false),
      proposedToast(['Maria'], false),
      proposedToast([], false),
      proposedToast(APPROVERS, true),
      proposedToast(['Maria'], true),
      proposedToast([], true),
      proposedToast(['Maria'], { push: false, email: true }),
      proposedToast(['Maria'], { push: true, email: false }),
      approvedToast('Maria', 'Rosa', 'edit'),
      approvedToast('Maria', 'Rosa', 'retire', false),
      declinedToast('Rosa'),
      declinedToast('Rosa', false),
      publishedToast({ ...MSA, revision: 2 }, 'edit'),
      publishedToast(MSA, 'retire'),
      'Only the office changes a clause.',
      changeProblem(BOOK, { ...editTwo, en: '' }),
      changeProblem(BOOK, { kind: 'new', en: 'x', es: '', scope: [] }),
      changeProblem(BOOK, { ...editTwo, clauseId: 'nope' }),
      scopeFor(['Electrical', 'Electrical, low voltage']),
      ...rows.flatMap((r) => [r.title, r.badge, ...r.facts.slice(0, 1), ...r.facts.slice(-1)]),
    ]
    const refusals = [
      approveProposal(BOOK, proposed(editClause(BOOK, editTwo, ROSA, ctx())), ROSA, { at: LATER, newId: idsFrom('c') }),
      declineProposal(proposed(editClause(BOOK, editTwo, ROSA, ctx())), MARIA, { at: LATER, why: '' }),
    ].map((r) => (r.kind === 'refused' ? r.why : ''))
    for (const s of [...words, ...refusals]) expect(plainWordsFailures(s ?? '')).toEqual([])
    expect(proposedToast(['Maria'], false)).toBe('It waits for Maria to approve it. Until then it is on their Needs you.')
    expect(proposedToast([], false)).toBe('It waits for a controller or a dev to approve it. Until then it is on their Needs you.')
    expect(proposedToast(['Maria'], true)).toBe('Sent to Maria with a push and an email. It goes out once Maria approves it. Until then it waits on their Needs you.')
    expect(proposedToast([], true)).toBe('Sent for approval with a push and an email. It goes out once a controller or a dev approves it. Until then it waits on their Needs you.')
  })
})
