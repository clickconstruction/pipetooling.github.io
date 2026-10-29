import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6056',
  date: '2026-10-29',
  title: 'Where files go: the office’s jobs root and folder names, the settings behind the tab',
  kind: 'feature',
  highlights: [
    'The app now keeps four settings about a job’s Drive folders: the jobs root it files under, how a job’s folder is named, how a bid’s folder is named, and whether a job’s folders are made up front or as something first lands in each.',
    'Every tool that makes a folder under the jobs root reads the same root, so moving it moves them all at once. Until the office sets one, the root a developer set stays in force.',
    'A job’s folder is named by a pattern of pieces, Job number then Job name as it ships, so a second press finds the folder the first one made.',
    'The folders press can now check a folder: it answers The app can write here, or Drive’s refusal with the address to share the folder with. The Documents tab that shows all of this ships next.',
  ],
}

export default note
