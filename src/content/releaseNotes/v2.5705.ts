import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5705',
  date: '2026-10-21',
  title: 'Messages: the thread shows when a customer opened, accepted or declined an estimate',
  kind: 'feature',
  highlights: [
    'When a customer opened the estimate link, accepted it or declined it, only the estimate’s own Customer activity knew. The thread showed nothing between our email and their reply.',
    'The thread now draws those moments as the app’s own lines, in order with the texts and emails: Dana opened estimate #212, Dana accepted estimate #212, with Signed when they signed.',
    'One line per estimate for each: a second open or a repeated accept writes nothing more.',
  ],
}

export default note
