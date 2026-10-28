import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6037',
  date: '2026-10-28',
  title: 'The Pipeline’s Sent chip says when the good-through date passed',
  kind: 'feature',
  roles: ['assistant', 'controller', 'master_technician', 'estimator', 'superintendent', 'dev'],
  highlights: [
    'On the Estimates Pipeline, a sent estimate whose good-through date is behind you now wears a red chip, “good through passed · extend?”, in place of the opened or never-opened chip. Hover it and it names the day that passed.',
    'Press the chip and you land on that estimate’s Extend good-through door, with the date field ready. It is the same door as before, under Waiting for customer. Nothing else changed there.',
    'An estimate whose date is still good keeps today’s chip. The chip shows only where Extend is offered: a sent estimate, not one that was accepted, declined or replaced. The customer never sees it.',
  ],
}

export default note
