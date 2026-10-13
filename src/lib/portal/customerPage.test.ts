import { describe, expect, it } from 'vitest'
import { customerPageModel, homeMove, parsePortalGcPage, type PortalGcPage } from './customerPage'
import { wordsWith } from './pageWords'
import type { PortalBill, PortalGcJob } from './portalPayload'

// Priya's clinic and Elena's building job, made up, as customer-portal would send them.
const page = (over: Partial<PortalGcPage> = {}): PortalGcPage => ({
  contract: 412000,
  contractSignedOn: '2026-09-19',
  architect: 'Marsh & Vale Architects',
  payDays: 30,
  changes: [
    { id: 'co-1', number: 1, description: 'exam 2 cabinets', descriptionEs: 'gabinetes del consultorio 2', price: 6300, days: 0, state: 'signed', signedOn: '2026-09-28' },
    { id: 'co-2', number: 2, description: 'a sink in exam 3', descriptionEs: 'un lavabo en el consultorio 3', price: 2150, days: 0, state: 'open', signedOn: null },
  ],
  payApps: [],
  week: { on: '2026-10-02', line: 'Permits are in.', lineEs: 'Los permisos están.', photosUrl: null },
  people: [
    { role: 'pm', name: 'Robert' },
    { role: 'super', name: 'Wendi' },
  ],
  moves: [{ activity: 'Parking lot pour', madeOn: '2026-10-01', from: '2026-10-05', to: '2026-10-12', reason: 'weather' }],
  switches: { photos: false, forecast: false, spanish: false },
  ...over,
})
const job = (over: Partial<PortalGcJob> = {}): PortalGcJob => ({ projectId: 'helotes', name: 'Helotes Dental Office', changeOrders: [], canAccept: false, accepted: null, ...over })
const bill = (invoiceId: string, amount: number, paid: { date: string; amount: number }[]): PortalBill => ({
  invoiceId,
  jobLabel: 'Clinic',
  jobNumber: '1',
  jobName: null,
  serviceTag: null,
  jobAddress: null,
  amount,
  billedOn: null,
  payUrl: null,
  checkRef: '',
  asGc: false,
  ownerName: null,
  payments: paid.map((p) => ({ ...p, method: 'Payment' })),
  totalPaid: paid.reduce((a, p) => a + p.amount, 0),
})
const base = { bills: [] as PortalBill[], waivers: [], cardFeePct: 3, company: { name: 'Click Construction', phone: '(210) 555-0100' }, today: '2026-10-02' }

describe("the customer's Your move, from the job's own facts until the flow reads it", () => {
  it('asks them to sign our contract while it waits, with its day', () => {
    const toSign = job({ contract: { state: 'toSign', sendId: 's1', signBy: '2026-10-09', total: 412000, fileName: 'c.pdf', fileUrl: null, retainagePct: 10, retainageStep: null, payDays: 30, lateInterestPctPerMonth: null, lateFinishPerDay: null } })
    expect(homeMove('en', toSign, page({ changes: [] }), '2026-10-02')).toMatchObject({ kind: 'paper', title: 'Sign the contract', due: 'due Fri Oct 9' })
  })

  it('puts the open change order next, with what it adds', () => {
    expect(homeMove('en', job(), page(), '2026-10-02')).toMatchObject({ kind: 'change', title: 'Change order 2 waits on your answer', detail: ['a sink in exam 3', '+$2,150', 'adds no days'] })
    expect(homeMove('es', job(), page(), '2026-10-02')).toMatchObject({ title: 'La orden de cambio 2 espera su respuesta', detail: ['un lavabo en el consultorio 3', '+$2,150', 'no agrega días'] })
  })

  it('offers the work to accept once nothing else waits, and says nothing is owed otherwise', () => {
    expect(homeMove('en', job({ canAccept: true }), page({ changes: [] }), '2026-10-02')).toEqual({
      kind: 'accept',
      title: 'Accept the work',
      sub: 'Every line of the work is billed. Once you walk the job, accept it on Papers.',
      buttons: [{ label: 'Go to Papers', primary: true, press: 'papers' }],
    })
    expect(homeMove('en', job(), page({ changes: [] }), '2026-10-02')).toEqual({ kind: 'none', line: 'Nothing from you today.' })
  })
})

