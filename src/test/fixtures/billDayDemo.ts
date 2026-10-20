/**
 * Bill day's test data: the Messages prototype's demo draws (v1.178, `DRAWS`, `OURS`, `OWNER_APPS` in
 * to-dos/gc-mode/messages/prototype.html on branch spike/gc-mode), laid out as main's shapes. Two jobs, Stone Oak
 * Pharmacy and Helotes Dental Office; seven trades; Wendi walks Stone Oak; Jonah Vale certifies it. Every draw's money
 * comes from main's kernels (`payApplication`, `drawMoney`), so the rows agree with the Draws window to the cent. Made-up
 * people only. The clock is the prototype's, Fri Oct 2, 2026; bill day is Sun Oct 25.
 */
import { drawLinesOf, drawMoney, payApplication } from '../../lib/gc/building'
import { initialGcState } from '../../lib/gc/schedule/testState'
import type { ScheduleActivity } from '../../lib/gc/schedule/types'
import type { ChangeOrder, Draw, DrawSentBack, GcProject, GcState, OwnerPayAppSent, Partner, Sow, SovLine, TradePackage } from '../../lib/gc/types'
import type { LineCheck } from '../../lib/gc/billDay/walk'

export const BILL_DAY_TODAY = '2026-10-02'

interface DrawSpec {
  id: string
  number: number
  toPct: Record<string, number>
  stored?: Record<string, number>
  requestedOn: string
  status: Draw['status']
  waiver: Draw['waiver']
  approvedOn?: string
  paidOn?: string
  backCharge?: number
}

/** A draw as main's kernels price it on the statement of work so far. */
function drawOn(sow: Sow, d: DrawSpec): Draw {
  const app = payApplication(sow, d.number, d.toPct, false, d.stored ?? {})
  const { gross, retainage, net } = drawMoney(sow, app)
  return {
    id: d.id,
    number: d.number,
    requestedOn: d.requestedOn,
    gross,
    retainage,
    net: net - (d.backCharge ?? 0),
    status: d.status,
    waiver: d.waiver,
    lines: drawLinesOf(app),
    ...(d.approvedOn ? { approvedOn: d.approvedOn } : {}),
    ...(d.paidOn ? { paidOn: d.paidOn } : {}),
    ...(d.backCharge ? { backCharges: [{ chargeId: `${d.id}-charge`, amount: d.backCharge }] } : {}),
  }
}

/** A signed statement of work with its draws, each line billed to the most an approved or paid draw took it. */
function sowOf(id: string, signedOn: string, lines: Omit<SovLine, 'pctBilled'>[], draws: DrawSpec[], sentBack?: { spec: DrawSpec; on: string; note: string; weSee: Record<string, number> }): Sow {
  let sow: Sow = {
    id,
    status: 'signed',
    price: lines.filter((l) => !l.changeOrderId).reduce((s, l) => s + l.amount, 0),
    retainagePct: 10,
    basedOnRev: 0,
    sov: lines.map((l) => ({ ...l, pctBilled: 0 })),
    signedOn,
    draws: [],
  }
  for (const d of draws) sow = { ...sow, draws: [...sow.draws, drawOn(sow, d)] }
  const billed = (lineId: string) =>
    Math.max(0, ...sow.draws.filter((d) => d.status !== 'requested').flatMap((d) => d.lines.filter((l) => l.sovId === lineId).map((l) => l.toPct)))
  sow = { ...sow, sov: sow.sov.map((l) => ({ ...l, pctBilled: billed(l.id) })) }
  if (sentBack) {
    const back: DrawSentBack = {
      draw: drawOn(sow, sentBack.spec),
      on: sentBack.on,
      note: sentBack.note,
      lines: Object.entries(sentBack.weSee).map(([sovId, weSee]) => ({ sovId, weSee })),
    }
    sow = { ...sow, sentBack: [back] }
  }
  return sow
}

function partner(base: Partner, id: string, company: string, contact: string, trade: string): Partner {
  return { ...base, id, company, contact, trades: [trade] }
}

function pkgOf(id: string, trade: string, partnerId: string, sow: Sow): TradePackage {
  const invite = `${id}-invite`
  return {
    id,
    trade,
    bidTab: null,
    scope: sow.sov.filter((l) => !l.changeOrderId).map((l) => ({ id: l.id, label: l.label })),
    budget: sow.price,
    selfPerform: null,
    invites: [{ id: invite, partnerId, status: 'bid', invitedOn: '2026-06-01', bid: null, seenRev: 0 }],
    carried: invite,
    awardedInviteId: invite,
    sow,
  }
}

