/** GC mode design spike: one pay application as a file (question 12), read back from what it writes. */
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { gcReducer, initialGcState, ownerPayAppForm, ownerPayAppParties, type GcState } from './gcModel'
import { PAY_APP_FIRST_ROW, payAppCells, payAppFileName, payAppPdf, payAppWorkbook, splitAddress, type PayAppParties } from './gcPayAppFile'

const fairOaks = (state: GcState) => {
  const p = state.projects.find((x) => x.id === 'fairoaksd')
  if (!p) throw new Error('fixture has no fairoaksd')
  return p
}

const parties: PayAppParties = {
  project: 'Fair Oaks Shops, Building D',
  applicationNo: '3',
  periodTo: '2026-09-25',
  sentOn: '2026-09-25',
  contractDate: '2026-06-02',
  to: { name: 'Cibolo Creek Partners', address: '200 Main Plaza, Suite 300, Boerne' },
  from: { name: 'Click Construction', address: '1200 Commerce St, San Antonio' },
  architect: 'Marsh & Vale Architects',
  changeOrders: [
    { amount: 5_000, thisPeriod: false },
    { amount: -1_200, thisPeriod: true },
    { amount: 2_400, thisPeriod: true },
  ],
}

function form(state = initialGcState()) {
  const f = ownerPayAppForm(state, fairOaks(state), 3)
  if (!f) throw new Error('no pay application 3')
  return f
}

// The file tests do real work (exceljs, jspdf): a busy machine gets 20 seconds, not the default 5.
describe('a pay application as the AIA template', () => {
  it('splits an address at its last comma', () => {
    expect(splitAddress('200 Main Plaza, Suite 300, Boerne')).toEqual({ street: '200 Main Plaza, Suite 300', town: 'Boerne' })
    expect(splitAddress('Boerne')).toEqual({ street: 'Boerne', town: '' })
  })

  it('puts the header where the Jobs tab does, and one 703 row per line from row 13', () => {
    const { app } = form()
    const cells = payAppCells(app, parties)
    expect(cells.fields).toMatchObject({
      g702_n5_project: 'Fair Oaks Shops, Building D · application 3',
      g702_d6_owner_name: 'Cibolo Creek Partners',
      g702_d7_owner_address: '200 Main Plaza, Suite 300',
      g702_d8_owner_city_state_zip: 'Boerne',
      g702_h18_original_contract_sum: Math.round(app.summary.originalSum * 100) / 100,
      g702_c28_retainage_percent: 10,
      g702_f49_previous_month_change_order_additions: 5_000,
      g702_f50_this_month_change_order_additions: 2_400,
      g702_h50_this_month_change_order_deductions: 1_200,
    })
    expect(cells.rows.map((r) => r.row)).toEqual(app.lines.map((_, i) => PAY_APP_FIRST_ROW + i))
    expect(cells.rows[0]).toMatchObject({ item: '001', description: app.lines[0]?.label, retainage: null })
    expect(cells.left).toBe(0)
  })

  it('writes each line’s retainage when it is not one percent across the lines', () => {
    let state = gcReducer(initialGcState(), { type: 'setOwnerRetainageStep', projectId: 'fairoaksd', step: { atPct: 50, toPct: 5, way: 'after' } })
    state = gcReducer(state, { type: 'sendOwnerPayApp', projectId: 'fairoaksd' })
    const f = ownerPayAppForm(state, fairOaks(state), 4)
    if (!f) throw new Error('no pay application 4')
    const rows = payAppCells(f.app, { ...parties, applicationNo: '4' }).rows
    expect(rows.every((r) => r.retainage !== null)).toBe(true)
    expect(Math.round(rows.reduce((t, r) => t + (r.retainage ?? 0), 0))).toBe(Math.round(f.app.summary.retainage))
  })

  it('fills the template the Jobs Stages tab uses: our lines, nothing left from its sample', async () => {
    const { app } = form()
    const template = readFileSync('public/templates/aia-g702-g703-mission-hills.xlsx')
    const book = await payAppWorkbook(template.buffer.slice(template.byteOffset, template.byteOffset + template.byteLength), app, parties)
    const ExcelJS = await import('exceljs')
    const wb = new ExcelJS.Workbook()
    await wb.xlsx.load(book)
    const g702 = wb.getWorksheet('Page 1 G702')
    const g703 = wb.getWorksheet('Continuation Sheet G703')
    expect(g702?.getCell('D6').value).toBe('Cibolo Creek Partners')
    expect(g702?.getCell('H40').value).toBe(Math.round(app.summary.previousCertificates * 100) / 100)
    expect(g703?.getCell('C13').value).toBe(app.lines[0]?.label)
    expect(g703?.getCell('D13').value).toBe(Math.round((app.lines[0]?.scheduled ?? 0) * 100) / 100)
    const after = PAY_APP_FIRST_ROW + app.lines.length
    expect([g703?.getCell(`C${after}`).value ?? null, g703?.getCell(`D${after}`).value]).toEqual([null, 0])
  }, 20_000)

  it('draws a PDF of the 702 and the 703', async () => {
    const pdf = await payAppPdf(form().app, parties)
    const head = new TextDecoder().decode(new Uint8Array(pdf).slice(0, 5))
    expect(head).toBe('%PDF-')
    expect(new TextDecoder().decode(new Uint8Array(pdf)).match(/\/Type \/Page\b/g)?.length).toBe(2)
  }, 20_000)

  it('our pay application to the owner: from us, to them, via their architect, with this period’s change orders', () => {
    let state = gcReducer(initialGcState(), { type: 'draftChangeOrder', projectId: 'fairoaksd', description: 'A second drive-through lane', reason: 'owner', schedule: '', packageId: 'fsite', cost: 12_000, price: 0 })
    state = gcReducer(state, { type: 'sendChangeOrder', projectId: 'fairoaksd', changeOrderId: 'co-1' })
    state = gcReducer(state, { type: 'ownerSignChangeOrder', projectId: 'fairoaksd', changeOrderId: 'co-1' })
    const draft = ownerPayAppForm(state, fairOaks(state), 'draft')
    if (!draft) throw new Error('no draft')
    const p = ownerPayAppParties(state, fairOaks(state), draft)
    expect([p.project, p.applicationNo, p.to.name, p.from.name, p.architect]).toEqual([
      'Fair Oaks Shops, Building D',
      '4',
      'Cibolo Creek Partners',
      'Click Construction',
      'Marsh & Vale Architects',
    ])
    expect(p.to.address).not.toBe('')
    expect(p.changeOrders).toEqual([{ amount: 13_200, thisPeriod: true }])
    expect(ownerPayAppParties(state, fairOaks(state), form(state)).changeOrders).toEqual([])
  })

  it('names the file for the project and the application', () => {
    expect(payAppFileName(parties, 'xlsx')).toBe('Fair-Oaks-Shops-Building-D-pay-application-3.xlsx')
    expect(payAppFileName({ ...parties, applicationNo: '4, final' }, 'pdf')).toBe('Fair-Oaks-Shops-Building-D-pay-application-4-final.pdf')
  })
})
