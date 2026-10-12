/**
 * The Messages prototype's demo people (v1.178) as the stamps a loader would read for them, at the
 * prototype's clock. Made-up people and companies only; the kernels' tests read them, and the card,
 * the nudges and the boards test against the same people (helpers 5 and 6).
 *
 * The prototype typed each person's place (`FLOW_STATE`); here only facts go in, and `readFlow` must
 * put them where the prototype drew them. Where the two differ, the test says why.
 */
import type { FactId, FactMark, FlowKind } from './facts'
import type { FactStamp, FlowStamps, JobStamps, LaneStamps, RoundStamp, StepSkip, StepWait } from './state'

/** The prototype's clock: Fri Oct 2 2026, 11:45 AM in Chicago. */
export const FLOW_FIXTURE_NOW = new Date('2026-10-02T16:45:00Z')

/** The demo jobs by id. A job named as its company reads as the company alone on the boards. */
export const FLOW_FIXTURE_JOBS: Readonly<Record<string, string>> = {
  boerne: 'Boerne Retail Shell',
  padb: 'Boerne Retail Pad B',
  stoneoak: 'Stone Oak Pharmacy',
  helotes: 'Helotes Dental Office',
  fairoaks: 'Fair Oaks Shops, Building D',
  bell: 'Bell Family Dental',
  oakhills: 'Oak Hills Veterinary',
  leonvalley: 'Leon Valley Bakery',
  castlehills: 'Castle Hills HOA',
}

export type FlowFixturePerson = {
  contactId: string
  name: string
  company: string
  kind: FlowKind
  /** A trade partner's trade, for By trade. */
  trade: string | null
  /** The board's companies with no thread in the prototype. */
  ghost: boolean
  stamps: FlowStamps
}

const stamp = (fact: FactId, mark: FactMark, at: string | null, by: string | null = null, until: string | null = null): FactStamp => ({ fact, mark, at, by, until })
const ok = (fact: FactId, at: string, by: string | null = null) => stamp(fact, 'ok', at, by)
const lane = (stamps: FactStamp[] = [], rounds: LaneStamps['rounds'] = {}, dues: LaneStamps['dues'] = {}): LaneStamps => ({ stamps, rounds, dues })
const job = (jobId: string, stamps: FactStamp[] = [], rounds: LaneStamps['rounds'] = {}, dues: LaneStamps['dues'] = {}): JobStamps => ({ jobId, ...lane(stamps, rounds, dues) })
const round = (key: string, name: string, opened: string | null, stamps: FactStamp[] = [], due: string | null = null): RoundStamp => ({ key, name, opened, due, stamps })

function person(
  p: Omit<FlowFixturePerson, 'stamps' | 'trade' | 'ghost'> & Partial<Pick<FlowFixturePerson, 'trade' | 'ghost'>>,
  s: { jobIds: string[]; defaultJobId?: string | null; person?: LaneStamps; jobs?: JobStamps[]; skips?: StepSkip[]; waits?: StepWait[]; off?: FlowStamps['off'] },
): FlowFixturePerson {
  return {
    trade: null,
    ghost: false,
    ...p,
    stamps: {
      kind: p.kind,
      jobIds: s.jobIds,
      defaultJobId: s.defaultJobId === undefined ? s.jobIds[0] ?? null : s.defaultJobId,
      person: s.person ?? lane(),
      jobs: Object.fromEntries((s.jobs ?? []).map((j) => [j.jobId, j])),
      skips: s.skips ?? [],
      waits: s.waits ?? [],
      off: s.off ?? null,
    },
  }
}

/** A trade partner who finished the Once lane; the days are the board's companies', which the prototype does not give. */
const setUp = (on: string) => lane([ok('invite_sent', on, 'Rosa'), ok('portal_opened', on), ok('w9_signed', on), ok('coi_current', on), ok('msa_signed', on)])

