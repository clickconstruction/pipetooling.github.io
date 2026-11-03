import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6387',
  date: '2026-11-02',
  title: 'Today’s sends: a moved visit’s text expires with its visit',
  kind: 'fix',
  roles: ['dev', 'master_technician', 'assistant', 'controller', 'estimator'],
  highlights: [
    'When a first visit moves, the text that tells the customer the new day now remembers that day. Once the day has passed, the text is held with the reason instead of sitting under ready to send.',
    'The next morning the app puts the stale text away on its own, and the morning run’s summary says how many it put away.',
    'A held row says the day the text named and tells you to press Not this one if you want it gone sooner.',
  ],
}

export default note
