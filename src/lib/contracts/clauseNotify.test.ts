import { describe, expect, it } from 'vitest'
import { CONTRACT_CLAUSES, MARIA, MSA, MSA_CLAUSES, ROSA, SOW_CLAUSES, idsFrom } from '../../test/fixtures/clauseBookDemo'
import { plainWordsFailures } from '../plainWords'
import { editClause, proposalTitle, type ClauseBook, type ClauseChange, type ClauseProposal } from './approval'
import { clauseLabel, type Clause } from './assemble'
import { clausePaperHref, paperFromRow } from './clauseRows'
import { clauseDecisionNote, clauseProposalNote, firstWords, notifyChangeTitle, notifyClauseLabel, notifyPaperHref, notifyPaperName, type NotifyChange, type NotifyClause } from './clauseNotify'

const BOOK: ClauseBook = { paper: MSA, clauses: MSA_CLAUSES }
const AT = '2026-10-12T15:00:00Z'
const ctx = { at: AT, why: 'the insurer asked for it', approvers: ['Robert', 'Maria'], newId: idsFrom('p'), told: false }
const clauses = (cs: readonly Clause[]): NotifyClause[] => cs.map((c) => ({ id: c.id, order: c.order, scope: c.scope, retiredAt: c.retiredAt }))
const changeOf = (p: ClauseProposal): NotifyChange => ({ kind: p.kind, clauseId: p.clauseId, en: p.en, es: p.es, scope: p.scope, by: p.by, why: p.why })
function proposal(change: ClauseChange): ClauseProposal {
  const r = editClause(BOOK, change, ROSA, ctx)
  if (r.kind !== 'proposed') throw new Error(r.kind)
  return r.proposal
}

const editTwo = proposal({ kind: 'edit', clauseId: 'msa-2', en: 'Insurance: general liability of $2,000,000 per occurrence, naming us as additional insured.', es: 'Seguro: responsabilidad general de $2,000,000.', scope: 'all' })
const addPaving = proposal({ kind: 'new', en: 'Paving: a proof roll before the base course.', es: '', scope: ['Paving', 'Sitework'] })
const retireSix = proposal({ kind: 'retire', clauseId: 'msa-6' })

describe('the copies the function keeps agree with the app', () => {
  it('numbers every clause as Settings does, on every paper', () => {
    const retiredOne: Clause[] = MSA_CLAUSES.map((c, i) => (i === 1 ? { ...c, retiredAt: AT, retiredBy: 'Maria' } : c))
    const twoTrades: Clause[] = [...MSA_CLAUSES, { id: 'msa-x', order: 99, en: 'Both.', es: '', scope: ['Electrical', 'Paving'], v: 1, retiredAt: null, retiredBy: null }]
    for (const book of [MSA_CLAUSES, SOW_CLAUSES, CONTRACT_CLAUSES, retiredOne, twoTrades]) {
      for (const c of book) expect(notifyClauseLabel(clauses(book), c.id), c.id).toBe(clauseLabel(book, c.id))
    }
  })

  it('titles a change as its Needs you row does, and names and links the paper as Settings does', () => {
    for (const p of [editTwo, addPaving, retireSix]) expect(notifyChangeTitle(changeOf(p), MSA.name, clauses(MSA_CLAUSES))).toBe(proposalTitle(p, BOOK))
    const row = { id: 'doc-1', document_name: 'Master services agreement', template_id: 't', form_template_id: null, sequence_order: 0, revision: 1, published_at: null }
    expect(notifyPaperName(row.document_name)).toBe(paperFromRow(row).name)
    expect(notifyPaperHref('doc-1')).toBe(clausePaperHref('doc-1'))
  })
})

