import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6600',
  date: '2026-11-06',
  title: 'Your people on the Dashboard: who moved today, who is stuck, with the ring on their newest card',
  kind: 'feature',
  roles: ['dev', 'master_technician', 'assistant', 'controller'],
  highlights: [
    'The office’s Dashboard gets a Your people card under My Inbox: one row per person with an open one-off task, their newest-moved card with its ring, and a chip that reads moved today, moved Wed, or stuck 32 days.',
    'Stuck is Review’s own age rule, amber after a week and red after a month, so the Dashboard and Checklist → Review never disagree. The line up top counts the cards done this week, who moved and who is stuck.',
    'A row opens Review’s board. Remind nudges that person the way the board’s bell does. The card draws nothing while nobody has an open card.',
  ],
}

export default note
