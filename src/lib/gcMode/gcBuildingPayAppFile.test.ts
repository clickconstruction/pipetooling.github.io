/**
 * GC mode — design spike: a trade's pay application as a file (question 12). The Owner Billing
 * lane's builder (gcPayAppFile.ts) with the trade's own parties (`tradePayAppParties`): Cool Breeze's
 * pay application 2 on Fair Oaks D, with the rooftop units stored on site, read back from the
 * Excel it writes and checked as a PDF.
 */
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { gcReducer, initialGcState, payApplicationForDraw, tradePayAppParties, type GcState } from './gcModel'
import { PAY_APP_FIRST_ROW, payAppPdf, payAppWorkbook } from './gcPayAppFile'

function coolBreeze() {
  const state: GcState = gcReducer(initialGcState(), {
    type: 'tradeSendPayApp',
    projectId: 'fairoaksd',
    packageId: 'fhvac',
    toPct: { 'fhvac-2': 100 },
    stored: { 'fhvac-1': 36_000 },
    periodTo: '2026-10-02',
    address: '1188 Culebra Rd, San Antonio, TX 78201',
    license: 'TACLA 12345C',
    signedBy: 'Marco Ruiz',
    signedTitle: 'Owner',
  })
  const project = state.projects.find((p) => p.id === 'fairoaksd')
  const sow = project?.packages.find((k) => k.id === 'fhvac')?.sow
  const partner = state.partners.find((p) => p.id === 'coolbreeze')
  const draw = sow?.draws[1]
  if (!project || !sow || !partner || !draw?.payApp) throw new Error('no pay application 2 from Cool Breeze')
  const app = payApplicationForDraw(sow, draw)
  return { app, parties: tradePayAppParties(project, sow, partner, app, { ...draw.payApp, signedOn: draw.payApp.signedOn }) }
}

describe("a trade's pay application as a file (question 12)", () => {
  it('fills the AIA template from the trade to us, the rooftop units stored on site in the stored column', async () => {
    const { app, parties } = coolBreeze()
    expect(parties).toMatchObject({ applicationNo: '2', to: { name: 'Click Construction' }, from: { name: 'Cool Breeze Mechanical', license: 'TACLA 12345C' } })
    const template = readFileSync('public/templates/aia-g702-g703-mission-hills.xlsx')
    const book = await payAppWorkbook(template.buffer.slice(template.byteOffset, template.byteOffset + template.byteLength), app, parties)
    const ExcelJS = await import('exceljs')
    const wb = new ExcelJS.Workbook()
    await wb.xlsx.load(book)
    const g702 = wb.getWorksheet('Page 1 G702')
    const g703 = wb.getWorksheet('Continuation Sheet G703')
    expect(g702?.getCell('D6').value).toBe('Click Construction')
    expect(g702?.getCell('D10').value).toBe('Cool Breeze Mechanical')
    const units = app.lines.findIndex((l) => l.sovId === 'fhvac-1')
    expect(app.lines[units]?.stored).toBe(36_000)
    // The template's column G is the form's F: materials presently stored.
    expect(g703?.getCell(`G${PAY_APP_FIRST_ROW + units}`).value).toBe(36_000)
  })

  it('draws it as a PDF of the 702 and the 703', async () => {
    const { app, parties } = coolBreeze()
    const pdf = new Uint8Array(await payAppPdf(app, parties))
    expect(new TextDecoder().decode(pdf.slice(0, 5))).toBe('%PDF-')
    expect(new TextDecoder().decode(pdf).match(/\/Type \/Page\b/g)?.length).toBe(2)
  })
})
