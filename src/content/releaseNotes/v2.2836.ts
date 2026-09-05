import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2836',
  date: '2026-09-05',
  title: 'Superintendents see only their assigned projects',
  kind: 'fix',
  highlights: [
    'A superintendent\'s Projects list, Workflow pages, step line items and sub work orders now cover only the projects they are assigned to — the way the help and access docs always said it worked. Assign someone from the Workflow page\'s Assigned Superintendents section to give them a project.',
    'Office roles (dev, master, assistant, controller) see exactly what they saw before.',
    'Primaries are no longer sent to an always-empty Workflow page; their steps still live on the Dashboard.',
  ],
}

export default note
