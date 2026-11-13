import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7146',
  date: '2026-11-13',
  title: 'Pipeline: a Bills sent button on the Billed header',
  kind: 'feature',
  highlights: [
    'Jobs → Pipeline: the Billed Awaiting Payment header has a new button, Bills sent, right after Paid notifications.',
    'It opens the Bills sent page: every bill that left, who it went to, and the minute it went.',
    'It is a link, so you can open it in a new tab. The same row is in the Section tools menu beside Waiting.',
    'The owner, developers, assistants and the controller see it. Those are the people who can open the page.',
  ],
}

export default note
