import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.8103',
  date: '2026-11-20',
  title: 'Job Mode: the card says when boxes are due a count and when stickers wait for a box',
  kind: 'feature',
  highlights: [
    'Under Job calendar and Materials on site, the Job Mode card now has one small line when the site has news. It says how many boxes are due a count, in amber.',
    'The same line says how many printed stickers are ready for a box. It shows before a site’s first box, so the stickers the office handed out are the sign that material will be left there.',
    'A site with nothing due and no stickers waiting draws no line. The card is as short as before.',
    'The numbers cover the whole site and are kept on the phone, so they show with no signal.',
  ],
}

export default note
