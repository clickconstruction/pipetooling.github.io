import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2385',
  date: '2026-08-27',
  title: 'The solver folds behind Solve ›, and Apply to Bid Value retires',
  kind: 'feature',
  highlights: [
    'The Pricing Workbench solver now folds behind a blue Solve › button — pressed, its controls unfold inside a blue ring (slider with the 2×–5× ticks, margin box, target total, Solve), and ‹ folds them away. Open or closed is remembered on your device.',
    'Draft actions are one tidy control now: an amber count chip, Apply, and Discard fused at one height — right-pinned, and never hidden by folding, so unsaved drafts always show.',
    'Cover Letter: the Apply to Bid Value button and its sync chrome are gone — Mark sent has stamped the bid\'s value (with the sent date) for a while now, and the headline caption says so.',
    'Counts: Old/New sits beside the bid title like the other tabs, Import from /Tooling moves to the header\'s right end, and the Edit Bid button retires — the bid number link already opens the bid.',
  ],
}

export default note