function ourCrew(id: string, ref: string, value: number, pctDone: number): TradePackage {
  return { id, trade: 'Plumbing', bidTab: null, scope: [], budget: value, selfPerform: { ref, value, note: '', pctDone }, invites: [], carried: 'self', awardedInviteId: null, sow: null }
}

const bar = (lineId: string, packageId: string, start: string, finish: string): ScheduleActivity => ({ lineId, packageId, start, finish, after: [] })

/** An owner's pay application that went, at nothing: only its number, its day, its certificate and its payment matter here. */
function sentApp(number: number, periodTo: string, paidOn: string | null): OwnerPayAppSent {
  return { number, periodTo, sentOn: periodTo, doneToDate: {}, workToDate: 0, retainagePct: 10, retainage: 0, due: 0, paidOn, certified: 0, certifiedOn: periodTo }
}

/** Stone Oak's six trades and our crew, and Helotes' one trade and our crew, on the prototype's clock. */
export function billDayState(today = BILL_DAY_TODAY): GcState {
  const base = initialGcState()
  const template = base.projects.find((p) => p.id === 'helotes')
  const basePartner = base.partners[0]
  if (!template || !basePartner) throw new Error('the GC test state has no Helotes job or no partner')

  const partners = [
    partner(basePartner, 'bd-rio', 'Rio Paving', 'Dan Ruiz', 'Paving'),
    partner(basePartner, 'bd-hillside', 'Hillside Excavation', 'Greg Paulk', 'Sitework'),
    partner(basePartner, 'bd-kerr', 'Kerr Electric', 'Dana Kerr', 'Electrical'),
    partner(basePartner, 'bd-alamo', 'Alamo Steel', 'Pat Alamo', 'Structural steel'),
    partner(basePartner, 'bd-lonestar', 'Lone Star Mechanical', 'Luis Ortega', 'Mechanical'),
    partner(basePartner, 'bd-tejas', 'Tejas Power', 'Bill Sorrell', 'Electrical, low voltage'),
    partner(basePartner, 'bd-hcpaving', 'Hill Country Paving', '', 'Paving'),
  ]

  // Rio Paving: draw 2 went back Thu Oct 1; we see the lot's base at 50%, not the 80% claimed.
  const rio = sowOf(
    'sow-rio',
    '2026-07-10',
    [
      { id: 'rio-subgrade', label: 'Subgrade', amount: 30000, pctReported: 100 },
      { id: 'rio-drive', label: 'Base, drive', amount: 28000, pctReported: 100 },
      { id: 'rio-lot', label: 'Base, lot', amount: 34000, pctReported: 80 },
    ],
    [{ id: 'rio-1', number: 1, toPct: { 'rio-subgrade': 100, 'rio-drive': 60 }, requestedOn: '2026-08-18', status: 'paid', waiver: 'unconditional', approvedOn: '2026-08-24', paidOn: '2026-09-03' }],
    {
      spec: { id: 'rio-2', number: 2, toPct: { 'rio-drive': 100, 'rio-lot': 80 }, requestedOn: '2026-09-26', status: 'requested', waiver: 'conditional' },
      on: '2026-10-01',
      note: 'Line 3, Base, lot, reads 80%. We see 50%. Send it again.',
      weSee: { 'rio-lot': 50 },
    },
  )

  // Hillside Excavation: draw 3 not in; draw 2 was paid Sep 28 and its unconditional waiver is still owed.
  const hillside = sowOf(
    'sow-hillside',
    '2026-06-20',
    [{ id: 'hill-site', label: 'Sitework', amount: 120000, pctReported: 60 }],
    [
      { id: 'hill-1', number: 1, toPct: { 'hill-site': 40 }, requestedOn: '2026-07-18', status: 'paid', waiver: 'unconditional', approvedOn: '2026-07-24', paidOn: '2026-08-03' },
      { id: 'hill-2', number: 2, toPct: { 'hill-site': 60 }, requestedOn: '2026-08-19', status: 'paid', waiver: 'conditional', approvedOn: '2026-08-25', paidOn: '2026-09-28' },
    ],
  )

  // Kerr Electric: draw 3 not in, every waiver in; CO 3 signed both ways, now a line they can claim.
  const kerr = sowOf(
    'sow-kerr',
    '2026-06-25',
    [
      { id: 'kerr-rough', label: 'Rough-in', amount: 150000, pctReported: 50 },
      { id: 'kerr-trim', label: 'Trim', amount: 60000, pctReported: 0 },
      { id: 'kerr-co3', label: 'CO 3, pharmacy counter power', amount: 3400, pctReported: 0, changeOrderId: 'so-co3' },
    ],
    [
      { id: 'kerr-1', number: 1, toPct: { 'kerr-rough': 25 }, requestedOn: '2026-07-17', status: 'paid', waiver: 'unconditional', approvedOn: '2026-07-24', paidOn: '2026-08-03' },
      { id: 'kerr-2', number: 2, toPct: { 'kerr-rough': 50 }, requestedOn: '2026-08-18', status: 'paid', waiver: 'unconditional', approvedOn: '2026-08-25', paidOn: '2026-09-28' },
    ],
  )

  // Alamo Steel: first draw not in; signed Sep 27.
  const alamo = sowOf(
    'sow-alamo',
    '2026-09-27',
    [
      { id: 'alamo-erect', label: 'Erection', amount: 90000, pctReported: 0 },
      { id: 'alamo-embeds', label: 'Embeds', amount: 20000, pctReported: 0 },
    ],
    [],
  )

  // Lone Star Mechanical: draw 2 came Sep 28 and waits on us, with $4,100 of equipment stored; CO 1 is unsigned.
  const lonestar = sowOf(
    'sow-lonestar',
    '2026-06-28',
    [
      { id: 'ls-under', label: 'Underground', amount: 42000, pctReported: 100 },
      { id: 'ls-l1', label: 'Rough-in, level 1', amount: 58000, pctReported: 90 },
      { id: 'ls-l2', label: 'Rough-in, level 2', amount: 58000, pctReported: 10 },
      { id: 'ls-equip', label: 'Equipment', amount: 61000, pctReported: 0 },
    ],
    [
      { id: 'ls-1', number: 1, toPct: { 'ls-under': 100, 'ls-l1': 40 }, requestedOn: '2026-07-22', status: 'paid', waiver: 'unconditional', approvedOn: '2026-07-30', paidOn: '2026-08-28' },
      { id: 'ls-2', number: 2, toPct: { 'ls-l1': 90, 'ls-l2': 10 }, stored: { 'ls-equip': 4100 }, requestedOn: '2026-09-28', status: 'requested', waiver: 'conditional' },
    ],
  )

  // Tejas Power: draw 2 approved Wed Sep 30, with a $900 back-charge taken off it.
  const tejas = sowOf(
    'sow-tejas',
    '2026-06-30',
    [{ id: 'tejas-lv', label: 'Low voltage', amount: 100000, pctReported: 36 }],
    [
      { id: 'tejas-1', number: 1, toPct: { 'tejas-lv': 20 }, requestedOn: '2026-08-17', status: 'paid', waiver: 'unconditional', approvedOn: '2026-08-24', paidOn: '2026-09-03' },
      { id: 'tejas-2', number: 2, toPct: { 'tejas-lv': 36 }, requestedOn: '2026-09-26', status: 'approved', waiver: 'conditional', approvedOn: '2026-09-30', backCharge: 900 },
    ],
  )

  // Hill Country Paving on Helotes: first draw not in; signed Sep 30.
  const hcpaving = sowOf('sow-hcpaving', '2026-09-30', [{ id: 'hcp-drive', label: 'Drive', amount: 41000, pctReported: 0 }], [])

  const changeOrders: ChangeOrder[] = [
    {
      id: 'so-co1',
      number: 1,
      description: 'Relocate the rooftop unit curb.',
      reason: 'owner',
      schedule: 'none',
      packageId: 'so-mech',
      cost: 2600,
      price: 2990,
      status: 'sent',
      sentOn: '2026-09-24',
      answeredOn: null,
      pctDone: 0,
    },
    {
      id: 'so-co3',
      number: 3,
      description: 'Power at the pharmacy counter.',
      reason: 'owner',
      schedule: 'none',
      packageId: 'so-elec',
      cost: 3400,
      price: 3910,
      status: 'signed',
      sentOn: '2026-09-10',
      answeredOn: '2026-09-14',
      pctDone: 0,
      tradeChange: { status: 'signed', sentOn: '2026-09-15', signedOn: '2026-09-22', sovLineId: 'kerr-co3' },
    },
  ]

  const stoneoak: GcProject = {
    ...template,
    id: 'stoneoak',
    name: 'Stone Oak Pharmacy',
    stage: 'building',
    startedOn: '2026-06-15',
    ownerContractSignedOn: '2026-06-10',
    ownerContractWorth: undefined,
    customerId: 'cibolo',
    owner: 'Elena Marchetti',
    architect: 'Jonah Vale',
    packages: [
      pkgOf('so-paving', 'Paving', 'bd-rio', rio),
      pkgOf('so-site', 'Sitework', 'bd-hillside', hillside),
      pkgOf('so-elec', 'Electrical', 'bd-kerr', kerr),
      pkgOf('so-steel', 'Structural steel', 'bd-alamo', alamo),
      pkgOf('so-mech', 'Mechanical', 'bd-lonestar', lonestar),
      pkgOf('so-lv', 'Electrical, low voltage', 'bd-tejas', tejas),
      ourCrew('so-plumb', 'J1082', 45000, 62),
    ],
    changeOrders,
    changeRequests: undefined,
    ownerBilling: { billed: 0, paid: 0, retainageHeld: 0, payApps: [sentApp(1, '2026-07-25', '2026-08-24'), sentApp(2, '2026-08-25', '2026-09-24'), sentApp(3, '2026-09-25', '2026-10-01')] },
    schedule: {
      activities: [
        bar('rio-subgrade', 'so-paving', '2026-08-31', '2026-09-20'),
        bar('rio-drive', 'so-paving', '2026-09-08', '2026-09-29'),
        bar('rio-lot', 'so-paving', '2026-10-04', '2026-11-12'),
        bar('hill-site', 'so-site', '2026-07-09', '2026-11-13'),
        bar('kerr-rough', 'so-elec', '2026-08-26', '2026-11-20'),
        bar('alamo-erect', 'so-steel', '2026-10-01', '2026-12-01'),
        bar('ls-under', 'so-mech', '2026-07-01', '2026-09-12'),
        bar('ls-l1', 'so-mech', '2026-09-06', '2026-11-08'),
        bar('ls-l2', 'so-mech', '2026-10-20', '2026-12-08'),
        bar('ls-equip', 'so-mech', '2026-11-02', '2026-11-20'),
      ],
      milestones: [],
      baseline: null,
      lookAhead: [],
    },
    team: [{ role: 'superintendent', name: 'Wendi', phone: '(210) 555-0190' }],
    rfis: undefined,
    punch: undefined,
    submittals: undefined,
    dailyLogs: undefined,
    waits: undefined,
    scheduleSends: undefined,
    closedOn: null,
  }

  const helotes: GcProject = {
    ...template,
    stage: 'building',
    startedOn: '2026-09-28',
    ownerContractSignedOn: '2026-09-20',
    ownerContractWorth: undefined,
    architect: '',
    packages: [pkgOf('hd-paving', 'Paving', 'bd-hcpaving', hcpaving), ourCrew('hd-plumb', 'J1085', 42000, 20)],
    changeOrders: [],
    changeRequests: undefined,
    ownerBilling: null,
    schedule: { activities: [bar('hcp-drive', 'hd-paving', '2026-10-11', '2026-11-29')], milestones: [], baseline: null, lookAhead: [] },
    team: [],
    rfis: undefined,
    punch: undefined,
    submittals: undefined,
    dailyLogs: undefined,
    waits: undefined,
    scheduleSends: undefined,
    closedOn: null,
  }

  return { ...base, today, partners: [...base.partners, ...partners], projects: [stoneoak, helotes] }
}

