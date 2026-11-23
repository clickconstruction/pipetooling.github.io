import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.8393',
  date: '2026-11-23',
  title: 'Jobs → Pipeline on a phone: the stage chips stay inside the page',
  kind: 'fix',
  highlights: [
    'On a phone, the white band behind the stage chips ran past the right edge of the screen. It now ends with the page, and the chips slide sideways inside it.',
    'The All, Needs me and Today row wraps to a second line before it would push the band wider.',
  ],
}

export default note
