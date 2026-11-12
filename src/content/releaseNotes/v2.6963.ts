import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6963',
  date: '2026-11-11',
  title: 'Builders counts the bids of a customer tied to a name',
  kind: 'feature',
  highlights: [
    'On Prospects, Permits, Builders, the Our bids column now counts the bids of a customer someone tied to the name. Until now it counted only a customer with the exact same name. A line under the count says through which customer.',
    'A builder’s sheet has a new part, Our customer under this name. It lists each customer the name is tied to, with whose word it is and the day. Take back undoes one. Tie to a customer finds any other of ours.',
    'When a customer’s name begins the name on a permit, or the other way round, the question now reads Same company? It shows on the builder’s sheet and under a bid’s permit. The answers are the same three, and nothing is tied until you press.',
  ],
  roles: ['dev', 'master_technician', 'assistant', 'controller', 'estimator'],
}

export default note
