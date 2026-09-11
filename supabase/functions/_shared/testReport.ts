/**
 * Test reports (v2.3296) — the hydrostatic / pinpoint / gas test report that
 * used to be built on plumbingtooling.com, as a pure kernel. Dependency-free
 * on purpose: the browser (modal, jsPDF renderer) imports it through
 * `src/lib/jobs/testReport.ts`, the edge functions (send, portal) import it
 * directly, and vitest tests it from `src/lib/jobs/testReport.test.ts`.
 *
 * What lives here: the four test types and their titles, the text defaults
 * the external app hard-coded (system tested, method, pressure, pass / fail
 * conclusions, the certification per type), the gas pressure conversions and
 * BTU total, the paper as a block model (one source for the PDF and the HTML
 * preview), the send blockers, and the draft-from-field-report inference.
 * What does not: dates from the clock, Supabase, jsPDF.
 */

export type TestReportType = 'pre_test' | 'post_test' | 'pinpoint' | 'gas'
export type TestReportSystem = 'supply' | 'sewer'
export type TestReportResult = 'pass' | 'fail'

export const TEST_REPORT_TYPES: readonly TestReportType[] = ['pre_test', 'post_test', 'pinpoint', 'gas']
export const TEST_REPORT_DURATION_CHOICES: readonly number[] = [20, 40, 60]
export const TEST_REPORT_DEFAULT_DURATION_MIN = 60

export type GasFixture = { name: string; btuPerHour: number | null }

/** The report's own fields — everything the office types or the field report supplies. */
export type TestReportData = {
  testType: TestReportType
  /** Pre / post tests only. */
  system: TestReportSystem | null
  /** Pre / post tests only; pinpoint and gas carry no verdict. */
  result: TestReportResult | null
  /** YYYY-MM-DD in the company calendar. */
  testDateYmd: string
  durationMinutes: number | null
  notes: string
  pinpointLocation: string
  pinpointMethod: string
  pinpointFindings: string
  /** PSI is the base unit; the other three are derived for display. */
  gasPressurePsi: number | null
  gasFixtures: GasFixture[]
  /** Per-report overrides of the settings text; null = the default. */
  systemTested: string | null
  testMethod: string | null
  testPressure: string | null
  conclusion: string | null
}

/** What the job already knows — never typed again. */
export type TestReportJobInfo = {
  jobNumber: string | null
  jobName: string
  jobAddress: string
  customerName: string
  customerEmail: string | null
  customerPhone: string | null
  /** The GC / company that ordered the test (the payer), when known. */
  customerCompany: string | null
}

/** Company-wide text, editable in Settings; seeded from the external app's literals. */
export type TestReportSettings = {
  companyName: string
  /** Second line under the company name on the paper (e.g. "Plumbing, Electrical, and HVAC"). */
  companyTagline: string
  officePhone: string
  mailingAddress: string
  tsbpeAddress: string
  certifierName: string
  /** e.g. "#RMP41130" — printed after the name exactly as written. */
  certifierLicense: string
  systemTestedSupply: string
  systemTestedSewer: string
  testMethod: string
  testPressure: string
  passConclusionSupply: string
  passConclusionSewer: string
  failConclusionSupply: string
  failConclusionSewer: string
  pinpointMethodDefault: string
  certificationHydrostatic: string
  certificationPinpoint: string
  certificationGas: string
  /** The Send email's body; placeholders {report} {address} {payLink} {company} {phone} (v2.3301). */
  emailBodyTemplate: string
  /** Comma-separated addresses copied on every report email — the "cc Malachi" of the hand-written send (v2.3301). */
  emailCc: string
}

