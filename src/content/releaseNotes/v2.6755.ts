import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6755',
  date: '2026-11-08',
  title: 'Settings → People & teams opens to the office: the owner’s switches, the office’s Additional People, the controller’s pay schedule',
  kind: 'feature',
  roles: ['dev', 'master_technician', 'assistant', 'controller'],
  highlights: [
    'The owner now sets Quick time add, Typed hours: a second person approves, Assistant hours visibility, Bulk hours alert and Team review cadence, and picks the Task Dispatch and Estimator Inbox groups. Before, the tab showed him only the superintendent bonus share.',
    'Assistants and the controller see People & teams for Additional People, where a roster person with no login is edited or removed.',
    'The controller holds the Sub portal pay schedule, the pay-run day and its explainer.',
    'Pay Approved Leaders, Role visibility and the team feedback block stay a dev’s, and Merge a duplicate stays on the person desk.',
  ],
}

export default note
