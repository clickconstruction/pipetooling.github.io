import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.8411',
  date: '2026-11-23',
  title: 'Dev seat: an agent is told which id a mail tag and a trip take for a person',
  kind: 'fix',
  highlights: [
    'When an agent files a conversation on a person’s HR file, or puts a person on a trip, it names them by their row on the roster. The agent’s instructions sent it to the search of logins, which answers a different id.',
    'An agent that followed them was refused, and the refusal sent it back to the same search.',
    'The instructions and the refusals now name the roster row, in the words the HR file tools already use. Nothing changes in the app, and nothing changes in what an agent may do.',
  ],
}

export default note
