import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6183',
  date: '2026-10-30',
  title: 'A dev’s agent can make a bid through the dev seat',
  kind: 'feature',
  highlights: [
    'The dev MCP seat has two new verbs, plan_bid and apply_bid. An agent with a dev key plans a bid the way the New Bid form makes one, reads the plan, then applies it. The database numbers the bid.',
    'The plan names the customer, the service type, the development, the due date and the distance, says which division folder the plans will go in, and refuses a live bid that already wears the project name unless the agent says so.',
    'Nothing changes on the Bid Board: the new bid shows there at once, with no plans yet. Filing the plans from the same seat is the next release.',
  ],
  roles: ['dev'],
}

export default note
