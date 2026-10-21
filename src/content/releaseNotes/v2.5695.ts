import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5695',
  date: '2026-10-20',
  title: 'Estimates: the Tell the customer sheet shows its receipt after the send',
  kind: 'fix',
  highlights: [
    'After a successful send from the sheet, the page refreshed behind it and that refresh rebuilt the whole screen, so the sheet came back as if nothing had happened: no receipt, no band, the same green button. This is what the office saw as "I hit send and nothing changed".',
    'The refresh after a send now keeps the page up and swaps the new estimate in, and the sheet stays where it is through it, so the receipt shows with what went and the call to make.',
    'The pre-send save no longer reloads the page on its own either, so the send is one step quicker.',
  ],
}

export default note
