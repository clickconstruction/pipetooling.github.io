import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7627',
  date: '2026-11-17',
  title: 'Estimates: the draft’s engine is its own piece',
  kind: 'infra',
  roles: ['dev'],
  highlights: [
    'Behind the scenes, the part of the estimate page that opens an estimate and saves a draft moved into its own file.',
    'Nothing changes on screen. A draft still saves by itself a moment after you stop typing, and Save draft still saves at once.',
    'New tests pin it: the autosave, Save draft, an estimate opened by an old link, and a new draft you leave untouched deleting itself.',
  ],
}

export default note
