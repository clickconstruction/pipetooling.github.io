import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5556',
  date: '2026-10-15',
  title: 'Trade partners: a call script for phoning a company new to us',
  kind: 'feature',
  roles: ['dev', 'master_technician', 'assistant', 'controller', 'estimator'],
  highlights: [
    'Press Call script at the right of the trade strip on Trade partners. A window reads the four parts of the call, the intro, the point of contact, the questions to ask and the closing, with your own first name already in it.',
    'Open in a new tab keeps the script beside the app while you call. Copy the script puts the whole thing on your clipboard.',
    'When the call ends, press Add a company on the trade’s card and type what they gave you.',
  ],
}

export default note
