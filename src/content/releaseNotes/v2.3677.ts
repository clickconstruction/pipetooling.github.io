import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3677',
  date: '2026-09-21',
  title: 'Quick time add: who gets the door and the daily limit are settings',
  kind: 'feature',
  highlights: [
    'Settings → People & teams → Quick time add: tick the roles that see "＋ quick call or email" under the clock (assistant, controller, estimator, primary, master technician, dev) and set the most minutes of quick adds one person can add in a day.',
    'Out of the box nothing changes: assistant, controller, estimator and dev have the door, and the limit is 120 minutes. Salaried people and anyone in training mode never get it, whatever is ticked.',
    'The database checks the same two settings when a quick add is saved, so the door and the refusal always agree.',
  ],
}

export default note
