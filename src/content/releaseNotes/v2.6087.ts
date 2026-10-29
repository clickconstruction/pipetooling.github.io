import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6087',
  date: '2026-10-29',
  title: 'Stage checklists: the Pipeline reads not ready (punch list #164, PR 4)',
  kind: 'feature',
  highlights: [
    'On the Pipeline, a stage whose checklist has a question left reads not ready: an amber box before its name under the bar, and the count in the name’s hover words, such as checklist 2 of 3 answered · not ready.',
    'A stage whose checklist is filled reads as before. A stage kind with no questions carries no mark, so nothing changes until the office types the questions.',
  ],
  roles: ['dev', 'master_technician', 'assistant', 'controller', 'primary'],
}

export default note
