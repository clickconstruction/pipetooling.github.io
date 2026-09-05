import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2805',
  date: '2026-09-05',
  title: 'Two forms of our own: direct deposit and Texas lien waivers',
  kind: 'feature',
  highlights: [
    'A Direct Deposit Authorization written for Click: the employee fills bank, routing, and account on their phone; the numbers live only inside the signed PDF.',
    'The four Texas statutory lien waivers (conditional and unconditional, progress and final) as forms a sub signs to Click, with the statute\'s exact wording and the required notice on the unconditional ones.',
    'Both are drafted and previewed; they go into the Contract library once the wording is approved.',
  ],
}

export default note
