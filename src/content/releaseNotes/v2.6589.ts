import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6589',
  date: '2026-11-06',
  title: 'Your week: one progress signal a tech can watch move, every week',
  kind: 'feature',
  roles: ['dev', 'master_technician', 'assistant', 'controller', 'primary', 'helpers', 'superintendent'],
  highlights: [
    'A new card on the tech’s home, Your week, shows the one signal the office picked for that person: license hours for an apprentice, jobs without a callback for a tech, or the crew’s hours against the target for a lead. The big number, how far it moved this week, and the last eight weeks as dots. Compared to themselves, never to each other.',
    'License hours show approved hours solid and hours waiting for approval hatched, with a short bar to the next 500 hour mark. Jobs without a callback is a rolling count, 29 of your last 30 jobs, so one callback costs one job. The customer’s words from this week sit on the card.',
    'The office picks each person’s signal on their People desk, in the new Your week section, with the role’s guess named. Until it is picked, there is no card.',
    'On Jobs → Job Summary → Rework, each return visit now takes It was a callback or Not a callback. A callback counts against every tech clocked on the first job only once someone presses it; an inferred pair alone never reaches a card.',
  ],
}

export default note
