import { describe, expect, it } from 'vitest'
import {
  DEFAULT_TEST_REPORT_SETTINGS,
  buildTestReportBlocks,
  certificationSignatureBlock,
  emptyTestReportData,
  formatBtu,
  formatTestReportDate,
  formatTestType,
  gasFixturesTotalBtu,
  gasPressureFromPsi,
  gasPressureToPsi,
  inferTestReportDraft,
  parseTestReportSettings,
  resolveTestReportText,
  splitTestReportAddress,
  testReportPdfFilename,
  testReportSendBlockers,
  testReportServiceDescription,
  testReportShortLabel,
  testReportTitle,
  type TestReportData,
  type TestReportJobInfo,
} from './testReport'

const job: TestReportJobInfo = {
  jobNumber: '1014',
  jobName: 'Johnson Pretest',
  jobAddress: '112 Seidel St, Marion, TX 78124',
  customerName: 'Anna & Jeffrey Johnson',
  customerEmail: 'johnson@example.com',
  customerPhone: '(830) 351-4600',
  customerCompany: 'Done Right Foundation Repair',
}

function sewerPass(): TestReportData {
  return { ...emptyTestReportData('pre_test', '2026-09-10'), system: 'sewer', result: 'pass', notes: 'PVC. Toilets re-installed.' }
}

describe('names', () => {
  it('formats the type with the system for hydrostatic tests only', () => {
    expect(formatTestType('pre_test', 'sewer')).toBe('Sewer Pre-Test')
    expect(formatTestType('post_test', 'supply')).toBe('Supply Post-Test')
    expect(formatTestType('post_test', null)).toBe('Post-Test')
    expect(formatTestType('pinpoint', 'sewer')).toBe('Pinpoint Test')
    expect(formatTestType('gas', null)).toBe('Gas Test')
  })

  it('titles the paper the way the external app did', () => {
    expect(testReportTitle('pre_test', 'sewer')).toBe('Sewer Pre-Test Hydrostatic Test Report')
    expect(testReportTitle('post_test', null)).toBe('Post-Test Hydrostatic Test Report')
    expect(testReportTitle('pinpoint', null)).toBe('Pinpoint Test Report')
    expect(testReportTitle('gas', null)).toBe('Gas Test Report')
    expect(testReportShortLabel('pre_test', 'sewer')).toBe('Sewer Pre-Test Hydrostatic')
    expect(testReportShortLabel('gas', null)).toBe('Gas Test')
  })

  it('writes the invoice service description with the street only', () => {
    expect(testReportServiceDescription('pre_test', '112 Seidel St, Marion, TX 78124')).toBe('Preleveling Hydrostatic Test at 112 Seidel St')
    expect(testReportServiceDescription('post_test', '112 Seidel St\nMarion TX')).toBe('Postleveling Hydrostatic Test at 112 Seidel St')
    expect(testReportServiceDescription('pinpoint', '')).toBe('Pinpoint Hydrostatic Test')
    expect(testReportServiceDescription('gas', '4419 Duval Rd')).toBe('Gas Test at 4419 Duval Rd')
  })

  it('splits an address at the newline first, then the first comma', () => {
    expect(splitTestReportAddress('112 Seidel St, Marion, TX 78124')).toEqual({ street: '112 Seidel St', rest: 'Marion, TX 78124' })
    expect(splitTestReportAddress('112 Seidel St\nMarion TX 78124')).toEqual({ street: '112 Seidel St', rest: 'Marion TX 78124' })
    expect(splitTestReportAddress('  ')).toEqual({ street: '', rest: '' })
  })

  it('names the file from the street, the type and the date', () => {
    expect(testReportPdfFilename(job, sewerPass())).toBe('Test-Report-Sewer-Pre-Test-112-Seidel-St-2026-09-10.pdf')
    expect(testReportPdfFilename({ jobNumber: null, jobAddress: '', customerName: 'A & B' }, { testType: 'gas', system: null, testDateYmd: '' })).toBe('Test-Report-Gas-Test-A-B.pdf')
  })

  it('formats a civil date without touching a time zone', () => {
    expect(formatTestReportDate('2026-09-10')).toBe('September 10, 2026')
    expect(formatTestReportDate('2026-01-01')).toBe('January 1, 2026')
    expect(formatTestReportDate('')).toBe('')
    expect(formatTestReportDate('yesterday')).toBe('yesterday')
  })
})

