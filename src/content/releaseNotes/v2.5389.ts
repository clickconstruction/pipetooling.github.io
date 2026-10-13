import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5389',
  date: '2026-10-12',
  title: 'Messages: quick replies that fill in the customer’s name and the visit, behind the scenes',
  kind: 'infra',
  roles: ['dev'],
  highlights: [
    'A quick reply can hold blanks like the customer’s first name, the minutes out or the next visit, and the app fills them on the press.',
    'A blank the app cannot know, like what the tech found, stays for the person to fill, and the message waits until they do.',
    'The rules are ready for the lines a tech presses on the phone: the step the job is on first, six at most, and Something else last.',
    'Nothing on screen changes yet.',
  ],
}

export default note
