import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3210',
  date: '2026-09-09',
  title: 'Robot questions you answer with one tap',
  kind: 'feature',
  highlights: [
    'Robots now have to ask the estimator one decision at a time, in a sentence or two, with two to four answers to pick from. Long, multi-part asks are turned away at the door with a note telling the robot how to split them.',
    'On Bids → Robots → Audits, Standing rulings show those answers as buttons, the robot\'s own pick first. One tap answers, and on a shared issue it answers every open copy at once. Something else… brings back the typing box.',
    'The operator console at Settings → Digital twins gets the same buttons. Older questions without answers on them look and work exactly as before.',
  ],
}

export default note
