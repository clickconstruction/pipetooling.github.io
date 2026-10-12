import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5271',
  date: '2026-10-12',
  title: 'Messages: the rules for editing a flow in Settings',
  kind: 'feature',
  roles: ['dev'],
  highlights: [
    'Groundwork for the flows in Messages. Nothing changes on screen yet.',
    'A flow’s steps can be renamed, moved, added, removed and put back. Each one finishes by facts the app already keeps.',
    'Every change is tried on everyone before it is saved, and the app says who moves.',
    'Each save writes a History line with who changed what, and when.',
  ],
}

export default note
