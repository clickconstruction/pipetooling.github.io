/**
 * `gc_award`'s gate re-checks the award in SQL (the Board's B6-a, call G): `gc_leveled_total` is a second
 * copy of `leveledTotal`, and its refusals are `canAward`'s words. The SQL runs in the bed
 * `supabase/tests/gc_award` (GitHub, the whole schema); this builds the bed's own rows for the kernels
 * and holds them to the numbers and words that file asserts, read from its `-- leveled` and
 * `-- refused` lines. A change to either copy that the other does not make fails here or there.
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { leveledTotal } from './bids'
import { boardStateFromRows, type BoardRows } from './boardRows'
import { clinicBoardRows } from './boardTestRows'
import { gcProjectFromRows } from './projectRows'
import { canAward } from './vetting'

const BED = readFileSync(resolve(__dirname, '../../../supabase/tests/gc_award/20_scenario.sql'), 'utf8')
const bedLines = (kind: 'leveled' | 'refused') => [...BED.matchAll(new RegExp(`^-- ${kind} (\\w+): (.+)$`, 'gm'))].map((m) => [m[1]!, m[2]!] as const)

const id = (tail: string) => `00000000-0000-0000-0000-000000000${tail}`
const ASK = { lonestar: id('621'), hillside: id('622'), capped: id('623'), gone: id('624') } as const
const at = (day: string) => `${day}T10:00:00Z`

/** The bed's clinic and companies, as the board's rows. */
function bedRows(): BoardRows {
  const base = clinicBoardRows()
  const project = gcProjectFromRows({
    project: { id: id('6a1'), name: 'Award test clinic', address: '', customer_id: id('6c1'), plans_link: null },
    gc: { stage: 'bidding', bid_due: null, sq_ft: null, size_note: '', customer_role: 'owner', property_owner_customer_id: null, architect_customer_id: null, project_manager_user_id: null, drive_folder_url: '', lost_on: null },
    packages: [
      { id: id('6b1'), trade: 'Sitework', position: 0, budget: 60000, ours: false, own_bid_id: null },
      { id: id('6b2'), trade: 'Concrete', position: 1, budget: 84000, ours: false, own_bid_id: null },
      { id: id('6b3'), trade: 'Plumbing', position: 2, budget: 30000, ours: true, own_bid_id: null },
    ],
    scopeItems: [
      { id: id('6e1'), package_id: id('6b1'), position: 0, label: 'Clearing and grading', sheets: null, specs: null, added_in_set_id: null },
      { id: id('6e2'), package_id: id('6b1'), position: 1, label: 'Paving', sheets: null, specs: null, added_in_set_id: null },
      { id: id('6e3'), package_id: id('6b2'), position: 0, label: 'Foundations', sheets: null, specs: null, added_in_set_id: null },
    ],
    exclusions: [{ id: id('6f1'), package_id: id('6b1'), position: 0, label: 'Permits & fees', by: 'the owner' }],
    sets: [
      { id: id('6s0'), rev: 0, label: 'Bid set', kind: 'Bid set', issued_on: '2026-10-01', note: '', checked_by_user_id: null, drive_url: '', drive_access: null, drive_checked_on: null },
      { id: id('6s1'), rev: 1, label: 'Addendum 1', kind: 'Addendum', issued_on: '2026-10-05', note: '', checked_by_user_id: null, drive_url: '', drive_access: null, drive_checked_on: null },
    ],
    setItems: [],
    questions: [],
  })
  const company = (tail: string, name: string, trades: string[], vetting_status: string | null, vetting_limit: number | null, vetting_note: string) => ({
    id: id(tail), name, trades, contact_name: '', phone: '', email: '', address: '', max_miles: null, license: '', lang: 'en',
    vetting_status, vetting_limit, vetting_decided_on: null, vetting_decided_by: null, vetting_note,
  })
  const ask = (tail: string, pkg: string, co: string, office: Partial<BoardRows['invites'][number]> = {}) => ({
    id: id(tail), package_id: id(pkg), company_id: id(co), status: 'bid', invited_on: '2026-10-01', declined_why: null, decline_reason: null, decline_note: '', declined_on: null,
    plugs: {}, exclusion_covers: {}, taken_alternates: [], ...office,
  })
  const quote = (qid: string, invite: string, amount: number, includes: Record<string, 'yes' | 'no'>, created: string, more: Partial<BoardRows['quotes'][number]> = {}) => ({
    id: qid, invite_id: id(invite), amount, based_on_rev: 1, submitted_on: created, includes, note: '', good_for_days: null, alternates: [], quote_file: '', exclusions: null, created_at: at(created), ...more,
  })
  return {
    ...base,
    projects: [project],
    boardDates: {},
    customers: [{ id: id('6c1'), name: 'Award Test Owner' }],
    companies: [
      company('611', 'Lonestar Earthworks', ['Sitework'], null, null, ''),
      company('612', 'Hillside Excavation', ['Sitework'], 'new', null, ''),
      company('613', 'Capped Concrete', ['Concrete'], 'approved', 50000, ''),
      company('614', 'Gone Grading', ['Sitework'], 'declined', null, 'no insurance'),
    ],
    invites: [
      ask('621', '6b1', '611', { plugs: { [id('6e2')]: 9000 }, exclusion_covers: { Dewatering: 2500, 'Permits and fees': 999 }, taken_alternates: ['Thicker base'] }),
      ask('622', '6b1', '612'),
      ask('623', '6b2', '613'),
      ask('624', '6b1', '614'),
    ],
    quotes: [
      quote('q0', '621', 58000, { [id('6e1')]: 'yes', [id('6e2')]: 'yes' }, '2026-10-03', { based_on_rev: 0 }),
      quote('q1', '621', 52000, { [id('6e1')]: 'yes', [id('6e2')]: 'no' }, '2026-10-05', {
        alternates: [
          { label: 'Thicker base', amount: 3000 },
          { label: 'Night work', amount: 4000 },
        ],
        exclusions: [{ name: 'Dewatering' }, { name: 'Permits and fees' }, { name: 'Rock', unitPrice: { amount: 38, unit: 'cy' } }],
      }),
      quote('q2', '622', 60000, { [id('6e1')]: 'yes', [id('6e2')]: 'yes' }, '2026-10-06'),
      quote('q3', '623', 61200, { [id('6e3')]: 'yes' }, '2026-10-06'),
      quote('q4', '624', 40000, { [id('6e1')]: 'yes', [id('6e2')]: 'yes' }, '2026-10-06'),
    ],
    contacts: [],
    promises: [],
    promiseMoves: [],
  }
}

