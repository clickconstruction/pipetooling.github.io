import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.8518',
  date: '2026-11-24',
  title: 'Trade partners: an ask we took back no longer counts against a company’s quotes',
  kind: 'fix',
  roles: ['dev', 'master_technician', 'assistant', 'controller', 'estimator'],
  highlights: [
    'A company’s quoted count now leaves out any ask we took back. An ask we closed is not one they failed to answer.',
    'A company whose only ask we took back reads asked once, and we took it back. It read quoted 0 of 1 asks.',
    'The reliable, mixed and mostly silent marks are worked out the same way, so our own take-back never makes a company look silent.',
  ],
}

export default note
