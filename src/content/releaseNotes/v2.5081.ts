import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5081',
  date: '2026-10-09',
  title: 'Help: “see what the office got done on any day” starts with what to do first',
  kind: 'feature',
  roles: ['dev', 'controller'],
  highlights: [
    'The guide now opens with what to do first: the Day book lists what each office person got done on each day, and you pick a day and read its lines.',
    'Why a line’s waiting count or a month’s amber can be missing is now in one place, “Why a figure can be missing”.',
    'Nothing in the app changes, and no sentence was cut.',
  ],
}

export default note
