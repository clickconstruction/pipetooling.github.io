import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.8629',
  date: '2026-11-26',
  title: 'Pay: a wage changed on a screen leaves a line on the pay log',
  kind: 'fix',
  highlights: [
    'A wage or the salaried switch changed on a person’s sheet, on Bring back, on a hire or end window or in People → Pay’s cells now leaves one line on the pay log, with the row before and after.',
    'Before, only a change through the dev seat left a line. A wage saved on a screen left the pay row and nothing else.',
    'The line says it came from a screen and that no reason was asked. A change through the dev seat still leaves its one line with its reason.',
  ],
}

export default note
