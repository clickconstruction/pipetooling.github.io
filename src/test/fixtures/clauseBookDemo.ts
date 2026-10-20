/**
 * The Messages prototype's contract papers and people (v1.178, `PAPER_DOC`, `CLAUSES`, `contacts`, `ROLE`), as test data
 * for `src/lib/contracts/`. Made-up companies and people, never a live row.
 */
import type { Signer } from '../../lib/contracts/approval'
import type { Clause, ClauseScope, ContractPaper } from '../../lib/contracts/assemble'

const clause = (id: string, order: number, en: string, scope: ClauseScope = 'all'): Clause => ({ id, order, en, es: '', scope, v: 1, retiredAt: null, retiredBy: null })

export const MSA: ContractPaper = { id: 'msa', title: 'Master services agreement', name: 'the master agreement', between: 'Click Construction and {company}', revision: 1, publishedAt: '2026-10-01T15:00:00Z' }
export const SOW: ContractPaper = { id: 'sow', title: 'Statement of work', name: 'the statement of work', between: 'Click Construction and {company}, for {job}', revision: 1, publishedAt: '2026-10-01T15:00:00Z' }
export const CONTRACT: ContractPaper = { id: 'contract', title: 'Construction contract', name: 'our contract', between: 'Click Construction and {company}, for {job}', revision: 1, publishedAt: '2026-10-01T15:00:00Z' }
export const CHANGE_ORDER: ContractPaper = { id: 'co', title: 'Change order', name: 'the change order', between: 'Click Construction and {company}, for {job}', revision: 1, publishedAt: '2026-10-01T15:00:00Z' }

export const MSA_CLAUSES: Clause[] = [
  clause('msa-1', 1, "Term: one year from signing, renewing yearly unless either side gives thirty days' notice."),
  clause('msa-2', 2, "Insurance: general liability of $1,000,000 per occurrence and workers' compensation, kept current, with Click Construction named as additional insured."),
  clause('msa-3', 3, "Payment: a draw per approved pay application, net thirty from the owner's payment, with a conditional waiver on each draw and an unconditional waiver on the last."),
  clause('msa-4', 4, 'Safety: OSHA 30 for the foreman, OSHA 10 for the crew, a toolbox talk each week on site.'),
  clause('msa-5', 5, 'Work: each job under its own statement of work; nothing here prices a job.'),
  clause('msa-6', 6, 'Utilities: a locate is called in before any dig; spoils go to the yard named on the statement of work.', ['Sitework']),
  clause('msa-7', 7, 'Licensing: a master electrician of record on every permit; lockout and tagout on every live panel.', ['Electrical']),
  clause('msa-8', 8, 'Fall protection: tied off above six feet; the roof edge flagged before the first course goes down.', ['Structural steel']),
]

export const SOW_CLAUSES: Clause[] = [
  clause('sow-1', 1, 'The scope, per the plans and addenda named on it, at the price carried.'),
  clause('sow-2', 2, 'The days: a start, the durations, and what is ours before you can start.'),
  clause('sow-3', 3, 'Draws: as the master agreement says, against the pay applications on this job.'),
  clause('sow-4', 4, 'Changes: by change order only, priced before the work.'),
  clause('sow-5', 5, 'Haul-off and dust control are in the scope; rock is a change order.', ['Sitework']),
  clause('sow-6', 6, 'Temporary power stays yours until the permanent service is energized.', ['Electrical']),
]

export const CONTRACT_CLAUSES: Clause[] = [
  clause('contract-1', 1, 'The work, per the plans and the bid, at the contract sum.'),
  clause('contract-2', 2, 'The schedule: a start date once the permit is in, and the days to substantial completion.'),
  clause('contract-3', 3, 'Payment: a pay application each month, certified by the architect, paid in thirty days, with a ten percent retainage released at closeout.'),
  clause('contract-4', 4, 'Changes: by change order, signed by both, before the work.'),
  clause('contract-5', 5, 'Warranty: one year from acceptance.'),
]

/** The prototype's trade partners and customers, with the job each is on by default. */
export const GREG = { company: 'Hillside Excavation', trades: ['Sitework'], job: 'Boerne Retail Shell' }
export const BILL = { company: 'Tejas Power', trades: ['Electrical, low voltage'], job: 'Boerne Retail Shell' }
export const TOM = { company: 'Bexar Steel Erectors', trades: ['Structural steel'], job: 'Boerne Retail Shell' }
export const PRIYA = { company: 'Helotes Dental Office', trades: [] as string[], job: 'Helotes Dental Office' }

/** The prototype's team: Robert the dev, Rosa the office, Maria the controller, Wendi the superintendent. */
export const ROBERT: Signer = { userId: 'u-robert', name: 'Robert', role: 'dev' }
export const ROSA: Signer = { userId: 'u-rosa', name: 'Rosa', role: 'assistant' }
export const MARIA: Signer = { userId: 'u-maria', name: 'Maria', role: 'controller' }
export const WENDI: Signer = { userId: 'u-wendi', name: 'Wendi', role: 'superintendent' }
export const APPROVERS = ['Robert', 'Maria']

