import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6191',
  date: '2026-10-30',
  title: 'The question comes first on a New message, and the address or number it came from sits after the name',
  kind: 'feature',
  highlights: [
    'On Messages, the blue Who is this?, Which job? or Who has it? now sits before the name on each New row, where the eye lands first.',
    'After the name, in quiet words, the address or the number the line came from. A row named by its number or address alone does not say it twice.',
    'A text shows their number first and an email their address first. Everything else on the row is as it was.',
  ],
  roles: ['dev', 'master_technician', 'assistant', 'controller', 'estimator'],
}

export default note
