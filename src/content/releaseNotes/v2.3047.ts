import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3047',
  date: '2026-09-07',
  title: 'Safety net under paid-job emails',
  kind: 'fix',
  highlights: [
    'Previewing, test-sending and sending the paid-job and Ready to Bill emails now has 7 tests pinning what each action asks for and that the real reason for a failure is shown, not a generic error; no behaviour change.',
  ],
}

export default note
