import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7350',
  date: '2026-11-15',
  title: 'Bills sent: say how several bills to one customer went, in one press',
  kind: 'feature',
  highlights: [
    'When a customer has more than one bill with no send on record, Say how it went… lists the others. Tick the ones that went the same way, to the same person, on the same day.',
    'The button counts what it will record, like Record how 3 bills went. Each bill still gets its own record.',
    'If one bill is refused, the others still save. The refused bill stays in the yellow box with its reason in red.',
  ],
}

export default note
