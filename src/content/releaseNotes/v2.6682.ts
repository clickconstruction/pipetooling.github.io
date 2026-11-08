import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6682',
  date: '2026-11-08',
  title: 'The dev seat records what already happened on a legal matter',
  kind: 'feature',
  roles: ['dev'],
  highlights: [
    'A dev’s agent can now put a past event on a Legal desk matter: the day it happened, what happened, notes and the Evidence documents that prove it. It plans first, reads the plan, then applies, like every other write on the seat.',
    'The event lands on the desk’s Timeline tagged dev MCP, dated the day it happened and never ahead of today. The office holds it from the firm or undoes it from the desk as it does its own.',
    'Filing a case no longer needs past events entered as planned steps marked done.',
  ],
}

export default note
