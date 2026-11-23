import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.8313',
  date: '2026-11-22',
  title: 'Papers: the ground for a sub’s company, with its workers under it',
  kind: 'infra',
  highlights: [
    'The app can now keep which company a sub or a sub’s worker works for. It is the trade company record the app already has.',
    'A person’s paper will say who they sign for. It takes the company’s name when the paper is made and each time it is sent.',
    'A leader, an assistant and the controller can now make a trade company’s copy of a paper. Only a dev could before.',
    'Nothing looks different yet. People shows a sub’s company in a later release.',
  ],
}

export default note
