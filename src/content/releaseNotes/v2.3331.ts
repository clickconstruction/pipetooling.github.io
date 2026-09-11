import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3331',
  date: '2026-09-11',
  title: 'Test reports on the Documents page',
  kind: 'feature',
  highlights: [
    'Documents → Jobs now lists every hydrostatic, pinpoint and gas test report under its job, next to the invoices and contracts — the test type, the test date, PASS or FAIL, and Sent or Draft.',
    'Click a sent report and the exact PDF the GC received opens. Click a draft and the Test report modal opens on it.',
    'The Documents search finds them by "test report", "hydrostatic", "gas", "PASS" or the job.',
  ],
}

export default note
