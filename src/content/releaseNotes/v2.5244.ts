import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5244',
  date: '2026-10-11',
  title: 'The Bridge: the field’s pace read by hours as well as by percent, and the thin reading does not take the link',
  kind: 'fix',
  roles: ['dev'],
  highlights: [
    'The Build card reads the field’s pace two ways: by the percents, and by the hours the field earned on recorded time. It uses the larger and names the other, so thin percents no longer make the field look slow.',
    'The Bill card’s first line, what the field finishes a week, reads recorded time like the top line. Hours still waiting on approval count, so the pile no longer grows faster than the card says.',
    'When over a third of Build’s pile is a guess, Build takes the link only by a clear margin. Its badge says it reads on a thin percent and asks for the percents to be set.',
    'The Talent card reads one person billing when bills went out with no sender on them, instead of nobody.',
  ],
}

export default note
