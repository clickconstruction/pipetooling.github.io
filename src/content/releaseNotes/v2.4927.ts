import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4927',
  date: '2026-10-08',
  title: 'GC mode: compare quotes and carry one, for a dev',
  kind: 'feature',
  roles: ['dev'],
  highlights: [
    'Once a trade has a quote, press Compare quotes on GC projects. Each company’s quote sits side by side, line by line.',
    'Type our cost to cover a line or an exclusion a quote leaves out. The All in row adds it, so the quotes compare fairly.',
    'Take an alternate to count it, then press Carry this number. That quote becomes the trade’s number in our price. You can carry our budget instead.',
    'The board and the price card show a plus sign and a question mark while the carried quote has a line with no cost.',
  ],
}

export default note
