import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5183',
  date: '2026-10-10',
  title: 'GC mode: the Follow up sheet’s messages, behind the scenes',
  kind: 'infra',
  roles: ['dev'],
  highlights: [
    'GC mode can now write the polite note that asks a trade for what it owes us, from me or from the company, in English or Spanish.',
    'It also knows who at the trade gets that email, such as the bookkeeper for insurance and waivers, and says why.',
    'Nothing on screen uses it yet. The Follow up sheet comes with the board’s Work the list.',
  ],
}

export default note
