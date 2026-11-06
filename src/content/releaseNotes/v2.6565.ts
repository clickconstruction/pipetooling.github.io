import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6565',
  date: '2026-11-06',
  title: 'The dev seat searches the company’s own mailboxes: one Gmail search across every login, read-only by scope',
  kind: 'feature',
  roles: ['dev'],
  highlights: [
    'A dev’s agent can run one Gmail search across every login of the Workspace, or the ones it names, and read a hit whole: a supply house’s bill, a job’s thread, a pattern, found wherever it landed.',
    'It reads as each account under the service account’s delegation with the read-only Gmail scope and no other, so the token Google hands it cannot label, move, trash or delete a mail.',
    'Every search is on the seat’s call log with its query and the accounts it read, never a mail’s words.',
  ],
}

export default note
