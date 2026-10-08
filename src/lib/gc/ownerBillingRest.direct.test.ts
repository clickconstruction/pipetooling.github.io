/**
 * Main's own tests for the Owner Billing kernels O2b moved that the moved tests do not call: the billing
 * forecast, the cash weeks, the time extension, the late finish, the pay application's cells and our
 * final pay application. Each runs a kernel directly on the test data, the prototype's made-up jobs on
 * Fri Oct 2, and pins the prototype's own answer: every expected value below came from the same call on
 * branch spike/gc-mode. On the spike these ran inside the reducer's tests, which stay there.
 */
import { describe, expect, it } from 'vitest'
import { aboutMoney, billedJobs, billingByMonth, billingForecast, customerShiftWords, forecastPct, shiftWords, weekBillingShift } from './billingForecast'
import { barsChangeWords, billDayWords, expectedBills, expectedDraws, expectedThrough, lowestWeekWords, seenPct } from './cashForecast'
import { lateFinish } from './lateFinish'
import { changeOrderPct, ownerFinalPayAppToSend, ownerPayAppForm, ownerPayAppParties } from './ownerBilling'
import { cashAhead, cashMoves } from './ownerBillingAhead'
import { payAppCells, payAppFileName, splitAddress } from './payAppFile'
import { initialGcState } from './schedule/testState'
import { askedMoveIds, isTimeExtension, openAskMoves, timeExtensionAsk, timeExtensionLines, timeExtensionRule } from './timeExtension'
import type { ChangeOrder, GcState } from './types'

const job = (s: GcState, id: string) => s.projects.find((p) => p.id === id)!
/** Every number to the cent, and a project by its id, so a value reads the same however it was added up. */
const pin = (value: unknown): unknown =>
  JSON.parse(
    JSON.stringify(value, (_k, x: unknown) => {
      if (typeof x === 'number') return Math.round(x * 100) / 100
      if (x && typeof x === 'object' && 'packages' in x && 'stage' in x && 'id' in x) return (x as { id: string }).id
      return x
    }),
  )
/** A change order to ask about, on no trade. */
const co: ChangeOrder = { id: 'co-9', number: 9, description: 'A test change', reason: 'owner', schedule: 'none', packageId: null, cost: 1000, price: 1100, status: 'signed', sentOn: '2026-09-28', answeredOn: '2026-10-01', pctDone: 0 }