describe('clauseProposalNote', () => {
  const note = (changes: NotifyChange[]) => clauseProposalNote({ paperId: 'msa', documentName: 'master agreement', clauses: clauses(MSA_CLAUSES), changes })

  it('names one change, its paper and its first words, and lands on the paper in Settings', () => {
    expect(note([changeOf(editTwo)])).toEqual({
      title: 'Approve a clause change',
      body: 'Rosa changed clause 2 of the master agreement: “Insurance: general liability of $2,000,000 per occurrence, naming…”',
      url: '/settings?tab=settings-clauses#settings-clause-paper-msa',
      tag: 'clause-proposal-msa',
      subject: 'Approve a clause change · master agreement',
      emailText: [
        'Rosa changed clause 2 of the master agreement.\nFor everyone.\nThe words: Insurance: general liability of $2,000,000 per occurrence, naming us as additional insured.\nIn Spanish: Seguro: responsabilidad general de $2,000,000.\nWhy: the insurer asked for it',
        'Open Contracts and clauses to approve it, or to decline it with a why.',
      ].join('\n\n'),
    })
  })

  it('reads a retire with the words it would take away', () => {
    const n = note([changeOf(retireSix)])
    expect(n.body).toBe(`Rosa wants to retire clause 6 on the Sitework exhibit of the master agreement: “${firstWords(MSA_CLAUSES[5]!.en)}”`)
    expect(n.emailText).toContain(`For Sitework.\nIt reads now: ${MSA_CLAUSES[5]!.en}`)
  })

  it('counts the changes one save sent together, as the New paper window does', () => {
    const asNew = { ...changeOf(addPaving), why: '' }
    const three = note([asNew, { ...asNew, en: 'Two.' }, { ...asNew, en: 'Three.' }])
    expect(three).toMatchObject({ title: 'Approve 3 clause changes', body: 'Rosa proposed 3 new clauses for the master agreement.', subject: 'Approve 3 clause changes · master agreement' })
    expect(three.emailText.split('\n\n')).toHaveLength(4)
    expect(three.emailText.endsWith('Open Contracts and clauses to approve each one, or to decline it with a why.')).toBe(true)
    expect(note([changeOf(editTwo), changeOf(retireSix)]).body).toBe('Rosa proposed 2 changes to the master agreement.')
  })
})

describe('clauseDecisionNote', () => {
  const decide = (change: NotifyChange, state: 'approved' | 'declined', more: { declineWhy?: string; resultV?: number | null } = {}) =>
    clauseDecisionNote({ paperId: 'msa', documentName: 'master agreement', clauses: clauses(MSA_CLAUSES), change, decider: MARIA.name, state, declineWhy: more.declineWhy ?? null, resultV: more.resultV ?? null })

  it('tells the editor an approved change is the next version, and the next paper carries it', () => {
    expect(decide(changeOf(editTwo), 'approved', { resultV: 2 })).toEqual({
      subject: 'Approved · master agreement',
      emailText: 'Maria approved your change to clause 2 of the master agreement.\n\nIt is version 2 of clause 2. The next paper sent carries it. Signed copies keep their words.',
      url: '/settings?tab=settings-clauses#settings-clause-paper-msa',
    })
    expect(decide(changeOf(retireSix), 'approved').emailText).toBe('Maria approved retiring clause 6 on the Sitework exhibit of the master agreement.\n\nThe next paper sent leaves it out. Signed copies keep it.')
    expect(decide({ ...changeOf(addPaving), clauseId: 'msa-6' }, 'approved', { resultV: 1 }).emailText).toBe(
      'Maria approved your new clause for the master agreement.\n\nIt is version 1 of the clause. The next paper sent carries it. Signed copies keep their words.',
    )
  })

  it('tells the editor a declined change and the why', () => {
    expect(decide(changeOf(editTwo), 'declined', { declineWhy: ' The insurer wants the dollar figure. ' })).toEqual({
      subject: 'Declined · master agreement',
      emailText: 'Maria declined your change to clause 2 of the master agreement.\n\nWhy: The insurer wants the dollar figure.\n\nYour words stay on the clause’s history. Change them and send them again when you are ready.',
      url: '/settings?tab=settings-clauses#settings-clause-paper-msa',
    })
  })
})

describe('the words', () => {
  it('keeps a clause to its first eight words in a push', () => {
    expect(firstWords('  One two three. ')).toBe('One two three.')
    expect(firstWords('a b c d e f g h i j')).toBe('a b c d e f g h…')
  })

  it('writes the emails’ own sentences in plain words', () => {
    const sentences = [
      'Open Contracts and clauses to approve it, or to decline it with a why.',
      'The next paper sent leaves it out. Signed copies keep it.',
      'Your words stay on the clause’s history. Change them and send them again when you are ready.',
      'Maria approved your change to clause 2 of the master agreement.',
      'Maria declined your change to clause 2 of the master agreement.',
    ]
    for (const s of sentences) expect(plainWordsFailures(s)).toEqual([])
  })
})
