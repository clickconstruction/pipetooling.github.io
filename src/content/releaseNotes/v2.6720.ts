import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6720',
  date: '2026-11-08',
  title: 'Legal desk: a document for counsel alone',
  kind: 'feature',
  highlights: [
    'Tick Counsel-only when you put a paper on Documents for the firm, or pick Counsel-only from the row’s ⋯ menu. The row wears a lock. Not counsel-only after all takes it off.',
    'The firm still reads the document on its portal, with the lock and a line saying it is for counsel alone. The printed packet, which may go to a third party, leaves it out and says how many it left.',
    'The dev seat and the agent never read a counsel-only document or its words. A search names the hit as counsel-only and nothing more. A dev signed in still reads it, as on the HR file.',
    'The dev seat files one with counsel_only on plan_matter_document, and a file off a mail takes the same mark.',
  ],
}

export default note
