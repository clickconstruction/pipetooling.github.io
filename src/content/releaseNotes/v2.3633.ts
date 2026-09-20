import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3633',
  date: '2026-09-20',
  title: 'Robots: groundwork for one readable connector address',
  kind: 'infra',
  highlights: [
    'The robots’ connector is getting a short address of its own (mcp.clicktooling.com/twin) in place of the long database one. This release is the groundwork: the forwarding rule is written and “Set up on this Mac” can hand out the new address once it is switched on. Nothing changes on a computer that is already set up.',
  ],
}

export default note
