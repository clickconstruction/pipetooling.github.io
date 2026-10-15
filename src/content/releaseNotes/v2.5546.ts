import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5546',
  date: '2026-10-14',
  title: 'Messages: a teammate’s number has a home on Who is this?',
  kind: 'feature',
  roles: ['dev', 'master_technician', 'assistant', 'controller', 'estimator'],
  highlights: [
    'When someone on our own team texts the team number from a number the app has not seen, Who is this? offers One of our own team. Pick them from the roster and the thread is theirs.',
    'The number goes on their People record when it had none, so the app knows them next time and can text them.',
    'Everyone on the roster is on Messages now, under a new pill, Our team. Their texts count on Follow up like anyone’s, so a teammate writing the office gets a reply.',
    'A roster person who is not a sub used to be named a trade partner. They are one of our own team now, including the ones already named.',
  ],
}

export default note
