import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5996',
  date: '2026-10-27',
  title: 'A voice note drafts again: the request Anthropic accepts',
  kind: 'fix',
  highlights: [
    'Talk it through drafted nothing, because Anthropic refused the shape the app asked the draft in. The app now asks in a shape it accepts, so a voice note drafts the report.',
    'Each line’s number is still kept between 0 and 100 by the app before it reaches the form.',
  ],
}

export default note
