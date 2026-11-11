import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6900',
  date: '2026-11-10',
  title: 'A box label’s scan no longer ends on an empty page',
  kind: 'fix',
  highlights: [
    'Scanning a box label right after the app updated could leave an empty white page. The page had lost a file the update replaced, and nothing was there to catch it.',
    'Every page now sits inside a catch. It reloads the app once by itself and shows “Updating app…” while it does.',
    'When one reload does not fix it, the page says so and offers Reload and Fix app. It no longer stays empty.',
    'This covers the pages outside the signed-in app too: the box pages, a customer’s estimate, the pay link and the portals.',
  ],
}

export default note