export const FLOW_FIXTURE_PEOPLE: readonly FlowFixturePerson[] = [
  // Sitework. His insurance ran out Wed Sep 30, so Papers in lapsed; Boerne's quote was promised for Wed Sep 30.
  person(
    { contactId: 'greg', name: 'Greg Paulk', company: 'Hillside Excavation', kind: 'trade', trade: 'Sitework' },
    {
      jobIds: ['boerne', 'padb', 'stoneoak'],
      person: lane([
        ok('invite_sent', '2026-09-08', 'Rosa'),
        ok('portal_opened', '2026-09-09', 'Greg'),
        ok('w9_signed', '2026-09-12'),
        stamp('coi_current', 'bad', '2026-09-30', null, '2026-09-30'),
        ok('msa_signed', '2026-09-14'),
      ]),
      jobs: [
        job('boerne', [], { ask: [round('inv-greg-boerne', 'Boerne Retail Shell', '2026-09-22', [stamp('quote_in', 'wait', '2026-09-22')], '2026-09-30')] }),
        job('padb', [], { ask: [round('inv-greg-padb', 'Boerne Retail Pad B', null, [], '2026-10-22')] }),
        job('stoneoak', [ok('carried', '2026-09-14', 'Robert'), ok('sow_signed', '2026-09-18')], {
          ask: [round('inv-greg-stoneoak', 'Stone Oak Pharmacy', '2026-09-08', [ok('quote_in', '2026-09-11')])],
          draws: [round('draw-greg-1', 'Draw 1', '2026-09-25', [ok('draw_paid', '2026-09-30')]), round('draw-greg-2', 'Draw 2', '2026-10-01')],
        }),
      ],
    },
  ),
  // Electrical, low voltage. His Boerne quote came Tue Sep 29 at 2 PM; comparing it is Robert's.
  person(
    { contactId: 'bill', name: 'Bill Sorrell', company: 'Tejas Power', kind: 'trade', trade: 'Electrical, low voltage' },
    {
      jobIds: ['boerne', 'stoneoak'],
      person: lane([
        ok('invite_sent', '2026-09-08', 'Rosa'),
        ok('portal_opened', '2026-09-08', 'Bill'),
        ok('w9_signed', '2026-09-09'),
        stamp('coi_current', 'ok', '2026-09-09', null, '2027-03-01'),
        ok('msa_signed', '2026-09-10'),
      ]),
      jobs: [job('boerne', [], { ask: [round('inv-bill-boerne', 'Boerne Retail Shell', '2026-09-22', [ok('quote_in', '2026-09-29T14:00:00-05:00')])] })],
    },
  ),
  // Structural steel. He pressed Got it Mon Sep 28; his certificate waits on his broker. Boerne's bid is Thu Oct 8, not asked yet.
  person(
    { contactId: 'tom', name: 'Tom Riddle', company: 'Bexar Steel Erectors', kind: 'trade', trade: 'Structural steel' },
    {
      jobIds: ['boerne'],
      person: lane([ok('invite_sent', '2026-09-25', 'Rosa'), ok('portal_opened', '2026-09-28', 'Tom'), ok('w9_signed', '2026-09-29')]),
      jobs: [job('boerne', [], { ask: [round('inv-tom-boerne', 'Boerne Retail Shell', null, [], '2026-10-08')] })],
    },
  ),
  // One job, so no master agreement. Her contract was signed Sat Sep 19; the start date is Rosa's. Change order 2 is with her.
  person(
    { contactId: 'priya', name: 'Dr. Priya Raman', company: 'Helotes Dental Office', kind: 'customer' },
    {
      jobIds: ['helotes'],
      jobs: [
        job('helotes', [ok('asked_us', '2026-09-01', 'Priya'), ok('bid_sent', '2026-09-10', 'Rosa'), ok('said_yes', '2026-09-18'), ok('contract_signed', '2026-09-19')], {
          co: [
            round('co-priya-1', 'CO 1 · exam 2 cabinets', '2026-09-24', [ok('co_answered', '2026-09-28')]),
            round('co-priya-2', 'CO 2 · a sink in exam 3', '2026-09-30', [stamp('co_answered', 'wait', '2026-09-30')]),
          ],
        }),
      ],
    },
  ),
  // A repeat customer. Pay app 4 went Mon Sep 28 and is with the architect for his certificate.
  person(
    { contactId: 'elena', name: 'Elena Marchetti', company: 'Cibolo Creek Partners', kind: 'customer' },
    {
      jobIds: ['boerne', 'padb', 'fairoaks', 'stoneoak'],
      person: lane([ok('msa_signed', '2026-08-04')]),
      jobs: [
        job(
          'boerne',
          [
            ok('asked_us', '2026-08-11'),
            ok('bid_sent', '2026-08-20', 'Rosa'),
            ok('said_yes', '2026-08-28'),
            ok('contract_signed', '2026-09-02'),
            ok('start_sent', '2026-09-08', 'Rosa'),
            ok('started', '2026-09-14'),
          ],
          {
            payapp: [
              round('payapp-3', 'Pay app 3', '2026-08-28', [ok('payapp_paid', '2026-09-25')]),
              round('payapp-4', 'Pay app 4', '2026-09-28', [stamp('payapp_paid', 'wait', '2026-09-28')], '2026-10-30'),
            ],
            co: [round('co-elena-1', 'CO 1', '2026-09-10', [ok('co_answered', '2026-09-12')]), round('co-elena-2', 'CO 2', '2026-09-16', [ok('co_answered', '2026-09-18')])],
          },
        ),
      ],
      waits: [{ stepId: 'payapp', jobId: 'boerne', waitingOn: { contactId: 'jonah', stepId: 'certify', since: '2026-09-28' } }],
    },
  ),
  // The architect. The Pond question closes Mon Oct 5 at noon; Addendum 2 was filed this morning and is not sent yet.
  person(
    { contactId: 'jonah', name: 'Jonah Vale', company: 'Marsh & Vale Architects', kind: 'arch' },
    {
      jobIds: ['boerne', 'padb'],
      jobs: [
        job('boerne', [ok('plans_in', '2026-09-15')], {
          questions: [
            round('q-panel', 'Panel size', '2026-09-16', [ok('question_answered', '2026-09-18')]),
            round('q-curbs', 'Roof curbs', '2026-09-21', [ok('question_answered', '2026-09-23')]),
            round('q-pond', 'Pond', '2026-10-02T08:30:00-05:00', [], '2026-10-05T12:00:00-05:00'),
          ],
          addenda: [
            round('add-1', 'Addendum 1', '2026-09-24', [ok('addendum_filed', '2026-09-24'), ok('addendum_sent', '2026-09-25')]),
            round('add-2', 'Addendum 2', '2026-10-02T10:00:00-05:00', [ok('addendum_filed', '2026-10-02T10:00:00-05:00')]),
          ],
          certify: [round('cert-payapp-4', 'Pay app 4 · Cibolo Creek', '2026-09-28')],
        }),
      ],
    },
  ),
  // A one-job customer who declined Tue Sep 29 and is off the flow.
  person(
    { contactId: 'marcus', name: 'Marcus Bell', company: 'Bell Family Dental', kind: 'customer' },
    {
      jobIds: ['bell'],
      jobs: [job('bell', [ok('asked_us', '2026-09-14', 'Marcus'), ok('bid_sent', '2026-09-21', 'Rosa'), ok('declined', '2026-09-29')])],
      off: { since: '2026-09-29', why: 'Declined our bid, went with another plumber.', by: 'Rosa' },
    },
  ),
  // A number nobody knows yet.
  person({ contactId: 'unk1', name: '(830) 555-0172', company: '', kind: 'unknown' }, { jobIds: [] }),

  // The board's companies with no thread.
  person(
    { contactId: 'g1', name: 'Alamo Steel', company: 'Alamo Steel', kind: 'trade', trade: 'Structural steel', ghost: true },
    {
      jobIds: ['stoneoak'],
      person: setUp('2026-09-03'),
      jobs: [job('stoneoak', [ok('carried', '2026-09-27', 'Robert')], { ask: [round('inv-g1', 'Stone Oak Pharmacy', '2026-09-10', [ok('quote_in', '2026-09-17')])] })],
    },
  ),
  person(
    { contactId: 'g2', name: 'Rio Paving', company: 'Rio Paving', kind: 'trade', trade: 'Paving', ghost: true },
    {
      jobIds: ['stoneoak'],
      person: setUp('2026-09-03'),
      jobs: [job('stoneoak', [ok('carried', '2026-10-01', 'Robert')], { ask: [round('inv-g2', 'Stone Oak Pharmacy', '2026-09-10', [ok('quote_in', '2026-09-21')])] })],
    },
  ),
  person(
    { contactId: 'g3', name: 'Lone Star Mechanical', company: 'Lone Star Mechanical', kind: 'trade', trade: 'Mechanical', ghost: true },
    {
      jobIds: ['boerne'],
      person: lane([ok('invite_sent', '2026-09-22', 'Rosa'), ok('portal_opened', '2026-09-30')]),
      jobs: [job('boerne', [], { ask: [round('inv-g3', 'Boerne Retail Shell', '2026-09-24', [stamp('quote_in', 'wait', '2026-09-24')], '2026-10-08')] })],
    },
  ),
  person(
    { contactId: 'g4', name: 'Cibolo Fence', company: 'Cibolo Fence', kind: 'trade', trade: 'Fencing', ghost: true },
    {
      jobIds: ['padb'],
      person: lane([ok('invite_sent', '2026-09-22', 'Rosa'), ok('portal_opened', '2026-09-26')]),
      jobs: [job('padb', [], { ask: [round('inv-g4', 'Boerne Retail Pad B', '2026-09-29', [stamp('quote_in', 'wait', '2026-09-29')], '2026-10-22')] })],
    },
  ),
  person(
    { contactId: 'g5', name: 'Kerr Electric', company: 'Kerr Electric', kind: 'trade', trade: 'Electrical', ghost: true },
    {
      jobIds: ['boerne', 'stoneoak'],
      person: lane([ok('invite_sent', '2026-09-15', 'Rosa'), ok('portal_opened', '2026-09-16'), ok('w9_signed', '2026-09-24'), ok('coi_current', '2026-09-29')]),
      jobs: [
        job('boerne', [], { ask: [round('inv-g5-boerne', 'Boerne Retail Shell', '2026-09-24', [stamp('quote_in', 'wait', '2026-09-24')], '2026-10-08')] }),
        job('stoneoak', [ok('carried', '2026-09-10', 'Robert'), ok('sow_signed', '2026-09-20')], {
          ask: [round('inv-g5-stoneoak', 'Stone Oak Pharmacy', '2026-09-01', [ok('quote_in', '2026-09-05')])],
          draws: [round('draw-g5-1', 'Draw 1', '2026-09-29')],
        }),
      ],
    },
  ),
  person(
    { contactId: 'g6', name: 'Hill Country Paving', company: 'Hill Country Paving', kind: 'trade', trade: 'Paving', ghost: true },
    { jobIds: [], person: setUp('2026-07-20'), off: { since: '2026-08-14', why: 'Do not use: walked off Stone Oak twice.', by: 'Robert' } },
  ),
  person(
    { contactId: 'g7', name: 'Medina Drywall', company: 'Medina Drywall', kind: 'trade', trade: 'Drywall', ghost: true },
    { jobIds: [], person: lane([ok('invite_sent', '2026-08-20', 'Rosa')]), off: { since: '2026-09-02', why: 'Closed the business.', by: 'Rosa' } },
  ),
  person(
    { contactId: 'g8', name: 'Oak Hills Veterinary', company: 'Oak Hills Veterinary', kind: 'customer', ghost: true },
    { jobIds: ['oakhills'], jobs: [job('oakhills', [ok('asked_us', '2026-09-28')])] },
  ),
  person(
    { contactId: 'g9', name: 'Leon Valley Bakery', company: 'Leon Valley Bakery', kind: 'customer', ghost: true },
    { jobIds: ['leonvalley'], jobs: [job('leonvalley', [ok('asked_us', '2026-09-08'), ok('bid_sent', '2026-09-24', 'Rosa')])] },
  ),
  person(
    { contactId: 'g10', name: 'Castle Hills HOA', company: 'Castle Hills HOA', kind: 'customer', ghost: true },
    {
      jobIds: ['castlehills'],
      jobs: [job('castlehills', [ok('asked_us', '2026-08-25'), ok('bid_sent', '2026-09-04', 'Rosa'), ok('declined', '2026-09-18')])],
      off: { since: '2026-09-18', why: 'Declined: price.', by: 'Rosa' },
    },
  ),
]

export function flowFixture(contactId: string): FlowFixturePerson {
  const p = FLOW_FIXTURE_PEOPLE.find((x) => x.contactId === contactId)
  if (!p) throw new Error(`flowFixtures: no demo person ${contactId}`)
  return p
}
