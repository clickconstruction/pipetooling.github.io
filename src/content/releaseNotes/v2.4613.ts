import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4613',
  date: '2026-10-05',
  title: 'Help: every guide is held to plain words, with no exemption list',
  kind: 'infra',
  roles: ['dev'],
  highlights: [
    'All the help guides written before the plain-words rules are now rewritten, so the list that exempted them is gone.',
    'One test holds every guide to the rules, a new one from its first commit. The separate check that caught a touched guide still on that list is gone with it.',
  ],
}

export default note
