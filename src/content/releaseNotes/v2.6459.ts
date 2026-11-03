import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6459',
  date: '2026-11-03',
  title: 'A new flow step never stops the morning reminders',
  kind: 'fix',
  highlights: [
    'When a flow gains a new step, or a new thing that finishes a step, an older copy of the app still reads everyone. It reads on without the new part until the update that knows it is out. Before this, the morning reminder run failed for everyone.',
    'If one person’s flow still cannot be read, the morning run leaves that person out and counts them in its summary. Everyone else gets their reminders.',
  ],
  roles: ['dev', 'master_technician', 'assistant', 'controller'],
}

export default note