describe('gas', () => {
  it('converts from PSI with the app constants and back', () => {
    expect(gasPressureFromPsi(1)).toEqual({ psi: 1, inWc: 27.68, ozIn2: 16, mmWc: 703 })
    expect(gasPressureFromPsi(0.5)).toEqual({ psi: 0.5, inWc: 13.84, ozIn2: 8, mmWc: 351.5 })
    expect(gasPressureToPsi('inWc', 27.68)).toBeCloseTo(1, 6)
    expect(gasPressureToPsi('ozIn2', 8)).toBeCloseTo(0.5, 6)
    expect(gasPressureToPsi('mmWc', 703)).toBeCloseTo(1, 6)
    expect(gasPressureToPsi('psi', 2)).toBe(2)
  })

  it('totals only positive BTU figures and formats with commas', () => {
    expect(gasFixturesTotalBtu([{ name: 'Furnace', btuPerHour: 100_000 }, { name: 'Range', btuPerHour: null }, { name: '', btuPerHour: -5 }, { name: 'WH', btuPerHour: 40_000 }])).toBe(140_000)
    expect(formatBtu(140_000)).toBe('140,000')
    expect(formatBtu(null)).toBe('—')
    expect(formatBtu(0)).toBe('—')
  })
})

describe('settings and text', () => {
  it('fills missing settings from the defaults and ignores non-strings', () => {
    const s = parseTestReportSettings({ certifierName: 'Someone Else', officePhone: 42, bogus: 'x' })
    expect(s.certifierName).toBe('Someone Else')
    expect(s.officePhone).toBe(DEFAULT_TEST_REPORT_SETTINGS.officePhone)
    expect(parseTestReportSettings(null)).toEqual(DEFAULT_TEST_REPORT_SETTINGS)
    expect(parseTestReportSettings(['nope'])).toEqual(DEFAULT_TEST_REPORT_SETTINGS)
  })

  it('builds the signature block from settings, skipping empty lines', () => {
    expect(certificationSignatureBlock(DEFAULT_TEST_REPORT_SETTINGS)).toBe(
      'Malachi Whites (#RMP41130)\nClick Plumbing\nOffice: (512) 360-0599\nMail: 5501 Balcones Dr A141 Austin TX 78731\nTSBPE: 929 East 41st St Austin TX 78751',
    )
    expect(certificationSignatureBlock({ ...DEFAULT_TEST_REPORT_SETTINGS, certifierLicense: '', mailingAddress: '', tsbpeAddress: '' })).toBe(
      'Malachi Whites\nClick Plumbing\nOffice: (512) 360-0599',
    )
  })

  it('resolves the system text and conclusion from the system and result, honoring overrides', () => {
    const t = resolveTestReportText(sewerPass(), DEFAULT_TEST_REPORT_SETTINGS)
    expect(t.systemTested).toBe(DEFAULT_TEST_REPORT_SETTINGS.systemTestedSewer)
    expect(t.conclusion).toBe(DEFAULT_TEST_REPORT_SETTINGS.passConclusionSewer)
    expect(t.certification.startsWith(DEFAULT_TEST_REPORT_SETTINGS.certificationHydrostatic)).toBe(true)
    expect(t.certification.endsWith('TSBPE: 929 East 41st St Austin TX 78751')).toBe(true)

    const supplyFail = { ...sewerPass(), system: 'supply' as const, result: 'fail' as const, conclusion: '  ', testMethod: 'Air test at 5 PSI.' }
    const u = resolveTestReportText(supplyFail, DEFAULT_TEST_REPORT_SETTINGS)
    expect(u.systemTested).toBe(DEFAULT_TEST_REPORT_SETTINGS.systemTestedSupply)
    expect(u.conclusion).toBe(DEFAULT_TEST_REPORT_SETTINGS.failConclusionSupply)
    expect(u.testMethod).toBe('Air test at 5 PSI.')

    expect(resolveTestReportText({ ...sewerPass(), result: null }, DEFAULT_TEST_REPORT_SETTINGS).conclusion).toBe('')
    expect(resolveTestReportText({ ...emptyTestReportData('pinpoint', '2026-09-10') }, DEFAULT_TEST_REPORT_SETTINGS).certification.startsWith(DEFAULT_TEST_REPORT_SETTINGS.certificationPinpoint)).toBe(true)
    expect(resolveTestReportText({ ...emptyTestReportData('gas', '2026-09-10') }, DEFAULT_TEST_REPORT_SETTINGS).certification.startsWith(DEFAULT_TEST_REPORT_SETTINGS.certificationGas)).toBe(true)
  })
})

