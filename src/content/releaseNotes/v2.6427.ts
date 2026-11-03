import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6427',
  date: '2026-11-02',
  title: 'The Agreements panel shows the documents people hold',
  kind: 'feature',
  roles: ['dev', 'master_technician', 'assistant', 'controller'],
  highlights: [
    'On People → Contracts, the Agreements panel now opens on the documents someone is assigned or has signed.',
    'The rest of the Contract Book sits behind one press that counts them, such as Show 9 unassigned documents. Each still has its Send to… button.',
    'Before this, the lien waivers and the customer papers sat at 0 assigned · 0 signed above the agreements the team actually holds.',
  ],
}

export default note
