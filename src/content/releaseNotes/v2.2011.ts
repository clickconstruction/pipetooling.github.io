import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2011',
  date: '2026-08-21',
  title: 'Pricing Workbench: target total is the whole-bid total',
  kind: 'fix',
  highlights: [
    'Typing a target total now lands the whole bid on that number — rows priced without a cost basis (allowances, pass-throughs) count toward the target instead of riding on top of it.',
    'Solving for a blended margin accounts for those rows the same way, so the landed margin matches the slider.',
    'Switching scenarios discards any un-applied solver preview — a solve previewed on one scenario can no longer be applied to another by accident.',
    'The target total stays in its box after solving, and a toast tells you the exact total the preview lands at.',
  ],
}

export default note
