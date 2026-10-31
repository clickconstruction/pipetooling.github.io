import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6185',
  date: '2026-10-30',
  title: 'A dev’s agent files a plan set for the robots, into Drive and onto the bid',
  kind: 'feature',
  highlights: [
    'The dev MCP seat has two new verbs, plan_file_plans and apply_file_plans. The plan hands back a one-shot upload address for the PDF; the apply copies the file into Drive under the bid’s division folder, named for the project, the same folder the bid form’s Find looks in.',
    'The bid’s Plans link becomes that folder, so the robots read it, the Bid Board’s plans icon opens it, and the Plans button beside the bid’s name reads it page by page. The set is listed by name among the bid’s plan sets.',
    'The file is checked before it is filed: its size and fingerprint must match the plan, it must be a PDF, and it must fit CountTooling’s 200 pages. The readiness probe runs at the end and the reply says whether the robots can read it.',
    'Plans stay Drive links. The staged copy is removed once the file is in Drive.',
  ],
  roles: ['dev'],
}

export default note
