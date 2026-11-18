import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7660',
  date: '2026-11-17',
  title: 'Tell the dev: a press on every error line, and a wrench in a window on a phone',
  kind: 'feature',
  highlights: [
    'A red error line now carries a Tell the dev button. One more press sends the error to the dev, with no typing.',
    'An error that only says the signal dropped has no button. The phone already keeps that press and sends it when the signal is back.',
    'On a phone, a window has its own wrench in its title row, so you can send a note about the window you are in.',
    'With Fix Mode off, none of these show.',
  ],
}

export default note
