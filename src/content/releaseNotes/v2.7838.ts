import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7838',
  date: '2026-11-18',
  title: 'Workflow page: opening it no longer creates a workflow',
  kind: 'fix',
  highlights: [
    'Opening a project’s Workflow page to look no longer leaves an empty workflow behind. A project with none now says No workflow on this project yet.',
    'The office sees one press there, Start a workflow. It makes the workflow and the page opens as it always has.',
    'Everyone else reads that there is no workflow yet, with no press.',
    'If the workflow cannot be started, the page says why and keeps the press so you can try again.',
  ],
}

export default note
