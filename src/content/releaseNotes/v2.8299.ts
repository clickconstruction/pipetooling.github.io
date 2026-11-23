import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.8299',
  date: '2026-11-22',
  title: 'Lien desk: a retainage notice’s facts are changed where they sit',
  kind: 'feature',
  highlights: [
    'On a retainage notice, every day, amount and name now sits on its own line, apart from the words. An underlined value is one you can change, and a bold one is worked out by the app.',
    'Press the day our contract ended to change it right there. A window says which day the notice is then due before anything is saved.',
    'How the contract ended, the retainage the GC holds and the payment bond are changed the same way, and they save on Keep. The Change link that opened Edit Job is gone.',
    'On a job whose contract is still open, the footer’s press opens the fact on its line: pick how it ended, then type the day, then press Start the clock.',
  ],
}

export default note
