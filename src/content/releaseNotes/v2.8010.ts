import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.8010',
  date: '2026-11-19',
  title: 'Before we start: ask the customer about every open item in one message',
  kind: 'feature',
  roles: ['dev', 'master_technician', 'assistant', 'controller', 'estimator', 'primary', 'superintendent'],
  highlights: [
    'A stage with open items has an Ask press. It writes one message from the open items, and you can change any word.',
    'On a Development page, one ask covers every stage whose day to decide is near.',
    'Text it and Email it open the customer’s box in Messages, filled. Nothing is sent until you send it there.',
    'Every ask is kept with its day and how. The office’s Needs you says when a customer owes us answers.',
  ],
}

export default note
