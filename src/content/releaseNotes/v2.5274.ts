import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5274',
  date: '2026-10-12',
  title: 'Messages: where Follow up keeps who has a conversation and what we owe, behind the scenes',
  kind: 'infra',
  roles: ['dev'],
  highlights: [
    'Each conversation now keeps whether it is open, snoozed to a day or done, and who has it. A new message moves it by itself.',
    'What we owe a person is kept with its day, and only a team note marks it done.',
    'A day heard on a call can be written down as the kind of promise it is. A plans question can go to the architect.',
    'Nothing on screen changes yet.',
  ],
}

export default note