/** Ids in the order they are asked for, as the database would mint them. */
export function idsFrom(prefix: string): () => string {
  let n = 0
  return () => `${prefix}-${++n}`
}

/**
 * The same papers as the database keeps them (`contract_template_documents`, `contract_clauses`,
 * `contract_clause_proposals`), for the clause screens: the master agreement and the statement of work in the Subs
 * packet, a W-9 form and a safety paper not built from clauses yet. Rosa's change to clause 2 waits on approval; clause 3
 * is version 2 since Maria approved Rosa's net forty-five, after declining her net thirty.
 */
export function clauseLibraryRows() {
  const at = '2026-10-12T15:00:00Z'
  const row = (paperId: string, c: Clause, over: Partial<{ version: number; text_en: string }> = {}) => ({
    id: c.id,
    paper_id: paperId,
    sequence_order: c.order,
    text_en: over.text_en ?? c.en,
    text_es: c.es,
    scope: c.scope === 'all' ? ['all'] : [...c.scope],
    version: over.version ?? c.v,
    published_by_name: 'Robert',
    published_at: at,
    retired_at: null,
    retired_by_name: null,
  })
  const change = (p: { id: string; clause: string | null; kind?: 'new' | 'edit' | 'retire'; baseV: number | null; en: string; state: 'proposed' | 'approved' | 'declined'; by: string; decidedBy?: string; why?: string; declineWhy?: string; resultV?: number; at: string; scope?: string[] }) => ({
    id: p.id,
    paper_id: 'doc-msa',
    kind: p.kind ?? 'edit',
    clause_id: p.clause,
    base_v: p.baseV,
    text_en: p.en,
    text_es: '',
    scope: p.scope ?? ['all'],
    by_user_id: `u-${p.by.toLowerCase()}`,
    by_name: p.by,
    why: p.why ?? '',
    state: p.state,
    decided_by_name: p.decidedBy ?? null,
    decided_at: p.state === 'proposed' ? null : p.at,
    decline_why: p.declineWhy ?? null,
    result_v: p.resultV ?? null,
    paper_revision: p.resultV ? 2 : null,
    created_at: p.at,
  })
  return {
    papers: [
      { id: 'doc-msa', document_name: 'Master services agreement', template_id: 'tpl-subs', form_template_id: null, sequence_order: 1, revision: 2, published_at: at },
      { id: 'doc-sow', document_name: 'Statement of work', template_id: 'tpl-subs', form_template_id: null, sequence_order: 2, revision: 1, published_at: at },
      { id: 'doc-w9', document_name: 'W-9', template_id: 'tpl-subs', form_template_id: 'form-w9', sequence_order: 3, revision: 0, published_at: null },
      { id: 'doc-safety', document_name: 'Safety acknowledgment', template_id: 'tpl-subs', form_template_id: null, sequence_order: 4, revision: 0, published_at: null },
    ],
    templates: [{ id: 'tpl-subs', name: 'Subs', sequence_order: 1 }],
    clauses: [
      ...MSA_CLAUSES.map((c) => (c.id === 'msa-3' ? row('doc-msa', c, { version: 2, text_en: 'Payment: net forty-five.' }) : row('doc-msa', c))),
      ...SOW_CLAUSES.map((c) => row('doc-sow', c)),
    ],
    proposals: [
      change({ id: 'p-declined', clause: 'msa-3', baseV: 1, en: 'Payment: net thirty.', state: 'declined', by: 'Rosa', decidedBy: 'Maria', declineWhy: 'the owner pays late', at: '2026-10-10T15:00:00Z' }),
      change({ id: 'p-approved', clause: 'msa-3', baseV: 1, en: 'Payment: net forty-five.', state: 'approved', by: 'Rosa', decidedBy: 'Maria', why: 'the owner pays late', resultV: 2, at: '2026-10-11T15:00:00Z' }),
      change({ id: 'p-waiting', clause: 'msa-2', baseV: 1, en: 'Insurance: general liability of $2,000,000 per occurrence.', state: 'proposed', by: 'Rosa', why: 'the insurer asked for it', at: '2026-10-12T15:00:00Z' }),
    ],
  }
}

/** Everything the clause screens read: the rows, the trades, the companies the preview offers, and the approvers. */
export function clauseLibraryDemo() {
  return {
    ...clauseLibraryRows(),
    packageTrades: ['Sitework', 'Electrical, low voltage', 'sitework '],
    companies: [
      { id: 'co-hillside', name: GREG.company, trades: GREG.trades },
      { id: 'co-tejas', name: BILL.company, trades: BILL.trades },
      { id: 'co-bexar', name: TOM.company, trades: TOM.trades },
    ],
    approvers: ['Maria', 'Robert'],
  }
}
