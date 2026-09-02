import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2658',
  date: '2026-09-02',
  title: 'Editable wording for lien-release and hazmat-notice emails',
  kind: 'feature',
  highlights: [
    'The cover notes on two customer emails — the signed lien release and the biohazard fee notice — are now editable in Settings → Email templates, with variables like {{project}} and {{amount}}, no deploy needed.',
    'No template saved means the built-in wording sends, and a typo\'d variable stays visible instead of silently vanishing — so a bad edit can\'t produce a blank email.',
    'The attached PDFs themselves never change here: wording only, documents stay documents.',
  ],
}

export default note
