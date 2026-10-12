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
