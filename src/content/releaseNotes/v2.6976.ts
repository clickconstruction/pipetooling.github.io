import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6976',
  date: '2026-11-12',
  title: 'An agent on the dev seat can fill in a bid’s Labor tab',
  kind: 'feature',
  highlights: [
    'A dev’s agent can now set a bid’s labor the way the Labor tab does: the labor rate, driving and travel, the hours for each counted fixture, and the direct costs such as permits and rentals.',
    'Hours from the agent read as typed, so the labor book never overwrites them when the bid is first marked sent.',
    'Before anything changes the agent reads a plan in words, with the tab’s direct cost of the bid before and after.',
    'A fixture nobody counted is held with its reason, since the Labor tab only keeps hours for counted fixtures. The labor book itself is never changed by the agent.',
  ],
}

export default note