describe('blocks', () => {
  it('lays out a sewer pre-test pass: letterhead, columns, details, verdict, conclusion, notes, certification', () => {
    const blocks = buildTestReportBlocks(sewerPass(), job, DEFAULT_TEST_REPORT_SETTINGS)
    expect(blocks.map((b) => b.kind)).toEqual(['letterhead', 'columns', 'section', 'kv', 'section', 'verdict', 'paragraph', 'paragraph', 'section', 'certification'])
    const lh = blocks[0]
    if (lh?.kind !== 'letterhead') throw new Error('letterhead')
    expect(lh.title).toBe('Sewer Pre-Test Hydrostatic Test Report')
    expect(lh.dateLabel).toBe('September 10, 2026')
    expect(lh.jobLabel).toBe('Job 1014')
    const cols = blocks[1]
    if (cols?.kind !== 'columns') throw new Error('columns')
    expect(cols.left.rows.map((r) => r.label)).toEqual(['Name', 'Phone', 'Email', 'Company'])
    expect(cols.right.lines).toEqual(['112 Seidel St', 'Marion, TX 78124'])
    expect(cols.right.rows).toEqual([]) // the date sits in Test details for hydrostatic tests
    const kv = blocks[3]
    if (kv?.kind !== 'kv') throw new Error('kv')
    expect(kv.rows.map((r) => r.label)).toEqual(['Type', 'Date', 'System tested', 'Test method', 'Test pressure', 'Duration'])
    expect(kv.rows[5]?.value).toBe('60 minutes')
    const verdict = blocks[5]
    if (verdict?.kind !== 'verdict') throw new Error('verdict')
    expect(verdict.result).toBe('pass')
    expect(verdict.text).toBe('No leaks or pressure loss detected')
  })

  it('omits what is empty: no phone, no company, no notes, no verdict yet', () => {
    const blocks = buildTestReportBlocks(
      { ...sewerPass(), result: null, notes: '' },
      { ...job, customerPhone: null, customerCompany: '', customerEmail: null, jobNumber: null },
      DEFAULT_TEST_REPORT_SETTINGS,
    )
    expect(blocks.map((b) => b.kind)).toEqual(['letterhead', 'columns', 'section', 'kv', 'section', 'section', 'certification'])
    const cols = blocks[1]
    if (cols?.kind !== 'columns') throw new Error('columns')
    expect(cols.left.rows).toEqual([{ label: 'Name', value: 'Anna & Jeffrey Johnson' }])
    const lh = blocks[0]
    if (lh?.kind !== 'letterhead') throw new Error('letterhead')
    expect(lh.jobLabel).toBeNull()
  })

  it('moves the date under the location for pinpoint and gas, and shows N/A for empty pinpoint fields', () => {
    const blocks = buildTestReportBlocks({ ...emptyTestReportData('pinpoint', '2026-09-10'), pinpointFindings: 'Break at the second wye.' }, job, DEFAULT_TEST_REPORT_SETTINGS)
    expect(blocks.map((b) => b.kind)).toEqual(['letterhead', 'columns', 'section', 'kv', 'paragraph', 'section', 'certification'])
    const cols = blocks[1]
    if (cols?.kind !== 'columns') throw new Error('columns')
    expect(cols.right.rows).toEqual([{ label: 'Date', value: 'September 10, 2026' }])
    const kv = blocks[3]
    if (kv?.kind !== 'kv') throw new Error('kv')
    expect(kv.rows).toEqual([
      { label: 'Pinpoint location', value: 'N/A' },
      { label: 'Test method', value: DEFAULT_TEST_REPORT_SETTINGS.pinpointMethodDefault },
    ])
  })

  it('shows the gas sections only when they carry data, and totals the fixtures', () => {
    const none = buildTestReportBlocks(emptyTestReportData('gas', '2026-09-10'), job, DEFAULT_TEST_REPORT_SETTINGS)
    expect(none.map((b) => b.kind)).toEqual(['letterhead', 'columns', 'section', 'certification'])
    const full = buildTestReportBlocks(
      { ...emptyTestReportData('gas', '2026-09-10'), gasPressurePsi: 0.5, gasFixtures: [{ name: 'Furnace', btuPerHour: 100_000 }, { name: '', btuPerHour: null }, { name: 'Range', btuPerHour: 65_000 }] },
      job,
      DEFAULT_TEST_REPORT_SETTINGS,
    )
    expect(full.map((b) => b.kind)).toEqual(['letterhead', 'columns', 'section', 'kv', 'section', 'kv', 'section', 'certification'])
    const utilities = full[5]
    if (utilities?.kind !== 'kv') throw new Error('kv')
    expect(utilities.rows).toEqual([
      { label: 'Furnace', value: '100,000 BTU/hr' },
      { label: 'Range', value: '65,000 BTU/hr' },
      { label: 'Total', value: '165,000 BTU/hr' },
    ])
    const pressure = full[3]
    if (pressure?.kind !== 'kv') throw new Error('kv')
    expect(pressure.rows.map((r) => r.value)).toEqual(['0.5', '13.84', '8', '351.5'])
  })
})

