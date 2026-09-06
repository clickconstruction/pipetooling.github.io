import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2917',
  date: '2026-09-05',
  title: 'Checklist papercuts — the sign-off queue keeps all of your cards; Waiting For names active people only',
  kind: 'fix',
  highlights: [
    'Review → To sign off (and the Dashboard Teams Inbox): the queue now finds your reviewable completions first and caps at 50 after, so a card of yours no longer disappears because 50 newer completions belong to other people — and the TO SIGN OFF count matches what you see.',
    'Today → ⏳ Waiting For (and the Dashboard My Inbox strip): "who\'s on it" names active people only — an archived account or a digital twin assigned to the blocking task no longer shows as the person you are waiting on.',
  ],
}

export default note
