import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3669',
  date: '2026-09-21',
  title: 'Contract sweep: “We already have one” — and the sweep looks in Drive for you',
  kind: 'feature',
  highlights: [
    'The sweep now asks the first question first. Each job opens with two choices: We need a signature (send them ours) or We already have one — a single place to paste the Google Drive link to a contract the customer already signed. It used to be a small link at the bottom of the window.',
    'The sweep checks the jobs Drive by itself when it opens (it says “checking Drive…” for about a minute). Jobs it finds a contract for are marked and lined up under a new In Drive tab. When it is sure, the link and the date are filled in for you to confirm; when it is not sure, it shows you the file and waits until you say it is the right one.',
    'On a job, the Customer Contract row now has a field for the contract — paste the Drive link and press File it. Once it is on file, Open the contract ↗ goes straight to it.',
    'The right-hand side of the sweep now names the job it is about, and the labels no longer wrap into their values.',
  ],
}

export default note
