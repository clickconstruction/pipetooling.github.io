import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5835',
  date: '2026-10-24',
  title: 'Legal desk: the owner’s mailing address and the supply houses the app already knows',
  kind: 'feature',
  roles: ['dev', 'master_technician', 'assistant', 'controller'],
  highlights: [
    'The Account tab’s property table shows the owner of record’s mailing address beside the owner, from the job’s override or the property record. The firm’s portal and both printed packets carry the same column, so a case no longer lists an address the app already held as still to find.',
    'The Paper tab gains Supply houses: for every job in the account that bought materials, the same card the Lien window shows, with what each house is paid and owed and when its own notice is due, from Materials → Held for suppliers.',
    'One line over the cards says it in short: “1 house owed $8,950 on 891 · 1 house, all paid on 892”. A payment the supplier books never learned of still reads owed until it is recorded in Materials.',
  ],
}

export default note
