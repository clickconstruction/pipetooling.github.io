import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2582',
  date: '2026-09-01',
  title: 'Lien releases are tracked — and follow through when the check clears',
  kind: 'feature',
  highlights: [
    'A new "Save & mark issued" button on the release window records each lien release on the job; jobs with an issued release show a highlighted release button on the Pipeline board.',
    'The Bill Customer window now lists the job’s lien releases with their status — including whether the payment behind a conditional release has cleared — with View, Void, + New release, and a one-click "Issue unconditional" when the money has landed.',
    'A "Needs you" card on the Dashboard (and Quickfill) counts payments that cleared behind conditional releases, so the unconditional version the customer is owed never gets forgotten.',
  ],
}

export default note
