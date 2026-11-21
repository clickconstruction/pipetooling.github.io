import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.8136',
  date: '2026-11-20',
  title: 'Job Mode: Is it as told? reads the list again after a refused send',
  kind: 'fix',
  highlights: [
    'When someone else on the crew answered first, or the office changed the list, your send was refused and the card stayed as it was. No press on it could be kept.',
    'The card now reads the list again after a refusal. It shows the list as it is now, or goes away when there is nothing left to ask.',
    'A card that is already up stays up when the signal drops, with your No presses on it.',
  ],
}

export default note
