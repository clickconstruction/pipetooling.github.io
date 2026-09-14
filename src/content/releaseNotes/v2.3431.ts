import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3431',
  date: '2026-09-14',
  title: 'Pipeline: Capable of Being Billed reads the stage plan',
  kind: 'feature',
  highlights: [
    'On Jobs → Pipeline, a Working job split into stages now counts toward Capable of Being Billed the way its Bill tab does: the stages that passed inspection with nothing unbilled ahead of them, plus any-time rows whose work is done — never a row already on a bill.',
    'Jobs that were never split into ordered stages keep the familiar percent-complete figure, and the header shows that figure for every job until the stage data has loaded, so the number never drops to zero while it thinks.',
    'The Capable of Being Billed list says under each staged job which stages make up its amount.',
  ],
}

export default note
