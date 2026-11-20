import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.8118',
  date: '2026-11-20',
  title: 'Permits, Market: a place to keep what was looked up about a builder',
  kind: 'infra',
  highlights: [
    'The database can now keep what a one-time lookup found about a builder on the call list: what kind of company it is, an office phone, and a person to ask for. Each fact keeps the page it came from and the day.',
    'It can also keep a person’s check of each fact: that it held, or that it was wrong, with who said so and when. A check can be undone.',
    'Nothing on screen changes yet. The Ask for block on the call list comes next.',
  ],
}

export default note
