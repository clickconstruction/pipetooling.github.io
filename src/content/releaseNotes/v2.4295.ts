import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4295',
  date: '2026-10-01',
  title: 'Audits: three fixes from walking a real audit',
  kind: 'fix',
  roles: ['dev', 'master_technician', 'assistant', 'controller', 'estimator'],
  highlights: [
    'On a phone, Bids → Robots → Audits no longer opens an audit card over the page when you arrive. You see the sentence, the button and the queue first; a row opens its card, and Finish audit → next opens the next one.',
    '“Same item — teach the name” stopped offering pairs that are not the same item: two rows that only share a count of one, a $250 outlet beside a $3,354 unit, a 4-inch fitting beside a 3-inch one.',
    'The question run-through says both counts when one answer covers several copies — “Question 1 of 16 · 19 questions” — so it agrees with the Answer the 19 questions button.',
  ],
}

export default note
