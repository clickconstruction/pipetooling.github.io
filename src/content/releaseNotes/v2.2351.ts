import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2351',
  date: '2026-08-26',
  title: 'Due dates for one-off tasks',
  kind: 'feature',
  highlights: [
    'One-off tasks can carry a "Due by" date: on the list from their start day, a calm "due Fri, Sep 4" chip through the window, amber on the due day, red only once actually late.',
    'The Outstanding list now sorts most-overdue first, the Dashboard countdown tags count to the due date, and History marks completions that ran past it ("done 2 days late").',
    'Reminders follow the deadline: "day before" fires before the due date and escalation means days late. Tasks without a due date behave exactly as before.',
  ],
}

export default note
