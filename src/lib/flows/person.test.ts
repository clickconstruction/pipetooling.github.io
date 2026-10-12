import { describe, expect, it } from 'vitest'
import { FLOW_FIXTURE_NOW as NOW } from './flowFixtures'
import { docStamps, type FlowRows } from './load'
import { courtFrom, marksFrom, oweFrom, personFlowFrom, portalFrom, sendsFrom, type PortalPaperRow } from './person'
import { SEED_FLOWS } from './seed'
import { stepReading } from './state'

const contact = { id: 'tom', kind: 'trade' as const, off_since: null, off_why: null, off_by: null }
const ROWS: FlowRows = {
  contact,
  userNames: { 'u-rosa': 'Rosa' },
  company: { id: 'bexar', portal_opened_on: '2026-09-28' },
  tradeMessages: [{ company_id: 'bexar', kind: 'invite', sent_on: '2026-09-25', sent_by: 'u-rosa' }],
  papers: [{ id: 'w9', company_id: 'bexar', doc_type: 'w9', status: 'signed', sent_at: null, signed_at: '2026-09-29', expires_at: null, created_at: '2026-09-29T15:00:00Z' }],
  paperSends: [
    { paper: 'insurance', project_id: null, sent_on: '2026-10-01', created_at: '2026-10-01T15:00:00Z' },
    { paper: 'insurance', project_id: null, sent_on: '2026-09-28', created_at: '2026-09-28T15:00:00Z' },
    { paper: 'fax', project_id: null, sent_on: '2026-09-28', created_at: '2026-09-28T15:00:00Z' },
  ],
  projects: [{ project_id: 'boerne', name: 'Boerne Retail Shell', stage: 'bidding', created_at: '2026-08-20T15:00:00Z', bid_due: '2026-10-08', our_bid_sent_on: null, won_on: null, lost_on: null, owner_contract_sent_on: null, owner_contract_signed_on: null, started_on: null, closed_on: null, owner_pay_days: null } as never],
  contactJobs: [{ project_id: 'boerne', is_default: true }],
}

