import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5417',
  date: '2026-10-12',
  title: 'Messages: the rules behind handing a job seeker’s text to the hiring board, behind the scenes',
  kind: 'feature',
  roles: ['dev'],
  highlights: [
    'The first piece of a new answer in Who is this? for someone asking about a job: the rules, with no screen yet.',
    'The answer makes a card on Prospects, Hiring, named from the text when it gives a name, else by the number, with the text as the note.',
    'The text stays with the person, so the card opens the whole thread. They never show on Follow up.',
  ],
}

export default note
