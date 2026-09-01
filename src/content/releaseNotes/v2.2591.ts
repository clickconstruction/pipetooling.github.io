import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2591',
  date: '2026-09-01',
  kind: 'feature',
  title: 'The deposit matcher now catches already-recorded payments',
  highlights: [
    'Pointing a deposit at a bill whose job already has a same-amount payment recorded by hand now raises a warning: that money may already be counted.',
    '"Link that payment instead" switches the allocation to link the existing payment — no duplicate is created.',
    '"It\'s a different payment" waves the warning off and keeps your pick.',
  ],
}

export default note
