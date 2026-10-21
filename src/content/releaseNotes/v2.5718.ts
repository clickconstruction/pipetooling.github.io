import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5718',
  date: '2026-10-21',
  title: 'Quo connection in Settings: the key and the pickers',
  kind: 'feature',
  highlights: [
    'Settings → Phone and texts has a Quo connection card. Paste Quo’s API key there once. The app keeps it in the vault and shows only its last four characters, when it was saved and by whom.',
    'Company phone seats picks each seat from Quo’s own members, and Inboxes picks each number from Quo’s own numbers. Type it by hand is there for one Quo does not list, and without a key the cards read as before.',
    'The owner’s ask of 2026-10-21: no terminal in setup. Texts and calls keep working from the server’s key until a key is saved here, then use the saved one.',
    'Three guides: connect the app to Quo, and the seats and inboxes guides with the picker steps.',
  ],
}

export default note