export const DEFAULT_TEST_REPORT_SETTINGS: TestReportSettings = {
  companyName: 'Click Plumbing',
  companyTagline: 'Plumbing, Electrical, and HVAC',
  officePhone: '(512) 360-0599',
  mailingAddress: '5501 Balcones Dr A141 Austin TX 78731',
  tsbpeAddress: '929 East 41st St Austin TX 78751',
  certifierName: 'Malachi Whites',
  certifierLicense: '#RMP41130',
  systemTestedSupply: 'Water supply lines and associated components.',
  systemTestedSewer: 'Underground sewer lines and associated components.',
  testMethod: 'Water column test with no applied pressure.',
  testPressure: '10 feet of head pressure',
  passConclusionSupply:
    'The system is functioning properly at this time. The consistency in water levels throughout the duration of the test indicates the absence of leaks in the supply lines.',
  passConclusionSewer:
    'The system is functioning properly at this time. The consistency in water levels throughout the duration of the test indicates the absence of leaks in the sewer lines.',
  failConclusionSupply:
    'The system is not functioning properly at this time. The change in water levels throughout the duration of the test indicates leaks in the supply lines.',
  failConclusionSewer:
    'The system is not functioning properly at this time. The change in water levels throughout the duration of the test indicates leaks in the sewer lines.',
  pinpointMethodDefault: 'Camera / test ball / hydrostatic isolation testing',
  certificationHydrostatic:
    'I hereby certify that the Hydrostatic Test was performed according to industry standards and local code requirements. All reports only represent measurements taken at this time.',
  certificationPinpoint:
    "I hereby certify that the Pinpoint Test was performed according to industry standards and local code requirements. Click Plumbing's scope is limited to the plumbing system. Any opinions regarding the effect of leaks on foundation performance or structural settlement are deferred to the contracting group. All reports only represent measurements taken at this time.",
  certificationGas:
    'I hereby certify that the Gas Test was performed according to industry standards and local code requirements. All reports only represent measurements taken at this time.',
  emailBodyTemplate:
    'Attached is the {report} report for {address} and below is the invoice link. Please let us know if you have any questions.\n\n{payLink}\n\n— {company} · {phone}',
  emailCc: '',
}

/** "a@x.com, b@y.com" → ['a@x.com', 'b@y.com'] — valid, trimmed, deduped, lower-cased. */
export function parseEmailList(raw: string): string[] {
  const out: string[] = []
  for (const part of (raw ?? '').split(/[,;\s]+/)) {
    const e = part.trim().toLowerCase()
    if (!e || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e) || out.includes(e)) continue
    out.push(e)
  }
  return out
}

/** Settings from storage may be partial or older; every field falls back to the default. */
export function parseTestReportSettings(raw: unknown): TestReportSettings {
  const out: TestReportSettings = { ...DEFAULT_TEST_REPORT_SETTINGS }
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return out
  const r = raw as Record<string, unknown>
  for (const key of Object.keys(out) as Array<keyof TestReportSettings>) {
    const v = r[key]
    if (typeof v === 'string') out[key] = v
  }
  return out
}

export function emptyTestReportData(testType: TestReportType = 'pre_test', testDateYmd = ''): TestReportData {
  return {
    testType,
    system: testType === 'pre_test' || testType === 'post_test' ? 'sewer' : null,
    result: null,
    testDateYmd,
    durationMinutes: testType === 'pre_test' || testType === 'post_test' ? TEST_REPORT_DEFAULT_DURATION_MIN : null,
    notes: '',
    pinpointLocation: '',
    pinpointMethod: '',
    pinpointFindings: '',
    gasPressurePsi: null,
    gasFixtures: [],
    systemTested: null,
    testMethod: null,
    testPressure: null,
    conclusion: null,
  }
}

export function isHydrostaticType(t: TestReportType): boolean {
  return t === 'pre_test' || t === 'post_test'
}

// ---------------------------------------------------------------------------
// Names
// ---------------------------------------------------------------------------

const TYPE_LABEL: Record<TestReportType, string> = {
  pre_test: 'Pre-Test',
  post_test: 'Post-Test',
  pinpoint: 'Pinpoint Test',
  gas: 'Gas Test',
}

const SYSTEM_LABEL: Record<TestReportSystem, string> = { supply: 'Supply', sewer: 'Sewer' }

/** "Sewer Pre-Test" · "Post-Test" (no system yet) · "Pinpoint Test" · "Gas Test". */
export function formatTestType(testType: TestReportType, system: TestReportSystem | null): string {
  const base = TYPE_LABEL[testType]
  if (isHydrostaticType(testType) && system) return `${SYSTEM_LABEL[system]} ${base}`
  return base
}

