import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3524',
  date: '2026-09-16',
  title: 'Made the call? Hide the customer-waiting strip for yourself',
  kind: 'feature',
  highlights: [
    'Once the strip reads "you called …", a small Hide for me appears on it for you alone. It hides the strip on your device; everyone else keeps it, and the request stays open until someone lowers or closes it.',
    'If another person calls the customer later, the strip comes back for you too.',
  ],
}

export default note
