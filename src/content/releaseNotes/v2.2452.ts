import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2452',
  date: '2026-08-28',
  title: 'Converted prospects leave the calling queue',
  kind: 'feature',
  highlights: [
    'Winning a prospect finally counts: converting one on the Convert tab now marks it Converted, so the calling queue stops offering companies that are already your customers.',
    'The Follow Up workstation gets a Converted ✓ button beside Can\'t reach — hit it when a call ends with "they\'re a customer now" and the queue moves on.',
    'Converted prospects keep their history in a new collapsed Converted section on the Prospect List, with Send back if one was marked by mistake.',
    'Every conversion leaves a "Converted to customer …" note in the prospect\'s comment history, stamped with who did it and when.',
  ],
}

export default note