export function billDayJob(state: GcState, id: 'stoneoak' | 'helotes'): GcProject {
  const project = state.projects.find((p) => p.id === id)
  if (!project) throw new Error(`no ${id} in the bill day test state`)
  return project
}

/** Wendi's walk of Lone Star's draw 2 on Thu Oct 22: level 1 at 75% with a photo and a note, level 2 as claimed, the equipment on site. */
export const WENDI_WALK: LineCheck[] = [
  { drawId: 'ls-2', sovId: 'ls-l1', weSee: 75, onSite: null, photo: true, note: 'East wing branch lines not hung.', by: 'Wendi', at: '2026-10-22T10:05:00Z' },
  { drawId: 'ls-2', sovId: 'ls-l2', weSee: 10, onSite: null, photo: false, note: '', by: 'Wendi', at: '2026-10-22T10:20:00Z' },
  { drawId: 'ls-2', sovId: 'ls-equip', weSee: null, onSite: true, photo: false, note: '', by: 'Wendi', at: '2026-10-22T09:40:00Z' },
]

/** Where Lone Star's lines are on site (cut 9's `gc_sow_lines.where_on_site`). */
export const WHERE_ON_SITE: Record<string, string> = { 'ls-under': 'Site', 'ls-l1': 'Level 1', 'ls-l2': 'Level 2', 'ls-equip': 'Yard' }
