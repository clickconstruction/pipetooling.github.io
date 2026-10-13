import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5425',
  date: '2026-10-12',
  title: 'Messages: a line remembers who tied it to its job, behind the scenes',
  kind: 'feature',
  roles: ['dev'],
  highlights: [
    'When someone ties a message to a job by hand, the message now keeps who did it.',
    'A message that landed on the person’s starred job as it came in keeps no one, so the coming New lane can ask which job it belongs to.',
    'Nothing on screen changes yet.',
  ],
}

export default note
