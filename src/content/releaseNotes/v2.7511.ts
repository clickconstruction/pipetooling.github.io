import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7511',
  date: '2026-11-16',
  title: 'Lien filings from a scan: an assistant can record a filed lien and its stamped copy',
  kind: 'infra',
  highlights: [
    'A developer’s assistant can now record a filed lien on its job without a browser: the county, the recording number, the day filed and the scanned copy, which goes into the job’s Drive folder under Sent by us.',
    'It records what the Lien window records when you press Record filing, and nothing else. No copy is mailed and nobody is told.',
    'Before anything is saved it reads the scan against the Lien desk. If the paper and the desk disagree on the claim, the months, the notice day, the property or the owner, it stops and says which, and how to fix it.',
    'A whole visit to the clerk can be checked in one pass. Each lien is then recorded on its own, so one that is held never stops the rest.',
  ],
}

export default note
