import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5836',
  date: '2026-10-25',
  title: 'Legal desk: record what happened, not only what is planned',
  kind: 'feature',
  roles: ['dev', 'master_technician', 'assistant', 'controller'],
  highlights: [
    'The Timeline tab gains Record what happened beside Plan a step: the day it happened, what, notes, and the Evidence documents that prove it. The event sits on its day with a “happened” chip and its documents, and the firm reads it on its portal unless you hold it from counsel.',
    'Hold from counsel… and Undo… work on an event the same as on a planned step. A planned step marked done stays what it was; the new form is for what nobody planned.',
    'On the Narrative tab, Insert the events pastes every recorded event as a dated list under What happened, so the story is typed once.',
  ],
}

export default note