/** The paper's heading: "Sewer Pre-Test Hydrostatic Test Report" · "Pinpoint Test Report" · "Gas Test Report". */
export function testReportTitle(testType: TestReportType, system: TestReportSystem | null): string {
  if (testType === 'pinpoint') return 'Pinpoint Test Report'
  if (testType === 'gas') return 'Gas Test Report'
  return `${formatTestType(testType, system)} Hydrostatic Test Report`
}

/** Short form for chips and activity lines: "Sewer Pre-Test Hydrostatic" · "Pinpoint Test" · "Gas Test". */
export function testReportShortLabel(testType: TestReportType, system: TestReportSystem | null): string {
  if (isHydrostaticType(testType)) return `${formatTestType(testType, system)} Hydrostatic`
  return formatTestType(testType, system)
}

/** The invoice line / Stripe memo the external app's invoice generator wrote: "Preleveling Hydrostatic Test at 112 Seidel St". */
export function testReportServiceDescription(testType: TestReportType, address: string): string {
  const street = firstAddressLine(address)
  const at = street ? ` at ${street}` : ''
  switch (testType) {
    case 'pre_test':
      return `Preleveling Hydrostatic Test${at}`
    case 'post_test':
      return `Postleveling Hydrostatic Test${at}`
    case 'pinpoint':
      return `Pinpoint Hydrostatic Test${at}`
    case 'gas':
      return `Gas Test${at}`
  }
}

