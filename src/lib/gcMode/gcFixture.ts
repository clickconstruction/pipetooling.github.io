/**
 * GC mode — design spike. The made-up data the prototype starts from (Start over puts it back).
 * Split out of gcModel.ts verbatim; import from `./gcModel`, which re-exports every file.
 */
import type { AskContact, GcCustomer, GcProject, GcState, Includes, Invite, InviteStatus, Partner, ScopeItem, SubBid, TradePackage } from './gcTypes'

// ---------------------------------------------------------------------------------------------
// Fixture
// ---------------------------------------------------------------------------------------------

function scope(prefix: string, labels: string[]): ScopeItem[] {
  return labels.map((label, i) => ({ id: `${prefix}-${i + 1}`, label }))
}

function bid(
  items: ScopeItem[],
  amount: number,
  basedOnRev: number,
  submittedOn: string,
  note = '',
  gaps: Record<string, Includes> = {},
  plugs: Record<string, number> = {},
): SubBid {
  const includes: Record<string, Includes> = {}
  for (const item of items) includes[item.id] = gaps[item.id] ?? 'yes'
  return { amount, basedOnRev, submittedOn, includes, plugs, note }
}

function invite(
  packageId: string,
  partnerId: string,
  status: InviteStatus,
  seenRev: number | null,
  b: SubBid | null = null,
): Invite {
  return { id: `${packageId}-${partnerId}`, partnerId, status, invitedOn: '2026-09-19', seenRev, bid: b }
}

function pkg(
  id: string,
  trade: string,
  items: ScopeItem[],
  budget: number,
  invites: Invite[],
  rest: Partial<TradePackage> = {},
): TradePackage {
  return {
    id,
    trade,
    bidTab: null,
    scope: items,
    budget,
    selfPerform: null,
    invites,
    carried: null,
    awardedInviteId: null,
    sow: null,
    ...rest,
  }
}

