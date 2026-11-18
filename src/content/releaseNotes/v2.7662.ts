import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7662',
  date: '2026-11-17',
  title: 'Supply houses: what each bill lists for now has its own tests',
  kind: 'infra',
  highlights: [
    'Nothing changes on screen. A house’s bills, the phone screen, Record a payment and a payment’s own window read as they did.',
    'The rules behind a bill’s row moved out of the page into one tested file: what is left on a bill paid in part, what paid it, and which receipt link it shows.',
    'This is the first of twelve cuts of the Supply houses tab, the largest file on the Materials page.',
  ],
}

export default note
