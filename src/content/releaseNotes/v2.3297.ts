import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3297',
  date: '2026-09-11',
  title: 'Groundwork: a job budget that remembers where it came from',
  kind: 'feature',
  highlights: [
    'Behind the scenes, a job can now carry a budget with a provenance: a snapshot of the linked bid’s estimate (which bid, when, by whom, how complete), or hours, materials and subs typed by the person who scoped the job. Nothing on screen changes yet.',
    'The database can also read a bid’s estimate as one breakdown (hours by stage, labor, materials, subs, driving, travel) and suggest which bid a job came from — a bid whose value equals the job’s price, the same GC, or the same address. It never links on its own.',
    'The next step puts this on the job’s Costs tab: a Budget card, a Link this bid door, and Burn reading against the real estimate instead of an assumed margin.',
  ],
}

export default note
