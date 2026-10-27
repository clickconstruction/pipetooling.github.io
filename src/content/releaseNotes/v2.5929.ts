import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5929',
  date: '2026-10-26',
  title: 'The Bridge: the Build desk behind its card',
  kind: 'feature',
  roles: ['dev'],
  highlights: [
    'The Build card on the Bridge ends in a Break it down door. It opens the Build desk: the last 14 days of every open job, the clock hours that went in against the work that came out, worst divergence first.',
    'Each row says what its hours did: the % moved and the dollars an hour, hours in with nothing moved, or nobody on it and for how many days, with what the Schedule shows for the week and the doors to the job and the Schedule. A job with no price says its hours earned $0 on paper.',
    'Three tiles sum the week: Moved, where the hours and the % agree; Ate hours, moved nothing, a stale % or work going nowhere; and Stalled, the sold money with no field hours in 14 days.',
    'Set the % on any priced row opens the crews’ own percent window, files the status report and the desk recomputes. The desk reads and opens doors; the week’s call stays with the link desk.',
  ],
}

export default note
