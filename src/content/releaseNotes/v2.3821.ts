import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3821',
  date: '2026-09-25',
  title: 'Put a GC on notice: each notice claims the whole balance',
  kind: 'feature',
  highlights: [
    'Each notice in a GC run now claims the job’s whole unpaid balance and names every unpaid month, a closed month as information — the same as the Lien desk’s own notices. Before, it claimed only the months still inside their window.',
    'The letter’s “a further $X … is not in the claim” sentence is gone, since nothing is left out of the claim. The Claim column shows the balance with “includes Apr, Jun, Jul · windows closed” under it.',
    'A job whose every window has closed still gets no notice. The preview still shows exactly the paper that prints.',
  ],
}

export default note