describe('send blockers', () => {
  it('lists what is missing in order and is empty when ready', () => {
    expect(testReportSendBlockers(sewerPass(), { toEmail: 'gc@example.com', hasPayLink: true })).toEqual([])
    expect(testReportSendBlockers({ ...sewerPass(), result: null, system: null, testDateYmd: '' }, { toEmail: '', hasPayLink: false, requirePayLink: true })).toEqual([
      'Pick the test date.',
      'Pick Supply or Sewer.',
      'Pick PASS or FAIL.',
      'Add an email for the customer or the GC.',
      'Bill first — this job has no Stripe invoice to link.',
    ])
    expect(testReportSendBlockers(sewerPass(), { toEmail: 'not-an-email', hasPayLink: true })).toEqual(['"not-an-email" is not a valid email.'])
  })

  it('asks pinpoint for findings and gas for pressure or a fixture', () => {
    expect(testReportSendBlockers(emptyTestReportData('pinpoint', '2026-09-10'), { toEmail: 'a@b.co', hasPayLink: false })).toEqual(['Write the pinpoint findings.'])
    expect(testReportSendBlockers(emptyTestReportData('gas', '2026-09-10'), { toEmail: 'a@b.co', hasPayLink: false })).toEqual(['Enter a house pressure or at least one fixture.'])
    expect(testReportSendBlockers({ ...emptyTestReportData('gas', '2026-09-10'), gasFixtures: [{ name: 'Furnace', btuPerHour: null }] }, { toEmail: 'a@b.co', hasPayLink: false })).toEqual([])
  })
})

describe('draft from the field report', () => {
  it('reads the type from the job name and the verdict from the tech wording', () => {
    expect(inferTestReportDraft('Johnson Pretest', 'Hydrostatic test passed.')).toEqual({ testType: 'pre_test', result: 'pass', reason: 'Pre-Test from the job name, PASS from the report' })
    expect(inferTestReportDraft('Montolongo Post Test', 'Test passed ,no hydrostatic loss detected')).toMatchObject({ testType: 'post_test', result: 'pass' })
    expect(inferTestReportDraft('Diagnostic (Residential) Hydrostatic Test POST', 'No hydrostatic loss detected. Test passed')).toMatchObject({ testType: 'post_test', result: 'pass' })
    expect(inferTestReportDraft('Diagnostic (Residential) Hydrostatic Test PRE', 'Failed - lost 2 inches of water')).toMatchObject({ testType: 'pre_test', result: 'fail' })
    expect(inferTestReportDraft('Scarbrough Pretest', 'Hydrostatic- passed')).toMatchObject({ testType: 'pre_test', result: 'pass' })
  })

  it('leaves the verdict open when the wording does not say, and never guesses on ordinary jobs', () => {
    expect(inferTestReportDraft('Vasquez Pretest', 'Set up the test, waiting on the 60 minutes')).toEqual({ testType: 'pre_test', result: null, reason: 'Pre-Test from the job name' })
    expect(inferTestReportDraft('Peterson Pinpoint', 'Break at the second wye')).toMatchObject({ testType: 'pinpoint', result: null })
    expect(inferTestReportDraft('Salinas Gas Test', 'Held at 8 oz')).toMatchObject({ testType: 'gas', result: null })
    expect(inferTestReportDraft('Take 5 Seguin', 'Rough-in complete, passed inspection')).toBeNull()
    expect(inferTestReportDraft('Office', 'Walmart and office')).toBeNull()
  })

  it('does not mistake "no leaks" for a failure', () => {
    expect(inferTestReportDraft('Malik Pretest', 'No leaks detected, did not lose any water')).toMatchObject({ result: 'pass' })
    expect(inferTestReportDraft('Malik Pretest', 'Leaks detected under the slab')).toMatchObject({ result: 'fail' })
  })
})