describe('Billing the customer, the rest, on the made-up jobs, Fri Oct 2', () => {
  it('bills the jobs that are ours and started', () => {
    const s = initialGcState()
    expect(billedJobs(s).map((p) => p.id)).toEqual(['helotes', 'fairoaksd', 'stoneoak'])
  })

  it('spreads a bar\'s rest evenly to its finish', () => {
    expect([forecastPct('2026-10-01', '2026-10-31', 20, '2026-10-02', '2026-10-25'), forecastPct('2026-10-01', '2026-10-31', 20, '2026-10-02', '2026-11-05'), forecastPct('2026-10-01', '2026-10-31', 20, '2026-10-02', '2026-09-30')]).toEqual([83.44827586206897, 100, 20])
  })

  it('forecasts each month\'s bill from the schedule as it stands', () => {
    const s = initialGcState()
    expect(pin(billingForecast(s, job(s, 'fairoaksd')))).toEqual({
      project: 'fairoaksd',
      months: [
                {
                  on: '2026-10-25',
                  workToDate: 1366043.03,
                  pct: 92,
                  retainage: 136604.3,
                  bill: 368743.61,
                  byTrade: [
                             { label: 'Roofing', amount: 122230.05 },
                             { label: 'Electrical', amount: 120518.83 },
                             { label: 'HVAC', amount: 114407.33 },
                             { label: 'Plumbing', amount: 34224.41 },
                             { label: 'Structural steel', amount: 18334.51 },
                           ],
                },
                {
                  on: '2026-11-25',
                  workToDate: 1444270.26,
                  pct: 97,
                  retainage: 144427.03,
                  bill: 70404.51,
                  byTrade: [{ label: 'Electrical', amount: 56225.82 }, { label: 'HVAC', amount: 22001.41 }],
                },
                {
                  on: '2026-12-25',
                  workToDate: 1488762,
                  pct: 100,
                  retainage: 148876.2,
                  bill: 40042.56,
                  byTrade: [{ label: 'Plumbing', amount: 27379.53 }, { label: 'HVAC', amount: 17112.21 }],
                },
              ],
      heldAtEnd: 148876.2,
      draft: { on: '2026-10-25', due: 98566.31 },
      unplaced: 0,
      none: null,
    })
  })

  it('adds the forecast up by month across the jobs', () => {
    const s = initialGcState()
    expect(pin(billingByMonth(s))).toEqual({
      months: [
                { on: '2026-10-25', total: 368743.61, jobs: [{ project: 'fairoaksd', bill: 368743.61 }] },
                { on: '2026-11-25', total: 70404.51, jobs: [{ project: 'fairoaksd', bill: 70404.51 }] },
                { on: '2026-12-25', total: 40042.56, jobs: [{ project: 'fairoaksd', bill: 40042.56 }] },
              ],
      heldAtEnd: 167117.5,
      noSchedule: ['helotes'],
      unplaced: [],
    })
  })

  it('says how this week\'s marks moved the forecast', () => {
    const s = initialGcState()
    const shifts = weekBillingShift(s, job(s, 'fairoaksd'))
    expect(pin([shifts, shiftWords(shifts, 'did'), customerShiftWords(shifts), aboutMoney(12345), aboutMoney(987654)])).toEqual([[], null, null, 'about $12,300', 'about $987,700'])
  })

  it('lists the money on the books, in and out', () => {
    const s = initialGcState()
    const moves = cashMoves(s)
    expect(pin([moves.length, moves.slice(0, 4)])).toEqual([
      26,
      [
        {
          waitingOnArchitect: false,
          askedOn: null,
          final: true,
          expected: false,
          project: 'helotes',
          dir: 'out',
          who: 'Hill Country Interiors',
          number: null,
          amount: 2200,
          on: null,
          why: 'retainage',
        },
        {
          waitingOnArchitect: false,
          askedOn: null,
          final: false,
          expected: true,
          project: 'helotes',
          dir: 'out',
          who: 'Hill Country Interiors',
          number: 2,
          amount: 14688,
          on: '2026-11-04',
          why: 'nextDraw',
          billOn: '2026-10-25',
        },
        {
          waitingOnArchitect: false,
          askedOn: null,
          final: false,
          expected: true,
          project: 'helotes',
          dir: 'in',
          who: 'Dr. Priya Raman',
          number: 1,
          amount: 47301.2,
          on: '2026-11-15',
          why: 'nextBill',
          billOn: '2026-10-25',
        },
        {
          waitingOnArchitect: false,
          askedOn: null,
          final: false,
          expected: false,
          project: 'fairoaksd',
          dir: 'in',
          who: 'Cibolo Creek Partners',
          number: 3,
          amount: 288878.51,
          on: '2026-09-30',
          why: 'late',
        },
      ],
    ])
  })

  it('expects each job\'s bills on the day that customer pays', () => {
    const s = initialGcState()
    expect(pin([expectedBills(s, job(s, 'fairoaksd'), 'schedule'), expectedBills(s, job(s, 'fairoaksd'), 'reported')])).toEqual([
      [
        {
          waitingOnArchitect: false,
          askedOn: null,
          final: false,
          expected: true,
          project: 'fairoaksd',
          dir: 'in',
          who: 'Cibolo Creek Partners',
          number: 4,
          amount: 368743.61,
          on: '2026-12-02',
          why: 'nextBill',
          billOn: '2026-10-25',
          fromBars: true,
        },
        {
          waitingOnArchitect: false,
          askedOn: null,
          final: false,
          expected: true,
          project: 'fairoaksd',
          dir: 'in',
          who: 'Cibolo Creek Partners',
          number: 5,
          amount: 70404.51,
          on: '2027-01-02',
          why: 'nextBill',
          billOn: '2026-11-25',
          fromBars: true,
        },
        {
          waitingOnArchitect: false,
          askedOn: null,
          final: false,
          expected: true,
          project: 'fairoaksd',
          dir: 'in',
          who: 'Cibolo Creek Partners',
          number: 6,
          amount: 40042.56,
          on: '2027-02-01',
          why: 'nextBill',
          billOn: '2026-12-25',
          fromBars: true,
        },
      ],
      [
        {
          waitingOnArchitect: false,
          askedOn: null,
          final: false,
          expected: true,
          project: 'fairoaksd',
          dir: 'in',
          who: 'Cibolo Creek Partners',
          number: 4,
          amount: 98566.31,
          on: '2026-12-02',
          why: 'nextBill',
          billOn: '2026-10-25',
        },
      ],
    ])
  })

  it('expects each trade\'s draws for the work it reaches', () => {
    const s = initialGcState()
    expect(pin(expectedDraws(s, job(s, 'fairoaksd'), 'reported').slice(0, 4))).toEqual([
      {
        waitingOnArchitect: false,
        askedOn: null,
        final: false,
        expected: true,
        project: 'fairoaksd',
        dir: 'out',
        who: 'Summit Roofing',
        number: 1,
        amount: 54000,
        on: '2026-11-04',
        why: 'nextDraw',
        billOn: '2026-10-25',
      },
      {
        waitingOnArchitect: false,
        askedOn: null,
        final: false,
        expected: true,
        project: 'fairoaksd',
        dir: 'out',
        who: 'Cool Breeze Mechanical',
        number: 2,
        amount: 9720,
        on: '2026-11-04',
        why: 'nextDraw',
        billOn: '2026-10-25',
      },
    ])
  })

  it('says what reading the bars changes in the weeks', () => {
    const s = initialGcState()
    const schedule = cashAhead(s, { bars: 'schedule' })
    const reported = cashAhead(s, { bars: 'reported' })
    expect(pin([barsChangeWords(schedule, reported), lowestWeekWords(schedule), expectedThrough(schedule)])).toEqual([
      [
        'As the schedule stands, $205,920 more goes to the trades in these weeks.',
        'The bills it expects bring $380,624 more, all of it after these weeks.',
      ],
      'Summit Roofing $118,800 and Cool Breeze Mechanical $84,240 are most of it.',
      '2026-12-25',
    ])
  })

  it('reads what we see on a line the trade reported', () => {
    const s = initialGcState()
    const sow = job(s, 'fairoaksd').packages.find((p) => p.sow)!.sow!
    expect(sow.sov.slice(0, 3).map((line) => seenPct(sow, line))).toEqual([100, 100, 100])
  })

  it('words a bill day\'s expected money', () => {
    const s = initialGcState()
    const move = expectedBills(s, job(s, 'fairoaksd'), 'schedule')[0]
    expect(move ? billDayWords(move) : null).toEqual('Oct 25')
  })

  it('knows a time extension by the moves it names', () => {
    const s = initialGcState()
    expect([isTimeExtension({ ...co, daysOnChart: ['m1'] }), isTimeExtension(co), [...askedMoveIds(job(s, 'fairoaksd'), ['draft', 'sent', 'signed'])]]).toEqual([true, false, []])
  })

  it('drafts the ask for the days the customer\'s moves cost', () => {
    const s = initialGcState()
    expect(pin([openAskMoves(job(s, 'fairoaksd')), timeExtensionAsk(s, job(s, 'fairoaksd'))])).toEqual([[], null])
  })

  it('words a time extension\'s rule and its moves', () => {
    const s = initialGcState()
    const te = { ...co, days: 3, daysOnChart: openAskMoves(job(s, 'fairoaksd')).map((m) => m.id) }
    expect([timeExtensionRule(job(s, 'fairoaksd'), te), timeExtensionLines(s, job(s, 'fairoaksd'), te)]).toEqual([
      '3 days, the days your decision moved the finish.',
      [
        '3 days, the days your decision moved the finish.',
        'Substantial completion moved from Tue Dec 8 to Fri Dec 11.',
      ],
    ])
  })

  it('counts the late-finish days against the contract', () => {
    const s = initialGcState()
    expect(pin(lateFinish(s, job(s, 'fairoaksd')))).toEqual({
      risk: {
              contract: { planned: '2026-12-11', days: 0, on: '2026-12-11' },
              schedule: {
                          on: '2026-12-11',
                          behind: 3,
                          from: 'pace',
                          why: 'The work runs 3 days behind the plan. At that pace it finishes Fri Dec 11.',
                        },
              past: 0,
              perDay: null,
              atRisk: 0,
            },
      late: 0,
      spare: 0,
      customers: 0,
      customerWhy: [],
      perDay: null,
      atRisk: null,
      orders: [],
      money: null,
      split: null,
      orderLines: [],
      words: [],
      customerWords: [],
      asked: [],
      ask: null,
    })
  })

  it('writes our draft pay application into the template\'s cells', () => {
    const s = initialGcState()
    const p = job(s, 'fairoaksd')
    const form = ownerPayAppForm(s, p, 'draft')!
    const parties = ownerPayAppParties(s, p, form)
    expect(pin([payAppCells(form.app, parties), payAppFileName(parties, 'xlsx'), payAppFileName(parties, 'pdf')])).toEqual([
      {
        fields: {
                  g702_n5_project: 'Fair Oaks Shops, Building D · application 4',
                  g702_n6_period_to: 'Oct 25',
                  g702_n9_contract_date: 'Jun 2',
                  g702_d6_owner_name: 'Cibolo Creek Partners',
                  g702_d7_owner_address: '200 Main Plaza, Suite 300',
                  g702_d8_owner_city_state_zip: 'Boerne',
                  g702_d10_contractor_name: 'Click Construction',
                  // The one difference from the prototype: its made-up address stays there, and main's is empty until
          // the owner names our GC entity (call 12).
          g702_d11_contractor_address: '',
                  g702_d12_contractor_license: '',
                  g702_h18_original_contract_sum: 1488762,
                  g702_f49_previous_month_change_order_additions: 0,
                  g702_h49_previous_month_change_order_deductions: 0,
                  g702_f50_this_month_change_order_additions: 0,
                  g702_h50_this_month_change_order_deductions: 0,
                  g702_c28_retainage_percent: 10,
                  g702_c31_retainage_material_percent: 10,
                  g703_k2_project: 'Fair Oaks Shops, Building D · application 4',
                  g703_k3_application_date: '',
                  g703_k4_period_to: 'Oct 25',
                  g703_k5_architect_project_no: 'Marsh & Vale Architects',
                },
        previousCertificates: 860695.12,
        rows: [
                {
                  row: 13,
                  item: '001',
                  description: 'Sitework',
                  scheduled: 205346.48,
                  previous: 205346.48,
                  thisPeriod: 0,
                  stored: 0,
                  retainage: null,
                },
                {
                  row: 14,
                  item: '002',
                  description: 'Concrete',
                  scheduled: 261572.31,
                  previous: 261572.31,
                  thisPeriod: 0,
                  stored: 0,
                  retainage: null,
                },
                {
                  row: 15,
                  item: '003',
                  description: 'Structural steel',
                  scheduled: 227347.89,
                  previous: 209013.39,
                  thisPeriod: 11000.7,
                  stored: 0,
                  retainage: null,
                },
                {
                  row: 16,
                  item: '004',
                  description: 'Electrical',
                  scheduled: 303130.52,
                  previous: 126385.87,
                  thisPeriod: 37402.39,
                  stored: 0,
                  retainage: null,
                },
                {
                  row: 17,
                  item: '005',
                  description: 'Roofing',
                  scheduled: 161343.67,
                  previous: 39113.62,
                  thisPeriod: 34224.41,
                  stored: 0,
                  retainage: null,
                },
                {
                  row: 18,
                  item: '006',
                  description: 'Plumbing',
                  scheduled: 136897.66,
                  previous: 75293.71,
                  thisPeriod: 13689.77,
                  stored: 0,
                  retainage: null,
                },
                {
                  row: 19,
                  item: '007',
                  description: 'HVAC',
                  scheduled: 193123.48,
                  previous: 39602.54,
                  thisPeriod: 13200.85,
                  stored: 0,
                  retainage: null,
                },
              ],
        left: 0,
      },
      'Fair-Oaks-Shops-Building-D-pay-application-4.xlsx',
      'Fair-Oaks-Shops-Building-D-pay-application-4.pdf',
    ])
  })

  it('splits an address at its last comma', () => {
    expect([splitAddress('200 Main Plaza, Suite 300, Boerne'), splitAddress('Boerne')]).toEqual([{ street: '200 Main Plaza, Suite 300', town: 'Boerne' }, { street: 'Boerne', town: '' }])
  })

  it('asks for everything held on the final pay application', () => {
    const s = initialGcState()
    expect(pin(ownerFinalPayAppToSend(s, job(s, 'fairoaksd'), '2026-10-25'))).toEqual({
      number: 4,
      periodTo: '2026-10-25',
      sentOn: '2026-10-25',
      doneToDate: {
                    fsite: 168000,
                    fconc: 214000,
                    fsteel: 180000,
                    felec: 134000,
                    froof: 60000,
                    fplumb: 72800,
                    fhvac: 43200,
                    gc: 68729.06,
                    contingency: 28221.87,
                    fee: 96895.09,
                  },
      worthByLine: {
                     fsite: 168000,
                     fconc: 214000,
                     fsteel: 186000,
                     felec: 248000,
                     froof: 132000,
                     fplumb: 112000,
                     fhvac: 158000,
                     gc: 96000,
                     contingency: 39420,
                     fee: 135342,
                   },
      workToDate: 1065846.03,
      retainagePct: 10,
      retainage: 0,
      due: 205150.91,
      paidOn: null,
      certified: null,
      certifiedOn: null,
      final: true,
    })
  })

  it('reads a change order\'s percent from the office until the trade signs', () => {
    const s = initialGcState()
    expect([changeOrderPct(job(s, 'fairoaksd'), { ...co, pctDone: 40 })]).toEqual([{ pct: 40, fromTrade: false }])
  })
})
