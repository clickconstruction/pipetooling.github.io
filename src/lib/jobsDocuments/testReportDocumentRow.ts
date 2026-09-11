import { testReportShortLabel, type TestReportSystem, type TestReportType } from '../jobs/testReport'
import { testReportStatusLabel } from '../jobs/testReportRow'

/**
 * A test report as a Documents → Jobs child row (v2.3331). Sent reports are
 * documents — the exact PDF the GC received — and open the stored file;
 * drafts open the Test report modal so the office can finish and send them.
 * Pure: the page renders what this returns and the test pins the words.
 */
export type TestReportDocumentRowSource = {
  id: string
  test_type: string
  system: string | null
  result: string | null
  test_date: string
  status: string
  sent_at: string | null
  pdf_path: string | null
  pdf_version: number
}

export type TestReportDocumentChip = { label: string; tone: 'pass' | 'fail' | 'sent' | 'draft' }

export type TestReportDocumentRow = {
  id: string
  /** "Sewer Pre-Test Hydrostatic test report" — the link text. */
  title: string
  /** "tested Sep 10" — the muted detail after the link. */
  detail: string
  /** The verdict chip (hydrostatic only), then the status chip. */
  chips: TestReportDocumentChip[]
  /** Sent with a stored PDF → open the file; otherwise open the modal. */
  door: { kind: 'pdf'; path: string } | { kind: 'modal' }
  /** For the page search: every word a person might type for this row. */
  searchText: string
}

const TYPES: ReadonlySet<string> = new Set(['pre_test', 'post_test', 'pinpoint', 'gas'])
const SYSTEMS: ReadonlySet<string> = new Set(['supply', 'sewer'])

export function testReportDocumentRow(row: TestReportDocumentRowSource): TestReportDocumentRow {
  const type = (TYPES.has(row.test_type) ? row.test_type : 'pre_test') as TestReportType
  const system = (row.system && SYSTEMS.has(row.system) ? row.system : null) as TestReportSystem | null
  const label = testReportShortLabel(type, system)
  const title = /\bTest$/i.test(label) ? `${label} report` : `${label} test report`
  const detail = `tested ${formatYmd(row.test_date)}${row.pdf_version > 1 ? ` · v${row.pdf_version}` : ''}`
  const chips: TestReportDocumentChip[] = []
  if (row.result === 'pass') chips.push({ label: 'PASS', tone: 'pass' })
  else if (row.result === 'fail') chips.push({ label: 'FAIL', tone: 'fail' })
  const status = testReportStatusLabel({ status: row.status, sent_at: row.sent_at })
  chips.push({ label: status, tone: row.status === 'sent' ? 'sent' : 'draft' })
  const door: TestReportDocumentRow['door'] = row.status === 'sent' && row.pdf_path ? { kind: 'pdf', path: row.pdf_path } : { kind: 'modal' }
  const searchText = ['test report', title, detail, ...chips.map((c) => c.label)].join(' ').toLowerCase()
  return { id: row.id, title, detail, chips, door, searchText }
}

export function testReportDocumentChipColors(tone: TestReportDocumentChip['tone']): { background: string; color: string } {
  switch (tone) {
    case 'pass':
    case 'sent':
      return { background: 'var(--bg-green-tint)', color: 'var(--text-green-700)' }
    case 'fail':
      return { background: 'var(--bg-red-100)', color: 'var(--text-red-700)' }
    case 'draft':
      return { background: 'var(--bg-amber-100)', color: 'var(--text-amber-800)' }
  }
}

function formatYmd(ymd: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(ymd)
  if (!m) return ymd
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}
