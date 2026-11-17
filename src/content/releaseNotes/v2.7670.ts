import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7670',
  date: '2026-11-17',
  title: "Trips: the dev seat reads a site's trips and files one",
  kind: 'feature',
  highlights: [
    'A dev’s agent can now read the trips kept on a site. Each trip comes with its days, its people and where it stands: Planned, Out now or Back.',
    'The agent can file a trip already known from a ledger. It shows a plan first, and nothing is saved until the plan is approved.',
    'A person named on the roster is tied to their own row and login. Anyone else is kept as a name alone, and the plan says which.',
    'A trip filed this way changes no clock row, bill or cost. Deleting a trip is still done in the app.',
  ],
}

export default note
