import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5312',
  date: '2026-10-12',
  title: 'Contracts: papers added to a flow stay out of the Contract Book’s lists',
  kind: 'fix',
  roles: ['dev'],
  highlights: [
    'Groundwork for the flows in Messages. Nothing changes on screen today.',
    'A paper the office adds to a step of a flow never becomes a job contract’s terms, a work order’s reference or a card on Contracts & terms.',
  ],
}

export default note
