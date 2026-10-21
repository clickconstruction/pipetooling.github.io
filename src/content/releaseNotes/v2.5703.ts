import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5703',
  date: '2026-10-21',
  title: 'Messages: a sent text says whether it was delivered',
  kind: 'feature',
  highlights: [
    'Quo has always answered whether a text of ours reached the phone, but the app never showed it: a text that bounced read "texted" like any other.',
    'A sent text in the thread and on Went out now reads delivered beside its time once Quo answers. One that did not reach them reads not delivered in red, with Call them right on the row.',
  ],
}

export default note