export function initialGcState(): GcState {
  const site = scope('site', ['Clearing and grading', 'Utilities to 5 ft of the building', 'Paving', 'Striping and signs'])
  const conc = scope('conc', ['Foundations', 'Slab on grade', 'Sidewalks and curbs', 'Rebar supply'])
  const steel = scope('steel', ['Structural steel', 'Joists and deck', 'Erection'])
  const roof = scope('roof', ['TPO membrane', 'Insulation', 'Sheet metal and flashing', 'Roof curbs'])
  const plumb = scope('plumb', ['Underground', 'Rough in', 'Top out', 'Trim'])
  const hvac = scope('hvac', ['Rooftop units', 'Ductwork', 'Controls', 'Test and balance'])
  const elec = scope('elec', ['Service and gear', 'Panels and feeders', 'Lighting', 'Fire alarm', 'Site lighting'])
  const fire = scope('fire', ['Design and permit', 'Mains and branch lines', 'Heads and trim'])

  const dry = scope('dry', ['Framing', 'Hang and tape', 'Ceilings'])
  const dElec = scope('delec', ['Panels and feeders', 'Lighting', 'Devices', 'Low voltage rough'])
  const dHvac = scope('dhvac', ['Split systems', 'Ductwork', 'Controls'])
  const mill = scope('mill', ['Reception desk', 'Operatory cabinets', 'Break room'])

  const boerne: GcProject = {
    id: 'boerne',
    name: 'Boerne Retail Shell',
    address: '1420 River Rd, Boerne',
    town: 'Boerne',
    ourBidSentOn: null,
    ownerContractSignedOn: null,
    permitOn: null,
    startDate: null,
    startedOn: null,
    customerId: 'cibolo',
    owner: 'Cibolo Creek Partners',
    ownerBilling: null,
    architectId: 'marshvale',
    architect: 'Marsh & Vale Architects',
    questions: [
      {
        id: 'q-elec-1',
        packageId: 'elec',
        partnerId: 'brightline',
        text: 'E-301 shows a 400 amp service. The panel schedules add up to 520 amps. Which is right?',
        askedOn: '2026-09-30',
        answeredOn: null,
        answer: null,
      },
      {
        id: 'q-roof-1',
        packageId: 'roof',
        partnerId: 'summit',
        text: 'Who sets the roof curbs, the roofer or the mechanical contractor? A-401 and M-101 disagree.',
        askedOn: '2026-09-27',
        answeredOn: null,
        answer: null,
      },
      {
        id: 'q-site-1',
        packageId: 'site',
        partnerId: 'lonestar',
        text: 'Is striping part of sitework?',
        askedOn: '2026-09-24',
        answeredOn: '2026-09-26',
        answer: 'Yes. Striping and signs are in sitework. See note 14 on C-101.',
      },
    ],
    stage: 'pursuing',
    bidDue: '2026-10-08',
    sizeNote: '8,400 sq ft shell, three tenant bays',
    sheets: [
      { id: 'G-001', title: 'Cover and code summary' },
      { id: 'C-101', title: 'Site plan' },
      { id: 'C-201', title: 'Grading and drainage' },
      { id: 'C-301', title: 'Utility plan' },
      { id: 'A-101', title: 'Floor plan' },
      { id: 'A-201', title: 'Exterior elevations' },
      { id: 'A-301', title: 'Building sections' },
      { id: 'A-401', title: 'Wall sections and details' },
      { id: 'S-101', title: 'Foundation plan' },
      { id: 'S-201', title: 'Roof framing plan' },
      { id: 'M-101', title: 'Mechanical plan' },
      { id: 'M-201', title: 'Mechanical schedules' },
      { id: 'E-101', title: 'Lighting plan' },
      { id: 'E-201', title: 'Power plan' },
      { id: 'E-301', title: 'One-line diagram and panel schedules' },
      { id: 'P-101', title: 'Plumbing underground' },
      { id: 'P-102', title: 'Plumbing plan' },
      { id: 'FP-101', title: 'Fire sprinkler plan' },
    ],
    planSets: [
      { rev: 0, label: 'Bid set', issuedOn: '2026-09-18', note: 'The set the owner sent out to bid. 18 sheets.', changedSheets: [], touches: [] },
      {
        rev: 1,
        label: 'Addendum 1',
        issuedOn: '2026-09-29',
        note: 'The tenant panel moved to the east wall. RTU-2 is one size larger.',
        changedSheets: ['E-201', 'E-301', 'M-101', 'P-102'],
        touches: ['elec', 'hvac', 'plumb'],
        sentTo: ['lonestar', 'tricounty', 'hillside', 'alamo', 'guadalupe', 'bexar', 'summit', 'bluebonnet', 'coolbreeze', 'kendall', 'voltage', 'brightline', 'tejas'].map((partnerId) => ({
          partnerId,
          on: '2026-09-29',
          touched: ['coolbreeze', 'kendall', 'voltage', 'brightline', 'tejas'].includes(partnerId),
        })),
      },
    ],
    packages: [
      pkg('site', 'Sitework', site, 185_000, [
        invite('site', 'lonestar', 'bid', 1, bid(site, 178_400, 1, '2026-09-30', 'Striping by others.', { 'site-4': 'no' }, { 'site-4': 6_500 })),
        invite('site', 'tricounty', 'bid', 1, bid(site, 191_000, 1, '2026-10-01')),
        invite('site', 'hillside', 'opened', 0),
      ], { carried: 'site-lonestar' }),
      pkg('conc', 'Concrete', conc, 212_000, [
        invite('conc', 'alamo', 'bid', 1, bid(conc, 205_500, 1, '2026-09-30', 'Rebar per the structural drawings.', { 'conc-4': 'unclear' })),
        invite('conc', 'guadalupe', 'bid', 1, bid(conc, 219_800, 1, '2026-10-01')),
      ], { carried: 'conc-guadalupe' }),
      pkg('steel', 'Structural steel', steel, 164_000, [
        invite('steel', 'bexar', 'invited', null),
        invite('steel', 'comal', 'declined', 0),
      ]),
      pkg('roof', 'Roofing', roof, 118_000, [
        invite('roof', 'summit', 'bid', 1, bid(roof, 112_300, 1, '2026-09-28', 'Curbs by the mechanical contractor.', { 'roof-4': 'no' })),
        invite('roof', 'bluebonnet', 'opened', 1),
      ], { carried: 'roof-summit' }),
      pkg('plumb', 'Plumbing', plumb, 86_400, [], {
        selfPerform: { ref: 'BP 512', value: 86_400, note: 'Our own bid, priced in Trades mode.' },
        carried: 'self',
      }),
      pkg('hvac', 'HVAC', hvac, 142_000, [
        invite('hvac', 'coolbreeze', 'bid', 0, bid(hvac, 148_900, 0, '2026-09-25')),
        invite('hvac', 'kendall', 'bid', 1, bid(hvac, 139_200, 1, '2026-10-01', 'Test and balance by an independent firm.', { 'hvac-4': 'no' }, { 'hvac-4': 4_800 })),
      ]),
      pkg('elec', 'Electrical', elec, 171_000, [
        invite('elec', 'voltage', 'bid', 0, bid(elec, 166_000, 0, '2026-09-26', 'Fire alarm excluded.', { 'elec-4': 'no' }, { 'elec-4': 14_000 })),
        invite('elec', 'brightline', 'bid', 1, bid(elec, 182_500, 1, '2026-10-01')),
        invite('elec', 'tejas', 'opened', 0),
      ]),
      pkg('fire', 'Fire sprinkler', fire, 44_000, []),
    ],
    generalConditions: 138_000,
    contingencyPct: 3,
    feePct: 8,
  }

  const helotes: GcProject = {
    id: 'helotes',
    name: 'Helotes Dental Office',
    address: '9811 Bandera Rd, Suite 140, Helotes',
    town: 'Helotes',
    ourBidSentOn: '2026-08-27',
    ownerContractSignedOn: '2026-09-04',
    permitOn: null,
    startDate: null,
    startedOn: null,
    customerId: 'raman',
    owner: 'Dr. Priya Raman',
    ownerBilling: { billed: 61_000, paid: 42_300, retainageHeld: 6_100 },
    architectId: 'ocotillo',
    architect: 'Studio Ocotillo',
    questions: [
      {
        id: 'q-dry-1',
        packageId: 'dry',
        partnerId: 'hillcountry',
        text: 'Are the operatory walls full height to the deck?',
        askedOn: '2026-08-18',
        answeredOn: '2026-08-19',
        answer: 'Yes, to the deck, with sound batts. See detail 4 on A-201.',
      },
    ],
    stage: 'buyout',
    bidDue: null,
    sizeNote: '3,100 sq ft tenant finish out, six operatories',
    sheets: [
      { id: 'G-001', title: 'Cover and code summary' },
      { id: 'A-101', title: 'Demolition and floor plan' },
      { id: 'A-102', title: 'Reflected ceiling plan' },
      { id: 'A-201', title: 'Interior elevations' },
      { id: 'A-501', title: 'Millwork details' },
      { id: 'ID-101', title: 'Finish plan' },
      { id: 'M-101', title: 'Mechanical plan' },
      { id: 'E-101', title: 'Lighting plan' },
      { id: 'E-102', title: 'Power and data plan' },
      { id: 'E-201', title: 'Panel schedules' },
      { id: 'P-101', title: 'Plumbing plan' },
      { id: 'P-201', title: 'Plumbing risers and dental air' },
    ],
    planSets: [
      { rev: 0, label: 'Permit set', issuedOn: '2026-08-11', note: 'The set the city approved. 12 sheets.', changedSheets: [], touches: [] },
    ],
    packages: [
      pkg('dry', 'Framing and drywall', dry, 66_000, [
        invite('dry', 'hillcountry', 'bid', 0, bid(dry, 64_200, 0, '2026-08-20')),
      ], {
        carried: 'dry-hillcountry',
        awardedInviteId: 'dry-hillcountry',
        sow: {
          status: 'signed',
          price: 64_200,
          retainagePct: 10,
          basedOnRev: 0,
          signedOn: '2026-08-29',
          sov: [
            { id: 'dry-1', label: 'Framing', amount: 22_000, pctReported: 100, pctBilled: 100 },
            { id: 'dry-2', label: 'Hang and tape', amount: 27_200, pctReported: 60, pctBilled: 0 },
            { id: 'dry-3', label: 'Ceilings', amount: 15_000, pctReported: 0, pctBilled: 0 },
          ],
          draws: [
            {
              id: 'dry-draw-1',
              number: 1,
              requestedOn: '2026-09-19',
              gross: 22_000,
              retainage: 2_200,
              net: 19_800,
              status: 'paid',
              waiver: 'unconditional',
              lines: [{ sovId: 'dry-1', toPct: 100 }],
            },
          ],
        },
      }),
      pkg('delec', 'Electrical', dElec, 58_000, [
        invite('delec', 'brightline', 'bid', 0, bid(dElec, 56_900, 0, '2026-08-21')),
        invite('delec', 'voltage', 'bid', 0, bid(dElec, 61_400, 0, '2026-08-22')),
      ], {
        carried: 'delec-brightline',
        awardedInviteId: 'delec-brightline',
        sow: {
          status: 'sent',
          price: 56_900,
          retainagePct: 10,
          basedOnRev: 0,
          signedOn: null,
          sov: [
            { id: 'delec-1', label: 'Panels and feeders', amount: 14_200, pctReported: 0, pctBilled: 0 },
            { id: 'delec-2', label: 'Lighting', amount: 14_200, pctReported: 0, pctBilled: 0 },
            { id: 'delec-3', label: 'Devices', amount: 14_200, pctReported: 0, pctBilled: 0 },
            { id: 'delec-4', label: 'Low voltage rough', amount: 14_300, pctReported: 0, pctBilled: 0 },
          ],
          draws: [],
        },
      }),
      pkg('dhvac', 'HVAC', dHvac, 49_000, [
        invite('dhvac', 'kendall', 'bid', 0, bid(dHvac, 47_600, 0, '2026-08-22')),
      ], {
        carried: 'dhvac-kendall',
        awardedInviteId: 'dhvac-kendall',
        sow: {
          status: 'draft',
          price: 47_600,
          retainagePct: 10,
          basedOnRev: 0,
          signedOn: null,
          sov: [
            { id: 'dhvac-1', label: 'Split systems', amount: 15_800, pctReported: 0, pctBilled: 0 },
            { id: 'dhvac-2', label: 'Ductwork', amount: 15_800, pctReported: 0, pctBilled: 0 },
            { id: 'dhvac-3', label: 'Controls', amount: 16_000, pctReported: 0, pctBilled: 0 },
          ],
          draws: [],
        },
      }),
      pkg('dplumb', 'Plumbing', scope('dplumb', ['Underground', 'Rough in', 'Top out', 'Trim']), 38_500, [], {
        selfPerform: { ref: 'J 1042', value: 38_500, note: 'Our own crew. The job runs on the Pipeline.' },
        carried: 'self',
      }),
      pkg('mill', 'Millwork', mill, 41_000, [
        invite('mill', 'cedar', 'bid', 0, bid(mill, 39_800, 0, '2026-08-25')),
        invite('mill', 'sawtooth', 'bid', 0, bid(mill, 43_100, 0, '2026-08-26')),
      ], { carried: 'mill-cedar' }),
    ],
    generalConditions: 52_000,
    contingencyPct: 3,
    feePct: 10,
  }

  const padB: GcProject = {
    id: 'padb',
    name: 'Boerne Retail Pad B',
    address: '1436 River Rd, Boerne',
    town: 'Boerne',
    ourBidSentOn: null,
    ownerContractSignedOn: null,
    permitOn: null,
    startDate: null,
    startedOn: null,
    customerId: 'cibolo',
    owner: 'Cibolo Creek Partners',
    ownerBilling: null,
    architectId: 'marshvale',
    architect: 'Marsh & Vale Architects',
    questions: [],
    stage: 'pursuing',
    bidDue: '2026-10-22',
    sizeNote: '4,200 sq ft drive-through pad building',
    sheets: [
      { id: 'G-001', title: 'Cover and code summary' },
      { id: 'C-101', title: 'Site plan' },
      { id: 'A-101', title: 'Floor plan' },
      { id: 'A-201', title: 'Exterior elevations' },
      { id: 'S-101', title: 'Foundation plan' },
      { id: 'M-101', title: 'Mechanical plan' },
      { id: 'E-101', title: 'Power and lighting plan' },
      { id: 'P-101', title: 'Plumbing plan' },
    ],
    planSets: [
      { rev: 0, label: 'Pricing set', issuedOn: '2026-10-01', note: 'Early drawings for a budget price. 8 sheets.', changedSheets: [], touches: [] },
    ],
    packages: [
      pkg('bsite', 'Sitework', scope('bsite', ['Clearing and grading', 'Utilities to 5 ft of the building', 'Paving']), 96_000, []),
      pkg('bconc', 'Concrete', scope('bconc', ['Foundations', 'Slab on grade', 'Drive-through lane']), 118_000, []),
      pkg('bplumb', 'Plumbing', scope('bplumb', ['Underground', 'Rough in', 'Top out', 'Trim']), 61_000, [], {
        selfPerform: { ref: 'BP 518', value: 61_000, note: 'Our own bid, priced in Trades mode.' },
        carried: 'self',
      }),
    ],
    generalConditions: 74_000,
    contingencyPct: 5,
    feePct: 8,
  }

  // Owner Billing lane: a project at its end, so the retainage the owner holds can be released.
  // Every line is billed and paid; Live Oak and Westside have asked for their retainage;
  // Cool Breeze still owes its warranty letter and final pay application.
  const sDry = scope('sdry', ['Framing', 'Hang and tape', 'Ceilings'])
  const sElec = scope('selec', ['Panels and feeders', 'Lighting', 'Devices'])
  const sHvac = scope('shvac', ['Split systems', 'Ductwork', 'Controls'])
  const stoneOak: GcProject = {
    id: 'stoneoak',
    name: 'Stone Oak Pharmacy',
    address: '20811 Stone Oak Pkwy, Suite 104, San Antonio',
    town: 'San Antonio',
    ourBidSentOn: '2026-05-14',
    ownerContractSignedOn: '2026-05-29',
    permitOn: '2026-06-05',
    startDate: '2026-06-15',
    startedOn: '2026-06-12',
    customerId: 'hollis',
    owner: 'Hollis Family Pharmacy',
    ownerBilling: {
      billed: 182_413,
      paid: 164_171.7,
      retainageHeld: 18_241.3,
      payApps: [
        {
          number: 1,
          periodTo: '2026-07-25',
          sentOn: '2026-07-25',
          doneToDate: { sdry: 21_000, selec: 14_000, shvac: 0, splumb: 10_400, gc: 7_953.28, contingency: 1_600.6, fee: 5_495.39 },
          workToDate: 60_449.27,
          retainagePct: 10,
          retainage: 6_044.93,
          due: 54_404.34,
          paidOn: '2026-08-14',
        },
        {
          number: 2,
          periodTo: '2026-08-25',
          sentOn: '2026-08-25',
          doneToDate: { sdry: 21_000, selec: 14_000, shvac: 25_000, splumb: 18_200, gc: 13_699.27, contingency: 2_756.98, fee: 9_465.62 },
          workToDate: 104_121.87,
          retainagePct: 10,
          retainage: 10_412.19,
          due: 39_305.34,
          paidOn: '2026-09-15',
        },
        {
          number: 3,
          periodTo: '2026-09-25',
          sentOn: '2026-09-25',
          doneToDate: { sdry: 42_000, selec: 38_000, shvac: 31_000, splumb: 26_000, gc: 24_000, contingency: 4_830, fee: 16_583 },
          workToDate: 182_413,
          retainagePct: 10,
          retainage: 18_241.3,
          due: 70_462.02,
          paidOn: '2026-10-01',
        },
      ],
    },
    architectId: 'mesquite',
    architect: 'Mesquite Design Studio',
    questions: [],
    stage: 'building',
    bidDue: null,
    sizeNote: '2,400 sq ft pharmacy finish out',
    sheets: [
      { id: 'G-001', title: 'Cover and code summary' },
      { id: 'A-101', title: 'Floor plan' },
      { id: 'A-201', title: 'Interior elevations' },
      { id: 'M-101', title: 'Mechanical plan' },
      { id: 'E-101', title: 'Lighting and power plan' },
      { id: 'P-101', title: 'Plumbing plan' },
    ],
    planSets: [
      { rev: 0, label: 'Permit set', issuedOn: '2026-05-01', note: 'The set the city approved. 6 sheets.', changedSheets: [], touches: [] },
    ],
    packages: [
      pkg('sdry', 'Framing and drywall', sDry, 43_000, [invite('sdry', 'liveoak', 'bid', 0, bid(sDry, 42_000, 0, '2026-05-06'))], {
        carried: 'sdry-liveoak',
        awardedInviteId: 'sdry-liveoak',
        sow: {
          status: 'signed',
          price: 42_000,
          retainagePct: 10,
          basedOnRev: 0,
          signedOn: '2026-06-02',
          sov: [
            { id: 'sdry-1', label: 'Framing', amount: 21_000, pctReported: 100, pctBilled: 100 },
            { id: 'sdry-2', label: 'Hang and tape', amount: 12_000, pctReported: 100, pctBilled: 100 },
            { id: 'sdry-3', label: 'Ceilings', amount: 9_000, pctReported: 100, pctBilled: 100 },
          ],
          draws: [
            { id: 'sdry-draw-1', number: 1, requestedOn: '2026-07-20', gross: 21_000, retainage: 2_100, net: 18_900, status: 'paid', waiver: 'unconditional', lines: [{ sovId: 'sdry-1', toPct: 100 }] },
            { id: 'sdry-draw-2', number: 2, requestedOn: '2026-09-18', gross: 21_000, retainage: 2_100, net: 18_900, status: 'paid', waiver: 'unconditional', lines: [{ sovId: 'sdry-2', toPct: 100 }, { sovId: 'sdry-3', toPct: 100 }] },
            {
              id: 'sdry-draw-3',
              number: 3,
              requestedOn: '2026-09-30',
              gross: 0,
              retainage: -4_200,
              net: 4_200,
              status: 'requested',
              waiver: 'conditional',
              lines: [],
              payApp: { periodTo: '2026-09-30', address: '5410 Bandera Rd, San Antonio, TX 78238', license: '', signedBy: 'Darnell Pruitt', signedTitle: 'Owner', signedOn: '2026-09-30' },
              final: true,
            },
          ],
          acceptedOn: '2026-09-24',
          warrantyOn: '2026-09-26',
        },
      }),
      pkg('selec', 'Electrical', sElec, 39_000, [invite('selec', 'westside', 'bid', 0, bid(sElec, 38_000, 0, '2026-05-07'))], {
        carried: 'selec-westside',
        awardedInviteId: 'selec-westside',
        sow: {
          status: 'signed',
          price: 38_000,
          retainagePct: 10,
          basedOnRev: 0,
          signedOn: '2026-06-03',
          sov: [
            { id: 'selec-1', label: 'Panels and feeders', amount: 14_000, pctReported: 100, pctBilled: 100 },
            { id: 'selec-2', label: 'Lighting', amount: 14_000, pctReported: 100, pctBilled: 100 },
            { id: 'selec-3', label: 'Devices', amount: 10_000, pctReported: 100, pctBilled: 100 },
          ],
          draws: [
            { id: 'selec-draw-1', number: 1, requestedOn: '2026-07-22', gross: 14_000, retainage: 1_400, net: 12_600, status: 'paid', waiver: 'unconditional', lines: [{ sovId: 'selec-1', toPct: 100 }] },
            { id: 'selec-draw-2', number: 2, requestedOn: '2026-09-19', gross: 24_000, retainage: 2_400, net: 21_600, status: 'paid', waiver: 'unconditional', lines: [{ sovId: 'selec-2', toPct: 100 }, { sovId: 'selec-3', toPct: 100 }] },
            {
              id: 'selec-draw-3',
              number: 3,
              requestedOn: '2026-09-30',
              gross: 0,
              retainage: -3_800,
              net: 3_800,
              status: 'requested',
              waiver: 'conditional',
              lines: [],
              payApp: { periodTo: '2026-09-30', address: '2210 Fredericksburg Rd, San Antonio, TX 78201', license: 'TECL 31876', signedBy: 'Ana Flores', signedTitle: 'Owner', signedOn: '2026-09-30' },
              final: true,
            },
          ],
          acceptedOn: '2026-09-24',
          warrantyOn: '2026-09-25',
        },
      }),
      pkg('shvac', 'HVAC', sHvac, 32_000, [invite('shvac', 'coolbreeze', 'bid', 0, bid(sHvac, 31_000, 0, '2026-05-08'))], {
        carried: 'shvac-coolbreeze',
        awardedInviteId: 'shvac-coolbreeze',
        sow: {
          status: 'signed',
          price: 31_000,
          retainagePct: 10,
          basedOnRev: 0,
          signedOn: '2026-06-04',
          sov: [
            { id: 'shvac-1', label: 'Split systems', amount: 13_000, pctReported: 100, pctBilled: 100 },
            { id: 'shvac-2', label: 'Ductwork', amount: 12_000, pctReported: 100, pctBilled: 100 },
            { id: 'shvac-3', label: 'Controls', amount: 6_000, pctReported: 100, pctBilled: 100 },
          ],
          draws: [
            { id: 'shvac-draw-1', number: 1, requestedOn: '2026-08-18', gross: 25_000, retainage: 2_500, net: 22_500, status: 'paid', waiver: 'unconditional', lines: [{ sovId: 'shvac-1', toPct: 100 }, { sovId: 'shvac-2', toPct: 100 }] },
            { id: 'shvac-draw-2', number: 2, requestedOn: '2026-09-22', gross: 6_000, retainage: 600, net: 5_400, status: 'paid', waiver: 'unconditional', lines: [{ sovId: 'shvac-3', toPct: 100 }] },
          ],
          acceptedOn: '2026-09-29',
          warrantyOn: null,
        },
      }),
      pkg('splumb', 'Plumbing', scope('splumb', ['Underground', 'Rough in', 'Top out', 'Trim']), 26_000, [], {
        selfPerform: { ref: 'J 1071', value: 26_000, note: 'Our own crew. The job runs on the Pipeline.', pctDone: 100 },
        carried: 'self',
      }),
    ],
    generalConditions: 24_000,
    contingencyPct: 3,
    feePct: 10,
  }

  const customers: GcCustomer[] = [
    {
      id: 'cibolo',
      name: 'Cibolo Creek Partners',
      kind: 'Developer',
      contact: 'Elena Marchetti',
      contactRole: 'Development manager',
      phone: '(830) 555-0142',
      email: 'elena@cibolocreekpartners.example',
      address: '200 Main Plaza, Suite 300, Boerne',
      howTheyBuy: 'Invites three general contractors and takes the low qualified price.',
      payDays: 38,
      retainagePct: 10,
      portalOn: true,
      portalLastOpened: '2026-09-30',
      answerDays: null,
      contacts: [
        { on: '2026-09-29', by: 'Robert', note: 'Elena sent Addendum 1. She wants the price to hold for 60 days.' },
        { on: '2026-09-18', by: 'Robert', note: 'Walked the site. Pad B will follow about two weeks behind the shell.' },
      ],
      past: [
        { name: 'Fair Oaks Shops, Building C', year: 2025, outcome: 'built', value: 1_420_000, note: 'Finished nine days early.' },
        { name: 'Herff Road Medical Shell', year: 2025, outcome: 'lost', value: 2_180_000, note: 'Lost by 2.1% to another general contractor.' },
        { name: 'Fair Oaks Shops, Building A', year: 2024, outcome: 'built', value: 1_265_000, note: '' },
      ],
      tradesNote: 'We also bid plumbing on four of their buildings under other general contractors, and won one.',
    },
    {
      id: 'raman',
      name: 'Dr. Priya Raman',
      kind: 'Owner who will use the space',
      contact: 'Dr. Priya Raman',
      contactRole: 'Owner',
      phone: '(210) 555-0177',
      email: 'priya@helotesdental.example',
      address: '9811 Bandera Rd, Suite 140, Helotes',
      howTheyBuy: 'Came to us by referral. Negotiated price, no other bidders.',
      payDays: 21,
      retainagePct: 10,
      portalOn: false,
      portalLastOpened: null,
      answerDays: null,
      contacts: [
        { on: '2026-09-26', by: 'Robert', note: 'She asked to move the opening to December 1. Told her millwork is the long lead.' },
      ],
      past: [],
      tradesNote: null,
    },
    {
      id: 'marshvale',
      name: 'Marsh & Vale Architects',
      kind: 'Architect',
      contact: 'Jonah Vale',
      contactRole: 'Project architect',
      phone: '(210) 555-0119',
      email: 'jonah@marshvale.example',
      address: '410 Broadway, Suite 210, San Antonio',
      howTheyBuy: null,
      payDays: null,
      retainagePct: null,
      portalOn: false,
      portalLastOpened: null,
      answerDays: 2,
      contacts: [
        { on: '2026-09-29', by: 'Robert', note: 'Jonah issued Addendum 1. He expects one more addendum before bid day.' },
        { on: '2026-08-14', by: 'Wendi', note: 'Called about the water heater schedule on a plumbing bid. Jonah answered the same day.' },
      ],
      past: [],
      tradesNote: 'They drew three buildings we bid plumbing on, and Fair Oaks Shops A and C, which we built.',
    },
    {
      id: 'ocotillo',
      name: 'Studio Ocotillo',
      kind: 'Architect',
      contact: 'Camila Reyes',
      contactRole: 'Principal',
      phone: '(210) 555-0163',
      email: 'camila@studioocotillo.example',
      address: '88 Pearl Pkwy, San Antonio',
      howTheyBuy: null,
      payDays: null,
      retainagePct: null,
      portalOn: false,
      portalLastOpened: null,
      answerDays: 1,
      contacts: [],
      past: [],
      tradesNote: null,
    },
    {
      id: 'hollis',
      name: 'Hollis Family Pharmacy',
      kind: 'Owner who will use the space',
      contact: 'Dana Hollis',
      contactRole: 'Owner and pharmacist',
      phone: '(210) 555-0142',
      email: 'dana@hollispharmacy.example',
      address: '20811 Stone Oak Pkwy, Suite 104, San Antonio',
      howTheyBuy: 'Picked us from three builders on price and schedule.',
      payDays: 18,
      retainagePct: 10,
      portalOn: true,
      portalLastOpened: '2026-09-26',
      answerDays: null,
      contacts: [
        { on: '2026-09-29', by: 'Robert', note: 'Dana wants to open October 20. She asked what is left before the last bill.' },
      ],
      past: [],
      tradesNote: null,
    },
    {
      id: 'mesquite',
      name: 'Mesquite Design Studio',
      kind: 'Architect',
      contact: 'Theo Park',
      contactRole: 'Project architect',
      phone: '(210) 555-0188',
      email: 'theo@mesquitedesign.example',
      address: '1202 S Alamo St, San Antonio',
      howTheyBuy: null,
      payDays: null,
      retainagePct: null,
      portalOn: false,
      portalLastOpened: null,
      answerDays: 2,
      contacts: [],
      past: [],
      tradesNote: null,
    },
  ]

  const partner = (
    id: string,
    company: string,
    contact: string,
    trades: string[],
    msa: Partner['msa'],
    coiExpires: string | null,
    w9: boolean,
    record: [number, number, number],
  ): Partner => ({
    id,
    company,
    contact,
    trades,
    base: null,
    maxMiles: null,
    msa,
    msaSignedOn: msa === 'signed' ? '2026-06-12' : null,
    coiExpires,
    w9,
    invited: record[0],
    bids: record[1],
    won: record[2],
    promisesMade: 0,
    promisesKept: 0,
  })

  /** Where each company drives from, and how far they will go. */
  const coverage: Record<string, [string, number]> = {
    lonestar: ['San Antonio', 75],
    tricounty: ['New Braunfels', 100],
    hillside: ['Kerrville', 50],
    alamo: ['San Antonio', 100],
    guadalupe: ['Seguin', 75],
    bexar: ['San Antonio', 150],
    comal: ['New Braunfels', 50],
    ironhorse: ['Austin', 150],
    summit: ['San Antonio', 100],
    bluebonnet: ['Austin', 75],
    coolbreeze: ['San Antonio', 100],
    kendall: ['Boerne', 75],
    voltage: ['San Antonio', 120],
    brightline: ['San Marcos', 100],
    tejas: ['Laredo', 200],
    redline: ['San Antonio', 100],
    aquashield: ['Waco', 100],
    hillcountry: ['Boerne', 60],
    cedar: ['Fredericksburg', 80],
    sawtooth: ['San Antonio', 100],
    liveoak: ['San Antonio', 60],
    westside: ['San Antonio', 80],
  }

  /** Promises of a quote date on earlier jobs: made, kept. */
  const word: Record<string, [number, number]> = {
    hillside: [2, 0],
    bluebonnet: [2, 1],
    tejas: [1, 0],
    coolbreeze: [3, 3],
    kendall: [3, 3],
    brightline: [4, 4],
    voltage: [5, 4],
    lonestar: [3, 2],
    summit: [2, 2],
    bexar: [2, 1],
  }

  /** The story so far on a few live asks, so Follow up opens with something to chase. */
  const story: Record<string, AskContact[]> = {
    'site-hillside': [
      { on: '2026-09-26', by: 'Robert', how: 'call', note: 'Greg is busy on a subdivision. Says he will price it by Wednesday.', promisedBy: '2026-09-30' },
    ],
    'roof-bluebonnet': [
      { on: '2026-09-30', by: 'Robert', how: 'call', note: 'Wes has the plans open. He will have a number Monday.', promisedBy: '2026-10-05' },
      { on: '2026-09-24', by: 'Robert', how: 'email', note: 'Sent the roof plan and the spec section again.' },
    ],
    'elec-tejas': [
      { on: '2026-10-01', by: 'Wendi', how: 'text', note: 'Bill texted back: quote by end of day Friday.', promisedBy: '2026-10-02' },
    ],
    'hvac-coolbreeze': [
      { on: '2026-09-22', by: 'Robert', how: 'call', note: 'Andre will quote by Friday the 26th.', promisedBy: '2026-09-26' },
    ],
  }
  const withStory = (project: GcProject): GcProject => ({
    ...project,
    packages: project.packages.map((k) => ({
      ...k,
      invites: k.invites.map((i) => (story[i.id] ? { ...i, contacts: story[i.id] } : i)),
    })),
  })

  // Building lane (2026-10-02): a project already well into building, so Building and Closeout
  // show on open. Each trade sits at a different point: closed out, waiting on our acceptance, a
  // draw waiting on us, a draw locked by expired insurance with a waiver owed, a pay application
  // sent back, our own crew, and a quiet one. Its owner billing is left to the Owner Billing lane.
  // Its companies are ones the other lanes' tests do not read (plus Pecan Valley, new), so their
  // pins on Lonestar, Alamo, Bexar, Voltage, Brightline and Kendall stay as they were.
  const fSite = scope('fsite', ['Clearing and grading', 'Utilities to 5 ft of the building', 'Paving', 'Striping and signs'])
  const fConc = scope('fconc', ['Foundations', 'Slab on grade', 'Sidewalks and curbs'])
  const fSteel = scope('fsteel', ['Structural steel', 'Joists and deck', 'Erection'])
  const fElec = scope('felec', ['Service and gear', 'Panels and feeders', 'Lighting', 'Fire alarm', 'Site lighting'])
  const fRoof = scope('froof', ['TPO membrane', 'Insulation', 'Sheet metal and flashing', 'Roof curbs'])
  const fHvac = scope('fhvac', ['Rooftop units', 'Ductwork', 'Controls', 'Test and balance'])
  const asked = (packageId: string, partnerId: string, b: SubBid): Invite => ({ ...invite(packageId, partnerId, 'bid', 0, b), invitedOn: '2026-04-30' })
  const typedBy = (signedBy: string, signedTitle: string, signedOn: string, periodTo: string, address: string) => ({
    periodTo,
    address,
    license: '',
    signedBy,
    signedTitle,
    signedOn,
  })

  const fairOaksD: GcProject = {
    id: 'fairoaksd',
    name: 'Fair Oaks Shops, Building D',
    address: '7920 Fair Oaks Pkwy, Fair Oaks Ranch',
    town: 'Boerne',
    ourBidSentOn: '2026-05-14',
    ownerContractSignedOn: '2026-06-02',
    permitOn: '2026-06-20',
    startDate: '2026-07-06',
    startedOn: '2026-07-01',
    customerId: 'cibolo',
    owner: 'Cibolo Creek Partners',
    ownerBilling: null,
    architectId: 'marshvale',
    architect: 'Marsh & Vale Architects',
    questions: [],
    stage: 'building',
    bidDue: null,
    sizeNote: '9,600 sq ft retail shell, four bays',
    sheets: [
      { id: 'G-001', title: 'Cover and code summary' },
      { id: 'C-101', title: 'Site plan' },
      { id: 'S-101', title: 'Foundation plan' },
      { id: 'S-201', title: 'Roof framing plan' },
      { id: 'A-101', title: 'Floor plan' },
      { id: 'A-201', title: 'Exterior elevations' },
      { id: 'A-501', title: 'Roof plan and details' },
      { id: 'M-101', title: 'Mechanical plan' },
      { id: 'P-101', title: 'Plumbing plan' },
      { id: 'E-101', title: 'Power and lighting plan' },
      { id: 'E-201', title: 'Site lighting and panel schedules' },
    ],
    planSets: [
      { rev: 0, label: 'Permit set', issuedOn: '2026-04-28', note: 'The set the city approved. 11 sheets.', changedSheets: [], touches: [] },
    ],
    packages: [
      pkg('fsite', 'Sitework', fSite, 172_000, [
        asked('fsite', 'tricounty', bid(fSite, 168_000, 0, '2026-05-07')),
      ], {
        carried: 'fsite-tricounty',
        awardedInviteId: 'fsite-tricounty',
        // Closed out: every line billed, accepted, warranty in, the retainage paid back, both final waivers in.
        sow: {
          status: 'signed',
          price: 168_000,
          retainagePct: 10,
          basedOnRev: 0,
          signedOn: '2026-06-08',
          sov: [
            { id: 'fsite-1', label: 'Clearing and grading', amount: 42_000, pctReported: 100, pctBilled: 100 },
            { id: 'fsite-2', label: 'Utilities to 5 ft of the building', amount: 56_000, pctReported: 100, pctBilled: 100 },
            { id: 'fsite-3', label: 'Paving', amount: 54_000, pctReported: 100, pctBilled: 100 },
            { id: 'fsite-4', label: 'Striping and signs', amount: 16_000, pctReported: 100, pctBilled: 100 },
          ],
          draws: [
            {
              id: 'fsite-draw-1', number: 1, requestedOn: '2026-07-24', gross: 98_000, retainage: 9_800, net: 88_200, status: 'paid', waiver: 'unconditional',
              lines: [{ sovId: 'fsite-1', toPct: 100 }, { sovId: 'fsite-2', toPct: 100 }],
              payApp: typedBy('Marisol Vega', 'Owner', '2026-07-24', '2026-07-24', '2210 Old San Antonio Rd, Boerne, TX 78006'),
            },
            {
              id: 'fsite-draw-2', number: 2, requestedOn: '2026-08-25', gross: 70_000, retainage: 7_000, net: 63_000, status: 'paid', waiver: 'unconditional',
              lines: [{ sovId: 'fsite-3', toPct: 100 }, { sovId: 'fsite-4', toPct: 100 }],
              payApp: typedBy('Marisol Vega', 'Owner', '2026-08-25', '2026-08-25', '2210 Old San Antonio Rd, Boerne, TX 78006'),
            },
            {
              id: 'fsite-draw-3', number: 3, requestedOn: '2026-09-14', gross: 0, retainage: -16_800, net: 16_800, status: 'paid', waiver: 'unconditional',
              lines: [], final: true,
              payApp: typedBy('Marisol Vega', 'Owner', '2026-09-14', '2026-09-14', '2210 Old San Antonio Rd, Boerne, TX 78006'),
            },
          ],
          acceptedOn: '2026-09-08',
          warrantyOn: '2026-09-10',
        },
      }),
      pkg('fconc', 'Concrete', fConc, 220_000, [
        asked('fconc', 'guadalupe', bid(fConc, 214_000, 0, '2026-05-09')),
      ], {
        carried: 'fconc-guadalupe',
        awardedInviteId: 'fconc-guadalupe',
        // Every line billed and the warranty letter in: waiting on us to walk it and accept the work.
        sow: {
          status: 'signed',
          price: 214_000,
          retainagePct: 10,
          basedOnRev: 0,
          signedOn: '2026-06-09',
          sov: [
            { id: 'fconc-1', label: 'Foundations', amount: 78_000, pctReported: 100, pctBilled: 100 },
            { id: 'fconc-2', label: 'Slab on grade', amount: 96_000, pctReported: 100, pctBilled: 100 },
            { id: 'fconc-3', label: 'Sidewalks and curbs', amount: 40_000, pctReported: 100, pctBilled: 100 },
          ],
          draws: [
            {
              id: 'fconc-draw-1', number: 1, requestedOn: '2026-07-31', gross: 78_000, retainage: 7_800, net: 70_200, status: 'paid', waiver: 'unconditional',
              lines: [{ sovId: 'fconc-1', toPct: 100 }],
              payApp: typedBy('Ines Barrera', 'President', '2026-07-31', '2026-07-31', '4415 Rittiman Rd, San Antonio, TX 78218'),
            },
            {
              id: 'fconc-draw-2', number: 2, requestedOn: '2026-08-29', gross: 136_000, retainage: 13_600, net: 122_400, status: 'paid', waiver: 'unconditional',
              lines: [{ sovId: 'fconc-2', toPct: 100 }, { sovId: 'fconc-3', toPct: 100 }],
              payApp: typedBy('Ines Barrera', 'President', '2026-08-29', '2026-08-29', '4415 Rittiman Rd, San Antonio, TX 78218'),
            },
          ],
          acceptedOn: null,
          warrantyOn: '2026-09-30',
        },
      }),
      pkg('fsteel', 'Structural steel', fSteel, 190_000, [
        asked('fsteel', 'ironhorse', bid(fSteel, 186_000, 0, '2026-05-11')),
      ], {
        carried: 'fsteel-ironhorse',
        awardedInviteId: 'fsteel-ironhorse',
        // Draw 2 is waiting on us, with its pay application: approve it or send it back.
        sow: {
          status: 'signed',
          price: 186_000,
          retainagePct: 10,
          basedOnRev: 0,
          signedOn: '2026-06-11',
          sov: [
            { id: 'fsteel-1', label: 'Structural steel', amount: 92_000, pctReported: 100, pctBilled: 100 },
            { id: 'fsteel-2', label: 'Joists and deck', amount: 64_000, pctReported: 100, pctBilled: 0 },
            { id: 'fsteel-3', label: 'Erection', amount: 30_000, pctReported: 80, pctBilled: 0 },
          ],
          draws: [
            {
              id: 'fsteel-draw-1', number: 1, requestedOn: '2026-08-21', gross: 92_000, retainage: 9_200, net: 82_800, status: 'paid', waiver: 'unconditional',
              lines: [{ sovId: 'fsteel-1', toPct: 100 }],
              payApp: typedBy('Luz Carrasco', 'Project manager', '2026-08-21', '2026-08-21', '9030 Rigsby Ave, San Antonio, TX 78263'),
            },
            {
              id: 'fsteel-draw-2', number: 2, requestedOn: '2026-09-30', gross: 88_000, retainage: 8_800, net: 79_200, status: 'requested', waiver: 'conditional',
              lines: [{ sovId: 'fsteel-2', toPct: 100 }, { sovId: 'fsteel-3', toPct: 80 }],
              payApp: typedBy('Luz Carrasco', 'Project manager', '2026-09-30', '2026-09-30', '9030 Rigsby Ave, San Antonio, TX 78263'),
            },
          ],
        },
      }),
      pkg('felec', 'Electrical', fElec, 252_000, [
        asked('felec', 'pecanvalley', bid(fElec, 248_000, 0, '2026-05-12')),
      ], {
        carried: 'felec-pecanvalley',
        awardedInviteId: 'felec-pecanvalley',
        // Draw 1 is paid but its unconditional waiver is owed. Draw 2 is waiting on us, and their
        // insurance ran out Sep 15, so Approve stays locked until a new certificate comes in.
        sow: {
          status: 'signed',
          price: 248_000,
          retainagePct: 10,
          basedOnRev: 0,
          signedOn: '2026-06-12',
          sov: [
            { id: 'felec-1', label: 'Service and gear', amount: 62_000, pctReported: 100, pctBilled: 100 },
            { id: 'felec-2', label: 'Panels and feeders', amount: 54_000, pctReported: 80, pctBilled: 50 },
            { id: 'felec-3', label: 'Lighting', amount: 72_000, pctReported: 40, pctBilled: 0 },
            { id: 'felec-4', label: 'Fire alarm', amount: 36_000, pctReported: 0, pctBilled: 0 },
            { id: 'felec-5', label: 'Site lighting', amount: 24_000, pctReported: 0, pctBilled: 0 },
          ],
          draws: [
            {
              id: 'felec-draw-1', number: 1, requestedOn: '2026-08-20', gross: 89_000, retainage: 8_900, net: 80_100, status: 'paid', waiver: 'conditional',
              lines: [{ sovId: 'felec-1', toPct: 100 }, { sovId: 'felec-2', toPct: 50 }],
              payApp: typedBy('Marcus Bell', 'Owner', '2026-08-20', '2026-08-20', '1817 Austin Hwy, San Antonio, TX 78218'),
            },
            {
              id: 'felec-draw-2', number: 2, requestedOn: '2026-10-01', gross: 45_000, retainage: 4_500, net: 40_500, status: 'requested', waiver: 'conditional',
              lines: [{ sovId: 'felec-2', toPct: 80 }, { sovId: 'felec-3', toPct: 40 }],
              payApp: typedBy('Marcus Bell', 'Owner', '2026-10-01', '2026-09-30', '1817 Austin Hwy, San Antonio, TX 78218'),
            },
          ],
        },
      }),
      pkg('froof', 'Roofing', fRoof, 136_000, [
        asked('froof', 'summit', bid(fRoof, 132_000, 0, '2026-05-11')),
        asked('froof', 'bluebonnet', bid(fRoof, 139_800, 0, '2026-05-12')),
      ], {
        carried: 'froof-summit',
        awardedInviteId: 'froof-summit',
        // Pay application 1 went back: they asked for the whole membrane, we see half of it down.
        sow: {
          status: 'signed',
          price: 132_000,
          retainagePct: 10,
          basedOnRev: 0,
          signedOn: '2026-06-15',
          sov: [
            { id: 'froof-1', label: 'TPO membrane', amount: 64_000, pctReported: 100, pctBilled: 0 },
            { id: 'froof-2', label: 'Insulation', amount: 28_000, pctReported: 100, pctBilled: 0 },
            { id: 'froof-3', label: 'Sheet metal and flashing', amount: 26_000, pctReported: 0, pctBilled: 0 },
            { id: 'froof-4', label: 'Roof curbs', amount: 14_000, pctReported: 0, pctBilled: 0 },
          ],
          draws: [],
          sentBack: [
            {
              draw: {
                id: 'froof-draw-1', number: 1, requestedOn: '2026-09-26', gross: 92_000, retainage: 9_200, net: 82_800, status: 'requested', waiver: 'conditional',
                lines: [{ sovId: 'froof-1', toPct: 100 }, { sovId: 'froof-2', toPct: 100 }],
                payApp: typedBy('Carla Nguyen', 'Office manager', '2026-09-26', '2026-09-25', '640 FM 306, New Braunfels, TX 78130'),
              },
              on: '2026-09-29',
              note: 'The membrane is down on the east half only. The west half is still insulation board.',
              lines: [{ sovId: 'froof-1', weSee: 50 }],
            },
          ],
        },
      }),
      pkg('fplumb', 'Plumbing', scope('fplumb', ['Underground', 'Rough in', 'Top out', 'Trim']), 112_000, [], {
        selfPerform: { ref: 'J 1088', value: 112_000, note: 'Our own crew. The job runs on the Pipeline.', pctDone: 65 },
        carried: 'self',
      }),
      pkg('fhvac', 'HVAC', fHvac, 160_000, [
        asked('fhvac', 'coolbreeze', bid(fHvac, 158_000, 0, '2026-05-12')),
      ], {
        carried: 'fhvac-coolbreeze',
        awardedInviteId: 'fhvac-coolbreeze',
        // Quiet: draw 1 paid and waived; they have reported more work than they have asked for.
        sow: {
          status: 'signed',
          price: 158_000,
          retainagePct: 10,
          basedOnRev: 0,
          signedOn: '2026-06-16',
          sov: [
            { id: 'fhvac-1', label: 'Rooftop units', amount: 72_000, pctReported: 0, pctBilled: 0 },
            { id: 'fhvac-2', label: 'Ductwork', amount: 54_000, pctReported: 80, pctBilled: 60 },
            { id: 'fhvac-3', label: 'Controls', amount: 18_000, pctReported: 0, pctBilled: 0 },
            { id: 'fhvac-4', label: 'Test and balance', amount: 14_000, pctReported: 0, pctBilled: 0 },
          ],
          draws: [
            {
              id: 'fhvac-draw-1', number: 1, requestedOn: '2026-09-22', gross: 32_400, retainage: 3_240, net: 29_160, status: 'paid', waiver: 'unconditional',
              lines: [{ sovId: 'fhvac-2', toPct: 60 }],
              payApp: typedBy('Andre Wallace', 'Owner', '2026-09-22', '2026-09-22', '12700 Toepperwein Rd, Live Oak, TX 78233'),
            },
          ],
        },
      }),
    ],
    generalConditions: 96_000,
    contingencyPct: 3,
    feePct: 10,
  }

  return {
    today: '2026-10-02',
    customers,
    projects: [withStory(boerne), padB, helotes, fairOaksD, stoneOak],
    partners: [
      partner('lonestar', 'Lonestar Earthworks', 'Dale Whitfield', ['Sitework'], 'signed', '2027-03-01', true, [6, 5, 2]),
      partner('tricounty', 'Tri-County Site', 'Marisol Vega', ['Sitework'], 'signed', '2027-01-15', true, [4, 4, 1]),
      partner('hillside', 'Hillside Excavation', 'Greg Paulk', ['Sitework'], 'none', null, false, [2, 0, 0]),
      partner('alamo', 'Alamo Concrete', 'Hector Luna', ['Concrete'], 'signed', '2026-12-20', true, [7, 6, 3]),
      partner('guadalupe', 'Guadalupe Flatwork', 'Ines Barrera', ['Concrete'], 'signed', '2027-02-10', true, [3, 3, 0]),
      partner('bexar', 'Bexar Steel Erectors', 'Tom Riddle', ['Structural steel'], 'signed', '2027-04-30', true, [3, 1, 1]),
      partner('comal', 'Comal Iron', 'Ray Odom', ['Structural steel'], 'none', null, true, [2, 0, 0]),
      partner('ironhorse', 'Iron Horse Fabrication', 'Luz Carrasco', ['Structural steel'], 'signed', '2027-05-05', true, [1, 1, 0]),
      partner('summit', 'Summit Roofing', 'Carla Nguyen', ['Roofing'], 'signed', '2027-06-01', true, [5, 5, 2]),
      partner('bluebonnet', 'Bluebonnet Roofing', 'Wes Hartley', ['Roofing'], 'sent', '2026-11-30', true, [2, 1, 0]),
      partner('coolbreeze', 'Cool Breeze Mechanical', 'Andre Wallace', ['HVAC'], 'signed', '2027-01-31', true, [5, 4, 1]),
      partner('kendall', 'Kendall Air', 'Josie Tran', ['HVAC'], 'sent', '2027-02-28', true, [4, 4, 1]),
      partner('voltage', 'Voltage Brothers', 'Sam Okafor', ['Electrical'], 'signed', '2026-09-15', true, [8, 7, 2]),
      partner('brightline', 'Brightline Electric', 'Nora Castillo', ['Electrical'], 'signed', '2027-03-20', true, [6, 6, 3]),
      partner('tejas', 'Tejas Power', 'Bill Sorrell', ['Electrical'], 'none', null, false, [1, 0, 0]),
      partner('redline', 'Redline Fire Protection', 'Mina Shah', ['Fire sprinkler'], 'signed', '2027-02-01', true, [3, 3, 2]),
      partner('aquashield', 'AquaShield Sprinkler', 'Pete Doyle', ['Fire sprinkler'], 'none', null, false, [0, 0, 0]),
      partner('hillcountry', 'Hill Country Interiors', 'Rosa Medina', ['Framing and drywall'], 'signed', '2027-04-12', true, [4, 4, 3]),
      partner('cedar', 'Cedar & Pine Millwork', 'Owen Blake', ['Millwork'], 'none', '2027-01-08', true, [2, 2, 0]),
      partner('sawtooth', 'Sawtooth Cabinet Co', 'Jill Arnett', ['Millwork'], 'signed', '2027-03-03', true, [2, 2, 1]),
      // Building lane: the electrician on Fair Oaks D, whose insurance ran out mid-job.
      partner('pecanvalley', 'Pecan Valley Electric', 'Marcus Bell', ['Electrical'], 'signed', '2026-09-15', true, [3, 3, 1]),
      // Owner Billing lane: the two companies on Stone Oak Pharmacy, a job at its end.
      partner('liveoak', 'Live Oak Drywall', 'Darnell Pruitt', ['Framing and drywall'], 'signed', '2027-05-01', true, [3, 3, 1]),
      partner('westside', 'Westside Electric', 'Ana Flores', ['Electrical'], 'signed', '2027-04-15', true, [3, 3, 1]),
    ].map((p) => {
      const c = coverage[p.id]
      const w = word[p.id] ?? [0, 0]
      return { ...p, promisesMade: w[0], promisesKept: w[1], ...(c ? { base: c[0], maxMiles: c[1] } : {}) }
    }),
    log: [],
  }
}

/**
 * The general contractor the trade's portal speaks for. One made-up record, so the words never
 * name a company: a later company is a new record, not new words. `shortName` is what a trade
 * reads in a sentence ("Tell Click when your number will come").
 */
export const GC_COMPANY = { name: 'Click Construction', shortName: 'Click' }
