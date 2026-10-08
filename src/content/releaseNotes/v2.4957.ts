import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4957',
  date: '2026-10-08',
  title: 'GC mode: the press behind the daily log',
  kind: 'infra',
  roles: ['dev'],
  highlights: [
    'GC mode can save the superintendent’s daily log for a job being built: the weather, who was on site and how many, what got done and what held work up.',
    'Saving a day again replaces its log. Nothing on screen uses it yet; the daily log window comes next.',
  ],
}

export default note
