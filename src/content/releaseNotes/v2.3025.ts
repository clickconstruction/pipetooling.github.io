import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3025',
  date: '2026-09-07',
  title: 'Safety net under write-up templates',
  kind: 'fix',
  highlights: [
    'Write-up templates and the answers filled into them now have 7 tests pinning what a template may contain, what a blank write-up starts with, and which answers are refused; no behaviour change.',
  ],
}

export default note