describe('every tab of the page for one job', () => {
  it('draws Home: this week and the people, the office line first', () => {
    const model = customerPageModel('en', { ...base, job: job(), page: page() })
    expect(model.week).toEqual({ title: 'This week · Oct 2', line: 'Permits are in.', photosUrl: null, note: 'Every Friday.' })
    expect(model.people).toEqual([
      { name: 'Click Construction', role: 'office', phone: '(210) 555-0100' },
      { name: 'Robert', role: 'project manager', phone: null },
      { name: 'Wendi', role: 'on site', phone: null },
    ])
    expect(customerPageModel('es', { ...base, job: job(), page: page() }).week?.line).toBe('Los permisos están.')
  })

  it('reads Money from the pay applications and the bills they went on: paid, due once certified, else with the architect', () => {
    const payApps: PortalGcPage['payApps'] = [
      { id: 'pa-1', number: 1, final: false, periodTo: '2026-08-31', sentOn: '2026-09-01', due: 63000, certifiedOn: '2026-09-04', invoiceId: 'inv-1', customerLine: 'Slab and plumbing', customerLineEs: null },
      { id: 'pa-2', number: 2, final: false, periodTo: '2026-09-30', sentOn: '2026-10-01', due: 54000, certifiedOn: null, invoiceId: 'inv-2', customerLine: null, customerLineEs: null },
    ]
    const bills = [bill('inv-1', 63000, [{ date: '2026-09-20', amount: 60000 }, { date: '2026-09-25', amount: 3000 }]), bill('inv-2', 54000, [])]
    const model = customerPageModel('en', { ...base, bills, job: job(), page: page({ payApps }) })
    expect(model.money.header).toMatchObject({ big: '15% built', small: ['$63,000 of $418,300 invested', '1 of 1 paid on time'] })
    expect(model.money.cards.map((c) => [c.kind, 'n' in c ? c.n : null, 'pill' in c ? c.pill : null])).toEqual([
      ['payApp', 2, null],
      ['changes', null, null],
      ['payApp', 1, 'paid Sep 25'],
    ])
    expect(model.money.cards[0]).toMatchObject({ checks: [{ words: 'With your architect, Marsh & Vale Architects, for the certificate since Thu Oct 1.' }, { words: 'Due 30 days after it.' }, { words: 'Nothing to do yet.' }] })
    expect(model.money.statement.rows.map((r) => r.amount)).toEqual(['$412,000', '+$6,300', '$418,300', '$117,000', '$63,000', '$355,300'])
    expect(model.money.payNote).toBe('Pay by bank transfer at no fee, or by card with a 3% fee. The details are on each bill.')
  })

  it('reads an application certified for less as paid once its bill, made for the certificate, is paid in full', () => {
    const payApps: PortalGcPage['payApps'] = [{ id: 'pa-1', number: 1, final: false, periodTo: '2026-08-31', sentOn: '2026-09-01', due: 63000, certifiedOn: '2026-09-04', invoiceId: 'inv-1', customerLine: null, customerLineEs: null }]
    const model = customerPageModel('en', { ...base, bills: [bill('inv-1', 60000, [{ date: '2026-09-25', amount: 60000 }])], job: job(), page: page({ payApps }) })
    expect(model.money.cards.find((c) => c.kind === 'payApp')).toMatchObject({ n: 1, pill: 'paid Sep 25' })
    const partly = customerPageModel('en', { ...base, bills: [bill('inv-1', 60000, [{ date: '2026-09-25', amount: 30000 }])], job: job(), page: page({ payApps }) })
    expect(partly.money.cards.find((c) => c.kind === 'payApp')).toMatchObject({ n: 1, pill: null })
  })

  it('reads a certified, unpaid application as due on its day', () => {
    const payApps: PortalGcPage['payApps'] = [{ id: 'pa-1', number: 1, final: false, periodTo: '2026-09-30', sentOn: '2026-10-01', due: 63000, certifiedOn: '2026-10-06', invoiceId: 'inv-1', customerLine: null, customerLineEs: null }]
    const model = customerPageModel('en', { ...base, bills: [bill('inv-1', 63000, [])], job: job(), page: page({ payApps }) })
    expect(model.money.cards[0]).toMatchObject({ kind: 'payApp', checks: [{ mark: 'done', words: 'Certified by Marsh & Vale Architects, Oct 6.' }, { mark: 'strong', words: 'Due Nov 5.' }] })
  })

  it('reads Papers with the contract signed and the change order waiting, and What moved by its reason', () => {
    const model = customerPageModel('en', { ...base, job: job(), page: page() })
    expect(model.papers.signed.rows.map((r) => r.title)).toEqual(['Our contract', 'Change order 1'])
    expect(model.papers.waiting?.rows.map((r) => r.title)).toEqual(['Change order 2'])
    expect(model.papers.later?.rows.map((r) => r.title)).toEqual(['Pay applications', 'Lien waivers', 'Closeout binder'])
    expect(model.moves).toEqual([{ activity: 'Parking lot pour', when: 'Oct 5 to Oct 12', why: 'weather' }])
    expect(customerPageModel('es', { ...base, job: job(), page: page() }).moves).toEqual([{ activity: 'Parking lot pour', when: 'del 5 oct al 12 oct', why: 'el clima' }])
  })

  it("lays the office's words over every tab", () => {
    const words = wordsWith([{ key: 'roleSuper', en: 'your superintendent', es: 'su superintendente' }])
    expect(customerPageModel('en', { ...base, job: job(), page: page() }, { words }).people[2]).toEqual({ name: 'Wendi', role: 'your superintendent', phone: null })
  })
})

describe('the page block as the page receives it', () => {
  it('reads a whole block and drops a broken one', () => {
    const raw = JSON.parse(JSON.stringify(page()))
    expect(parsePortalGcPage(raw)).toEqual(page())
    expect(parsePortalGcPage({ ...raw, switches: undefined })).toBeNull()
    expect(parsePortalGcPage({ ...raw, payApps: [{ id: 'x', number: 1, periodTo: 'nope', sentOn: '2026-10-01' }] })?.payApps).toEqual([])
  })
})
