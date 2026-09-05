import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2874',
  date: '2026-09-05',
  title: 'GC statements: nothing owed means no statement, and every statement says how to pay',
  kind: 'fix',
  highlights: [
    'Draft Message on a GC group with nothing owed now shows "Nothing owed — no statement goes out." and keeps Send statement disabled — one click can no longer email a GC "Total owed $0.00". Schedule… still works (a scheduled send rebuilds fresh and skips itself if the balance is still zero).',
    'The portal card under every statement now reads "Pay online any time at <their portal address> — this statement stays current there." — the same line whether you paste it, send it from the app, or the weekly schedule sends it.',
    'Preview statement in the round now shows the portal card that Copy for email pastes, so what you preview is what the GC gets.',
    'The GC statement wording in Settings → Email templates now applies to Draft Message sends too, not just scheduled ones; and a job with no address prints its name once instead of twice.',
  ],
}

export default note
