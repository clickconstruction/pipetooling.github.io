import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3130',
  date: '2026-09-07',
  title: 'Edit Bid saves as you go',
  kind: 'feature',
  highlights: [
    'The Bid window\'s Edit tab now saves each change on its own, the way the Job window does — change the Win/Loss, a date, a link or a note and it is on the bid a moment later. The Save button is gone from that tab; the footer says "Saving…" and "Saved" instead.',
    'Closing the window saves anything still pending first. If that save fails, the window stays open and offers Retry, Keep editing, or Close without saving — nothing is dropped quietly.',
    'A new Bid Date Sent still asks for the confirm-sent checklist before it is written; the rest of the form keeps saving while you decide. "Open Counts" saves what is pending and takes you to Counts.',
    'New Bid keeps a dedicated button, now labelled "Create bid" (and "Create and open counts"). A bid has to exist before it can save itself.',
  ],
}

export default note
