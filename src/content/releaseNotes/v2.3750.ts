import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3750',
  date: '2026-09-23',
  title: 'Stages: a short stage name is shown whole, and a deposit line reads Deposit',
  kind: 'fix',
  highlights: [
    'A stage named “1st Draw” chipped as “1st” on the Stages tab and the Pipeline bar, because every name the app did not recognize was cut to its first word. A name of ten characters or fewer is now kept whole — 1st Draw, Phase A — and a name that opens with a number keeps its next word, so a line typed as “1st Draw- Removal of old screen door…” reads 1st Draw.',
    'A line named Deposit, 50% deposit, Down payment or Down-payment reads Deposit on the chip, the way Rough In reads Rough. Hover still shows the full name.',
  ],
}

export default note
