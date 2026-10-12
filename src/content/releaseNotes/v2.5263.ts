import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5263',
  date: '2026-10-12',
  title: "Messages: the database behind the customer's page",
  kind: 'feature',
  roles: ['dev'],
  highlights: [
    'The app can now record which paper a customer opened on their page: our contract, a change order or a pay application. The office will read it back on the thread and in Follow up.',
    'Every sentence of the customer’s page is now stored in English and Spanish, ready for the office to reword in Settings. A reword keeps the blanks the page fills in.',
    'Each job gains three switches for its customer’s page: photos, the next bill’s size, and Spanish. All three start off.',
    'Nothing changes on screen yet. The page and its settings come in the next parts.',
  ],
}

export default note
