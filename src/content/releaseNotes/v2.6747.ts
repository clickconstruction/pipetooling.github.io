import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6747',
  date: '2026-11-08',
  title: 'My email: the guess reads the conversation',
  kind: 'feature',
  roles: ['dev', 'master_technician', 'assistant', 'controller', 'estimator'],
  highlights: [
    'When a mail in your box belongs to a conversation that is already on a job, its guess is that job. The row says why: a mail of this conversation is on JP1077 already.',
    'Before this, the mail our bids or team inbox took read already in Messages while the reply under it read Tag…, and the guess looked at the subject and the sender instead.',
    'The conversation is asked first. The subject, the sender’s one job and the sender’s company are asked only when the conversation says nothing, or when its mails sit on two different jobs.',
    'Nothing is tagged on a guess alone. Yes is still your press.',
  ],
}

export default note
