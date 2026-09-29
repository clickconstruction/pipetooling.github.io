import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4140',
  date: '2026-09-29',
  title: 'Submittals: step 3 says the job, and the table explains its own words',
  kind: 'fix',
  roles: ['dev', 'master_technician', 'assistant', 'estimator', 'controller'],
  highlights: [
    'Step 3’s sentence reads “Check each row. Is it the product the plans asked for? If not, say why. Add its cut sheet, the maker’s page for the product.” instead of naming three columns.',
    'The Status, Reason and Sheet headers carry a ? that says what the column is for, and “What do the statuses mean?” under the table opens a one-line legend: As specified, Superseded, Equal, Alternate, Design change, Proposed, Missing, Accessory, and Cut sheet.',
    'The captions beside Build package, Share, New revision and Rebuild rows from picks read in plain words too.',
  ],
}

export default note
