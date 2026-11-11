import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6887',
  date: '2026-11-10',
  title: 'A check that keeps the blank page from coming back',
  kind: 'infra',
  highlights: [
    'Nothing new shows on a screen. Two fixes this week ended a blank page on the box label pages and on an estimate’s customer preview.',
    'A check now reads every page that opens outside the signed-in app, and refuses a change that would bring the blank page back on any of them.',
    'When it refuses a change it names the page and says how to fix it.',
  ],
}

export default note
