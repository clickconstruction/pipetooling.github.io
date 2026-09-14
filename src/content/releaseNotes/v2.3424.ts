import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3424',
  date: '2026-09-14',
  title: 'Job accounts on the job card: Ferguson ✓ · Reece none yet, and a one-tap ask',
  kind: 'feature',
  highlights: [
    'Every job card the field opens — the Dashboard schedule, Assigned Jobs, Dispatch Mode, the job window — now carries a Job accounts line: the houses that expect one, each marked ✓ open, requested, none yet, or not needed.',
    'Tap a ✓ for what to say at the counter (company · job account for the address · reference), who opened it and when, and the rep with a Call button. Copy for the counter puts the sentence on your clipboard.',
    'Tap “none yet” to ask the office: pick the houses, say you are at the counter, add a note, Send to Dispatch. You get a push when the account is open.',
    'The office sees the ask in the Dispatch inbox with the rep’s number: Call, Mark opened… (two taps), Send the packet, Not needed. Marking it closes the request and tells the tech.',
  ],
}

export default note
