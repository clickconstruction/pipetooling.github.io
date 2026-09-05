import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2850',
  date: '2026-09-05',
  title: 'Opening Follow Up or a portal globe no longer creates anything',
  kind: 'fix',
  highlights: [
    'Prospects → Follow Up: just looking at a prospect no longer marks you as calling it. The mark is taken the moment you show intent — tap the phone, click into the comment box, log an outcome, or set a callback — and it expires after 30 minutes, so a closed tab can never hide a prospect from the rest of the team.',
    'A colleague who started the same prospect in the last half hour is never bumped off it. Your card shows “<name> is calling this one” instead — a heads-up, not a lock on the door.',
    'Customer and sub portal globes: a customer (or sub) who has never been given a portal now opens to “No portal link yet”. The link is created only when you click Create their link, with a “Portal link created” confirmation. Everyone who already has a portal opens exactly as before.',
  ],
}

export default note
