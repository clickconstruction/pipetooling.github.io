import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2959',
  date: '2026-09-06',
  title: 'Add document → Send now: the form pick is read where the picker puts it',
  kind: 'fix',
  highlights: [
    'v2.2955 taught the Send now check about fillable forms, but it looked for the pick in the wrong place — on the live site a form still stopped with "Add contract text… before sending". The check now reads the picker\'s own selection.',
    'Verified on the live site with the Claude Test Sub after deploy.',
  ],
}

export default note
