import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2455',
  date: '2026-08-28',
  title: 'Convert: search for the prospect instead of scrolling a 268-option list',
  kind: 'feature',
  highlights: [
    'The Convert tab now starts with a search box — type a few letters of the company, contact, phone, or email and pick from ranked matches, each showing its last call ("answered 3d ago") so you\'re sure it\'s the right one.',
    'With the box empty, Suggested chips list prospects who answered a call in the last 30 days — the ones most likely to be ready to convert.',
    'Prospects already marked Converted stay out of the picker, so you can\'t convert the same company twice by mistake.',
  ],
}

export default note
