import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5306',
  date: '2026-10-12',
  title: 'Messages: a place for the papers the office adds to a flow',
  kind: 'infra',
  roles: ['dev'],
  highlights: [
    'A paper the office adds to a step becomes a Contract library document, filed with the other flow papers.',
    'Each paper keeps its kind, its Spanish name, a notice’s words and how soon to ask for the next one.',
    'Anyone in the office can add one. A contract’s clauses wait for a controller or a dev to approve them, unless one of them wrote them.',
  ],
}

export default note
