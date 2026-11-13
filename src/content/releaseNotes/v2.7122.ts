import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7122',
  date: '2026-11-13',
  title: 'An agent’s plan on an HR file can be kept for a yes',
  kind: 'feature',
  highlights: [
    'A plan an agent makes on a person’s HR file can now be held on the file instead of in one chat.',
    'Nothing about approval changes. A kept plan is applied only on a yes, and it is checked again first.',
    'A plan for counsel-only material is never kept. This is the groundwork. The list on the HR tab comes next.',
  ],
}

export default note
