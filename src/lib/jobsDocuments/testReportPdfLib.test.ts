import { describe, expect, it } from 'vitest'
import * as pdfLib from 'pdf-lib'
import { renderTestReportPdfLib } from './testReportPdfLib'
import { DEFAULT_TEST_REPORT_SETTINGS, buildTestReportBlocks, emptyTestReportData, testReportTitle, type TestReportJobInfo } from '../jobs/testReport'

const job: TestReportJobInfo = {
  jobNumber: '1014',
  jobName: 'Johnson Pretest',
  jobAddress: '112 Seidel St, Marion, TX 78124',
  customerName: 'Anna & Jeffrey Johnson',
  customerEmail: 'johnson@example.com',
  customerPhone: '(830) 351-4600',
  customerCompany: 'Done Right Foundation Repair',
}

async function pageCount(bytes: Uint8Array): Promise<{ pages: number; title: string | undefined }> {
  const doc = await pdfLib.PDFDocument.load(bytes)
  return { pages: doc.getPageCount(), title: doc.getTitle() }
}

describe('renderTestReportPdfLib (server-side twin of the jsPDF renderer)', () => {
  it('renders a sewer pre-test PASS on one Letter page with the title set', async () => {
    const data = { ...emptyTestReportData('pre_test', '2026-09-10'), system: 'sewer' as const, result: 'pass' as const, notes: 'PVC. Toilets re-installed.' }
    const blocks = buildTestReportBlocks(data, job, DEFAULT_TEST_REPORT_SETTINGS)
    const bytes = await renderTestReportPdfLib(pdfLib as never, blocks, testReportTitle('pre_test', 'sewer'))
    expect(new TextDecoder().decode(bytes.slice(0, 5))).toBe('%PDF-')
    expect(bytes.length).toBeGreaterThan(2000)
    expect(await pageCount(bytes)).toEqual({ pages: 1, title: 'Sewer Pre-Test Hydrostatic Test Report' })
  })

  it('paginates a long FAIL and renders gas and pinpoint variants', async () => {
    const longFail = {
      ...emptyTestReportData('post_test', '2026-09-10'),
      system: 'supply' as const,
      result: 'fail' as const,
      notes: Array.from({ length: 60 }, (_, i) => `Observation ${i + 1}: the water level dropped again during the interval, measured and photographed for the record.`).join('\n'),
    }
    const fail = await renderTestReportPdfLib(pdfLib as never, buildTestReportBlocks(longFail, job, DEFAULT_TEST_REPORT_SETTINGS), 'Supply Post-Test Hydrostatic Test Report')
    expect((await pageCount(fail)).pages).toBeGreaterThan(1)

    const gas = { ...emptyTestReportData('gas', '2026-09-10'), gasPressurePsi: 0.5, gasFixtures: [{ name: 'Furnace', btuPerHour: 100_000 }, { name: 'Range', btuPerHour: 65_000 }] }
    const gasBytes = await renderTestReportPdfLib(pdfLib as never, buildTestReportBlocks(gas, job, DEFAULT_TEST_REPORT_SETTINGS), 'Gas Test Report')
    expect((await pageCount(gasBytes)).pages).toBe(1)

    const pin = { ...emptyTestReportData('pinpoint', '2026-09-10'), pinpointFindings: 'Break at the second wye, 25 ft from the exterior clean-out.' }
    const pinBytes = await renderTestReportPdfLib(pdfLib as never, buildTestReportBlocks(pin, job, DEFAULT_TEST_REPORT_SETTINGS), 'Pinpoint Test Report')
    expect((await pageCount(pinBytes)).pages).toBe(1)
  })
})
