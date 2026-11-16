import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7510',
  date: '2026-11-16',
  title: 'Lien filings from a scan: the groundwork for recording them without a browser',
  kind: 'infra',
  highlights: [
    'The database has a private holding place for a scanned file on its way into a job’s Drive folder. Only a developer’s own key reaches it, and a file leaves it once it is filed.',
    'The rule that fills a lien affidavit from a job now lives in one small place, so the Lien desk, the job’s Lien window and the developer tools all read the same one.',
    'Nothing changes on a screen yet. The next update lets an assistant record a filed lien and its scanned copy on the right job.',
  ],
}

export default note
