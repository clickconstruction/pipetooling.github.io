import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7435',
  date: '2026-11-16',
  title: 'Dashboard: the lien notices that wait on a leader are a card of their own',
  kind: 'feature',
  highlights: [
    'A leader’s Needs you now leads with Lien notices · your signature. The title says the deadline, like Sign 1 lien notice today.',
    'Each notice is a row with its job, its claim, its GC and when its window closes. A month that closed with nothing sent says so in red on its own row.',
    'Open 891 to sign opens that notice on the Lien desk, and every other row opens its own. Past three notices, one line opens the rest.',
    'The money is now the sum of the waiting notices’ claims, and the card says how long they have waited. Dates read in words.',
  ],
}

export default note
