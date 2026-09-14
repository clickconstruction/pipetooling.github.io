import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3410',
  date: '2026-09-14',
  title: 'Lien desk: send the run — one packet, one tracking form, every notice recorded at once',
  kind: 'feature',
  highlights: [
    'Send the run takes every approved notice on the desk and prints one packet: a cover sheet listing the envelopes, then each notice for the owner of record and for the original contractor, with its cover note on its own page.',
    'One form for the tracking numbers — a row per recipient with the delivery method (certified mail, courier, hand, or a courtesy email where an address is on file). Type them now or after the post office.',
    'Record the run writes each notice to its job naming every month it covered and moves the desk rows to Sent, so the forecast and the Dashboard read them as noticed the moment it saves. A single notice can still go out on its own from the Lien window.',
  ],
}

export default note
