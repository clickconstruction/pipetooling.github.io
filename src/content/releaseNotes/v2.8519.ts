import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.8519',
  date: '2026-11-24',
  title: 'Punch list: a card can carry the question it waits on',
  kind: 'infra',
  highlights: [
    'A punch-list card can now say, in one line, who it waits on and the question they have to answer.',
    'Fifteen built cards that wait on a person each got their question.',
    'Nothing changes on the screen yet. A coming update lists the questions that wait on you and takes your answer.',
  ],
}

export default note