function kernels(name: keyof typeof ASK) {
  const state = boardStateFromRows(bedRows())
  const pkg = state.projects[0]!.packages.find((p) => p.invites.some((i) => i.id === ASK[name]))!
  const invite = pkg.invites.find((i) => i.id === ASK[name])!
  const partner = state.partners.find((p) => p.id === invite.partnerId)!
  const total = leveledTotal(pkg, invite)
  return { total, why: total === null ? null : canAward(partner, total).why }
}

describe('gc_award holds to the kernels (B6-a, call G)', () => {
  it('reads its numbers and words from the bed', () => {
    expect(bedLines('leveled').map(([n]) => n)).toEqual(['lonestar', 'hillside', 'capped'])
    expect(bedLines('refused').map(([n]) => n)).toEqual(['hillside', 'capped', 'gone'])
  })

  it.each(bedLines('leveled'))('the leveled total of %s is the bed’s', (name, line) => {
    const want = Number(/^(\d+)/.exec(line)![1])
    // The comment and the bed's own assertion say the same number.
    expect(BED).toMatch(new RegExp(`gat\\.same\\('leveled ${name}', [^\\n]*'${want}'\\);`))
    expect(kernels(name as keyof typeof ASK).total).toBe(want)
  })

  it.each(bedLines('refused'))('the refusal of %s is canAward’s words', (name, words) => {
    expect(BED).toContain(`\n  '${words}');`)
    expect(kernels(name as keyof typeof ASK).why).toBe(words)
  })

  it('a cover on a Known exclusion does not count, by its folded name, and a unit price is not a cover', () => {
    // Without the Known rule the 999 would count: 67,499.
    expect(kernels('lonestar').total).toBe(66500)
    expect(BED).toContain('Permits & fees')
  })
})