export function testReportPdfFilename(job: Pick<TestReportJobInfo, 'jobNumber' | 'jobAddress' | 'customerName'>, data: Pick<TestReportData, 'testType' | 'system' | 'testDateYmd'>): string {
  const who = (firstAddressLine(job.jobAddress) || job.customerName || job.jobNumber || 'job').replace(/[^A-Za-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
  const kind = formatTestType(data.testType, data.system).replace(/[^A-Za-z0-9]+/g, '-')
  const date = data.testDateYmd.replace(/[^0-9]/g, '-')
  return `Test-Report-${kind}-${who}${date ? `-${date}` : ''}.pdf`
}

/** "112 Seidel St, Marion, TX 78124" → ["112 Seidel St", "Marion, TX 78124"]; newlines split first, then the first comma. */
export function splitTestReportAddress(address: string): { street: string; rest: string } {
  const lines = address
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
  if (lines.length > 1) return { street: lines[0] ?? '', rest: lines.slice(1).join(' ') }
  const one = lines[0] ?? ''
  const comma = one.indexOf(',')
  if (comma === -1) return { street: one, rest: '' }
  return { street: one.slice(0, comma).trim(), rest: one.slice(comma + 1).trim() }
}

function firstAddressLine(address: string): string {
  return splitTestReportAddress(address ?? '').street
}

// ---------------------------------------------------------------------------
// Gas
// ---------------------------------------------------------------------------

/** PSI is the base: 1 PSI = 27.68 in WC = 16 oz/in² = 703 mm WC (the external app's constants). */
export const GAS_IN_WC_PER_PSI = 27.68
export const GAS_OZ_PER_PSI = 16
export const GAS_MM_WC_PER_PSI = 703

export type GasPressureUnit = 'psi' | 'inWc' | 'ozIn2' | 'mmWc'
export type GasPressure = { psi: number; inWc: number; ozIn2: number; mmWc: number }

function round(n: number, places: number): number {
  const f = 10 ** places
  return Math.round(n * f) / f
}

export function gasPressureFromPsi(psi: number): GasPressure {
  return {
    psi: round(psi, 3),
    inWc: round(psi * GAS_IN_WC_PER_PSI, 2),
    ozIn2: round(psi * GAS_OZ_PER_PSI, 2),
    mmWc: round(psi * GAS_MM_WC_PER_PSI, 1),
  }
}

export function gasPressureToPsi(unit: GasPressureUnit, value: number): number {
  switch (unit) {
    case 'psi':
      return value
    case 'inWc':
      return value / GAS_IN_WC_PER_PSI
    case 'ozIn2':
      return value / GAS_OZ_PER_PSI
    case 'mmWc':
      return value / GAS_MM_WC_PER_PSI
  }
}

export const GAS_FIXTURE_QUICK_PICKS: readonly string[] = ['Furnace', 'Water Heater', 'Gas Range', 'Dryer', 'Fireplace', 'Grill', 'Pool Heater']

export function gasFixturesTotalBtu(fixtures: readonly GasFixture[]): number {
  let total = 0
  for (const f of fixtures) {
    if (typeof f.btuPerHour === 'number' && Number.isFinite(f.btuPerHour) && f.btuPerHour > 0) total += f.btuPerHour
  }
  return total
}

/** "100,000" — the paper's number format; null / 0 → "—". */
export function formatBtu(n: number | null): string {
  if (n == null || !Number.isFinite(n) || n <= 0) return '—'
  return Math.round(n).toLocaleString('en-US')
}

/** A fixture row counts when it has a name or a positive BTU figure. */
export function gasFixturesForPaper(fixtures: readonly GasFixture[]): GasFixture[] {
  return fixtures.filter((f) => (f.name ?? '').trim() !== '' || (typeof f.btuPerHour === 'number' && f.btuPerHour > 0))
}

// ---------------------------------------------------------------------------
// Resolved text
// ---------------------------------------------------------------------------

export type TestReportResolvedText = {
  systemTested: string
  testMethod: string
  testPressure: string
  conclusion: string
  /** The certification body for the type, then the signature block, joined by a blank line. */
  certification: string
}

export function certificationSignatureBlock(s: TestReportSettings): string {
  const who = [s.certifierName.trim(), s.certifierLicense.trim() ? `(${s.certifierLicense.trim()})` : ''].filter(Boolean).join(' ')
  const lines = [
    who,
    s.companyName.trim(),
    s.officePhone.trim() ? `Office: ${s.officePhone.trim()}` : '',
    s.mailingAddress.trim() ? `Mail: ${s.mailingAddress.trim()}` : '',
    s.tsbpeAddress.trim() ? `TSBPE: ${s.tsbpeAddress.trim()}` : '',
  ]
  return lines.filter(Boolean).join('\n')
}

export function resolveTestReportText(data: TestReportData, s: TestReportSettings): TestReportResolvedText {
  const sys = data.system ?? 'sewer'
  const systemTested = pick(data.systemTested, sys === 'supply' ? s.systemTestedSupply : s.systemTestedSewer)
  const testMethod = pick(data.testMethod, s.testMethod)
  const testPressure = pick(data.testPressure, s.testPressure)
  const defaultConclusion =
    data.result === 'pass'
      ? sys === 'supply'
        ? s.passConclusionSupply
        : s.passConclusionSewer
      : data.result === 'fail'
        ? sys === 'supply'
          ? s.failConclusionSupply
          : s.failConclusionSewer
        : ''
  const conclusion = pick(data.conclusion, defaultConclusion)
  const body = data.testType === 'pinpoint' ? s.certificationPinpoint : data.testType === 'gas' ? s.certificationGas : s.certificationHydrostatic
  const certification = [body.trim(), certificationSignatureBlock(s)].filter(Boolean).join('\n\n')
  return { systemTested, testMethod, testPressure, conclusion, certification }
}

function pick(override: string | null, fallback: string): string {
  const o = (override ?? '').trim()
  return o || fallback
}

// ---------------------------------------------------------------------------
// The paper as blocks — one model for the PDF and the HTML preview
// ---------------------------------------------------------------------------

export type TestReportBlock =
  | { kind: 'letterhead'; companyName: string; tagline: string; title: string; dateLabel: string; jobLabel: string | null }
  | { kind: 'columns'; left: TestReportColumn; right: TestReportColumn }
  | { kind: 'section'; text: string }
  | { kind: 'kv'; rows: Array<{ label: string; value: string }> }
  | { kind: 'verdict'; result: TestReportResult; text: string }
  | { kind: 'paragraph'; text: string; label?: string }
  | { kind: 'certification'; text: string }

export type TestReportColumn = { heading: string; rows: Array<{ label: string; value: string }>; lines?: string[] }

/** "September 10, 2026" from a YYYY-MM-DD, without touching the clock or a time zone. */
export function formatTestReportDate(ymd: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec((ymd ?? '').trim())
  if (!m) return (ymd ?? '').trim()
  const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
  const month = months[Number(m[2]) - 1]
  if (!month) return ymd
  return `${month} ${Number(m[3])}, ${m[1]}`
}

export const VERDICT_LINE: Record<TestReportResult, string> = {
  pass: 'No leaks or pressure loss detected',
  fail: 'Leaks or pressure loss detected',
}

export function buildTestReportBlocks(data: TestReportData, job: TestReportJobInfo, settings: TestReportSettings): TestReportBlock[] {
  const text = resolveTestReportText(data, settings)
  const addr = splitTestReportAddress(job.jobAddress ?? '')
  const blocks: TestReportBlock[] = []
  const jobLabel = job.jobNumber?.trim() ? `Job ${job.jobNumber.trim()}` : null
  blocks.push({
    kind: 'letterhead',
    companyName: settings.companyName,
    tagline: settings.companyTagline,
    title: testReportTitle(data.testType, data.system),
    dateLabel: formatTestReportDate(data.testDateYmd),
    jobLabel,
  })

  const customerRows: Array<{ label: string; value: string }> = [{ label: 'Name', value: job.customerName || '—' }]
  if ((job.customerPhone ?? '').trim()) customerRows.push({ label: 'Phone', value: job.customerPhone!.trim() })
  if ((job.customerEmail ?? '').trim()) customerRows.push({ label: 'Email', value: job.customerEmail!.trim() })
  if ((job.customerCompany ?? '').trim()) customerRows.push({ label: 'Company', value: job.customerCompany!.trim() })
  const locationLines = [addr.street, addr.rest].filter(Boolean)
  const locationRows: Array<{ label: string; value: string }> = []
  if (!isHydrostaticType(data.testType)) locationRows.push({ label: 'Date', value: formatTestReportDate(data.testDateYmd) })
  blocks.push({
    kind: 'columns',
    left: { heading: 'Customer', rows: customerRows },
    right: { heading: 'Test location', rows: locationRows, lines: locationLines.length ? locationLines : ['—'] },
  })

  if (isHydrostaticType(data.testType)) {
    blocks.push({ kind: 'section', text: 'Test details' })
    blocks.push({
      kind: 'kv',
      rows: [
        { label: 'Type', value: formatTestType(data.testType, data.system) },
        { label: 'Date', value: formatTestReportDate(data.testDateYmd) },
        { label: 'System tested', value: text.systemTested },
        { label: 'Test method', value: text.testMethod },
        { label: 'Test pressure', value: text.testPressure },
        ...(data.durationMinutes != null ? [{ label: 'Duration', value: `${data.durationMinutes} minutes` }] : []),
      ],
    })
    blocks.push({ kind: 'section', text: 'Test results' })
    if (data.result) blocks.push({ kind: 'verdict', result: data.result, text: VERDICT_LINE[data.result] })
    if (text.conclusion) blocks.push({ kind: 'paragraph', label: 'Conclusion', text: text.conclusion })
    if (data.notes.trim()) blocks.push({ kind: 'paragraph', label: 'Notes', text: data.notes.trim() })
  } else if (data.testType === 'pinpoint') {
    blocks.push({ kind: 'section', text: 'Test results' })
    blocks.push({
      kind: 'kv',
      rows: [
        { label: 'Pinpoint location', value: data.pinpointLocation.trim() || 'N/A' },
        { label: 'Test method', value: data.pinpointMethod.trim() || settings.pinpointMethodDefault || 'N/A' },
      ],
    })
    blocks.push({ kind: 'paragraph', label: 'Findings', text: data.pinpointFindings.trim() || 'N/A' })
    if (data.notes.trim()) blocks.push({ kind: 'paragraph', label: 'Notes', text: data.notes.trim() })
  } else {
    const pressure = data.gasPressurePsi != null && data.gasPressurePsi > 0 ? gasPressureFromPsi(data.gasPressurePsi) : null
    const fixtures = gasFixturesForPaper(data.gasFixtures)
    if (pressure) {
      blocks.push({ kind: 'section', text: 'House pressure' })
      blocks.push({
        kind: 'kv',
        rows: [
          { label: 'PSI', value: String(pressure.psi) },
          { label: 'in WC', value: String(pressure.inWc) },
          { label: 'oz/in²', value: String(pressure.ozIn2) },
          { label: 'mm WC', value: String(pressure.mmWc) },
        ],
      })
    }
    if (fixtures.length) {
      blocks.push({ kind: 'section', text: 'House utilities' })
      blocks.push({
        kind: 'kv',
        rows: [
          ...fixtures.map((f) => ({ label: f.name.trim() || '—', value: `${formatBtu(f.btuPerHour)} BTU/hr` })),
          { label: 'Total', value: `${formatBtu(gasFixturesTotalBtu(fixtures))} BTU/hr` },
        ],
      })
    }
    if (data.notes.trim()) blocks.push({ kind: 'paragraph', label: 'Notes', text: data.notes.trim() })
  }

  blocks.push({ kind: 'section', text: 'Certification' })
  blocks.push({ kind: 'certification', text: text.certification })
  return blocks
}

// ---------------------------------------------------------------------------
// Completeness and sending
// ---------------------------------------------------------------------------

/** What stops a report from being sent, in the order the modal shows them. Empty = ready. */
export function testReportSendBlockers(
  data: TestReportData,
  ctx: { toEmail: string | null; hasPayLink: boolean; requirePayLink?: boolean },
): string[] {
  const out: string[] = []
  if (!/^\d{4}-\d{2}-\d{2}$/.test(data.testDateYmd)) out.push('Pick the test date.')
  if (isHydrostaticType(data.testType)) {
    if (!data.system) out.push('Pick Supply or Sewer.')
    if (!data.result) out.push('Pick PASS or FAIL.')
  } else if (data.testType === 'pinpoint') {
    if (!data.pinpointFindings.trim()) out.push('Write the pinpoint findings.')
  } else if (data.testType === 'gas') {
    const hasPressure = data.gasPressurePsi != null && data.gasPressurePsi > 0
    if (!hasPressure && gasFixturesForPaper(data.gasFixtures).length === 0) out.push('Enter a house pressure or at least one fixture.')
  }
  const email = (ctx.toEmail ?? '').trim()
  if (!email) out.push('Add an email for the customer or the GC.')
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) out.push(`"${email}" is not a valid email.`)
  if (ctx.requirePayLink && !ctx.hasPayLink) out.push('Bill first — this job has no Stripe invoice to link.')
  return out
}

// ---------------------------------------------------------------------------
// Drafting from the field report (dial A)
// ---------------------------------------------------------------------------

export type TestReportDraftHint = {
  testType: TestReportType
  result: TestReportResult | null
  /** Why the kernel thinks so — shown to the office as "from Abraham's report". */
  reason: string
}

/**
 * The tech's clock-out Status Report says "Hydrostatic test passed." on a job
 * named "Johnson Pretest". Infer the type from the job name and the verdict
 * from the report text. Null when neither the job name nor the text mentions
 * a test — the trigger stays quiet on ordinary jobs.
 */
export function inferTestReportDraft(jobName: string, reportText: string): TestReportDraftHint | null {
  const name = (jobName ?? '').toLowerCase()
  const text = (reportText ?? '').toLowerCase()
  let testType: TestReportType | null = null
  if (/\bpost[\s-]*(test|level)/.test(name) || /\bhydro\w*\s+test\s+post\b/.test(name)) testType = 'post_test'
  else if (/\bpre[\s-]*(test|level)/.test(name) || /\bhydro\w*\s+test\s+pre\b/.test(name)) testType = 'pre_test'
  else if (/\bpinpoint/.test(name)) testType = 'pinpoint'
  else if (/\bgas\s*test/.test(name)) testType = 'gas'
  else if (/\bhydro/.test(name) || /\bhydro/.test(text)) testType = 'pre_test'
  if (!testType) return null

  let result: TestReportResult | null = null
  if (isHydrostaticType(testType)) {
    const fail = /\b(fail|failed|failing|leak\s+found|leaks?\s+detected|did\s+not\s+(pass|hold)|lost\s+water|water\s+loss\s+detected)\b/.test(text) && !/\bno\s+(leaks?|loss|water\s+loss)\b/.test(text)
    const pass = /\b(pass|passed|passing|held|no\s+(leaks?|loss)|no\s+hydrostatic\s+loss)\b/.test(text)
    result = fail ? 'fail' : pass ? 'pass' : null
  }
  const reason = `${formatTestType(testType, null)} from the job name${result ? `, ${result.toUpperCase()} from the report` : ''}`
  return { testType, result, reason }
}
