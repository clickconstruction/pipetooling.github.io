import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5108',
  date: '2026-10-09',
  title: 'Workflow: a refused change shows above the page instead of replacing it',
  kind: 'fix',
  roles: ['dev', 'master_technician', 'assistant', 'controller', 'superintendent'],
  highlights: [
    'On a project’s Workflow page, a change the database refuses now shows its message in a red bar at the top of the page. Before, the message replaced the whole page until you reloaded. This covers attaching an invoice, saving a line item, a sub work order, approving a stage and the like.',
    'The bar stays in view while you scroll. Tap × to close it, or it clears on your next change.',
    'When the page itself cannot load, or a subcontractor has no stage on the project, the page still shows only that message.',
  ],
}

export default note