describe('personFlowFrom: one person for the panel, the card and the nudges', () => {
  it('reads Tom from his rows, with his notes, his hold and his last reminder', () => {
    const p = personFlowFrom({
      id: 'tom',
      first: 'Tom',
      flow: SEED_FLOWS.trade,
      rows: ROWS,
      now: NOW,
      holds: [
        { step_key: 'papers', project_id: null, until_on: '2026-10-05', released_at: null },
        { step_key: 'papers', project_id: null, until_on: '2026-10-03', released_at: '2026-10-01T15:00:00Z' },
      ],
      sent: [
        { step_key: 'papers', project_id: null, sent_at: '2026-09-30T15:00:00Z', sent_by: 'person' },
        { step_key: 'papers', project_id: null, sent_at: '2026-10-01T15:00:00Z', sent_by: 'person' },
        // The app's own morning reminder is no Remind now.
        { step_key: 'papers', project_id: null, sent_at: '2026-10-02T13:00:00Z', sent_by: 'app' },
      ],
      notes: [{ step_key: 'papers', project_id: null, who_user_id: 'u-rosa', body: 'Their broker renews Nov 1.', at: '2026-10-01T15:00:00Z' }],
      lines: [
        { direction: 'out', at: '2026-09-30T15:00:00Z' },
        { direction: 'in', at: '2026-09-29T15:00:00Z' },
      ],
    })
    expect([p.reading.nowStepId, stepReading(p.reading, 'papers', null)?.since]).toEqual(['papers', '2026-09-28'])
    expect(p.marks).toEqual([{ stepId: 'papers', jobId: null, holdUntil: '2026-10-05', nudgedAt: '2026-10-01T15:00:00Z' }])
    expect(p.notes).toEqual([{ stepId: 'papers', jobId: null, by: 'Rosa', text: 'Their broker renews Nov 1.', at: '2026-10-01T15:00:00Z' }])
    expect(p.jobs).toEqual({ boerne: 'Boerne Retail Shell' })
    expect([p.court, p.lastOutAt, p.quietDays]).toEqual(['theirs', '2026-09-30T15:00:00Z', 3])
    expect(p.sends).toEqual({ coi: ['2026-09-28T15:00:00Z', '2026-10-01T15:00:00Z'] })
    expect([p.owe, p.portal]).toEqual([false, null])
  })

  it('reads whose court a thread is in from its last lines', () => {
    expect(courtFrom([])).toBeNull()
    expect(courtFrom([{ direction: 'in', at: '2026-10-01T15:00:00Z' }])).toBe('ours')
    expect(courtFrom([{ direction: 'in', at: '2026-10-01T15:00:00Z' }, { direction: 'out', at: '2026-10-02T15:00:00Z' }])).toBe('theirs')
    expect(courtFrom([{ direction: 'team', at: '2026-10-02T15:00:00Z' }])).toBeNull()
  })

  it('keeps one mark per step and job, and only papers it knows the words for', () => {
    expect(marksFrom([], [{ step_key: 'ask', project_id: 'padb', sent_at: '2026-10-01T15:00:00Z', sent_by: 'person' }])).toEqual([{ stepId: 'ask', jobId: 'padb', nudgedAt: '2026-10-01T15:00:00Z' }])
    expect(marksFrom([], [{ step_key: 'ask', project_id: 'padb', sent_at: '2026-10-01T15:00:00Z', sent_by: 'app' }])).toEqual([])
    expect(sendsFrom({ contact })).toEqual({})
  })

  it('owes them while one of their contact_owed rows is not done', () => {
    const owed = [
      { contact_id: 'tom', done_at: '2026-10-01T15:00:00Z' },
      { contact_id: 'elena', done_at: null },
    ]
    expect([oweFrom('tom', owed), oweFrom('elena', owed)]).toEqual([false, true])
    expect(personFlowFrom({ id: 'elena', first: 'Elena', flow: SEED_FLOWS.customer, rows: { contact: { ...contact, id: 'elena', kind: 'customer' } }, now: NOW, owed }).owe).toBe(true)
  })

  it('reads their page from cut 8: each kind’s newest paper and when they opened it, and the change order not answered', () => {
    const paper = (kind: PortalPaperRow['kind'], title: string, sentAt: string, viewedAt: string | null, answered = false): PortalPaperRow => ({ kind, title, sentAt, viewedAt, answered })
    const papers = [
      paper('contract', 'Our contract', '2026-09-10', '2026-09-11T14:00:00Z', true),
      paper('changeOrder', 'Change order 1', '2026-09-20', '2026-09-21T14:00:00Z', true),
      paper('changeOrder', 'Change order 2', '2026-09-28', null),
      paper('payApp', 'Pay application 1', '2026-09-25', '2026-09-26T14:00:00Z'),
      paper('payApp', 'Pay application 2', '2026-09-30', null),
    ]
    // The newest pay application is not opened yet, so none shows; change order 2 is out and not answered.
    expect(portalFrom({ lastOpenedAt: '2026-09-26T14:00:00Z', papers })).toEqual({ views: { contract: '2026-09-11T14:00:00Z' }, openChange: { name: 'Change order 2' } })
    // Never opened: nothing seen, and change order 2 still waits on them, so the card can say they have not opened it.
    expect(portalFrom({ lastOpenedAt: null, papers })).toEqual({ views: {}, openChange: { name: 'Change order 2' } })
    expect(portalFrom(null)).toBeNull()
  })
})

describe('docStamps: the facts on a paper made in the New paper window', () => {
  const docId = '0a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d'
  const paper = (p: Record<string, unknown>) => ({ id: 'x', company_id: 'bexar', doc_type: 'other', status: 'unsent', sent_at: null, signed_at: null, expires_at: null, created_at: '2026-09-01T15:00:00Z', library_id: docId, ...p })
  const marks = (papers: ReturnType<typeof paper>[]) => docStamps({ contact, papers: papers as never }, NOW).map((s) => `${String(s.fact).replace(docId, 'D')}:${s.mark}:${s.at ?? '-'}`)

  it('reads on file, signed, sent and current from the library paper’s rows', () => {
    expect(marks([paper({ status: 'signed', signed_at: '2026-09-20', sent_at: '2026-09-15T15:00:00Z', expires_at: '2027-01-01' })])).toEqual([
      'doc:D:on_file:ok:2026-09-20',
      'doc:D:signed:ok:2026-09-20',
      'doc:D:sent:ok:2026-09-15',
      'doc:D:current:ok:2026-09-20',
    ])
    // Out to sign: waiting on them; nothing on file yet.
    expect(marks([paper({ status: 'sent', sent_at: '2026-09-30T15:00:00Z' })])).toEqual(['doc:D:signed:wait:2026-09-30', 'doc:D:sent:ok:2026-09-30'])
    // Past its last day: bad.
    expect(marks([paper({ status: 'signed', signed_at: '2025-10-01', expires_at: '2026-10-01' })]).slice(-1)[0]).toBe('doc:D:current:bad:2026-10-01')
    // A company paper with no library document has no runtime fact.
    expect(docStamps({ contact, papers: [paper({ library_id: null })] as never }, NOW)).toEqual([])
  })
})
