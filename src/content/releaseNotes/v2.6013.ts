import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6013',
  date: '2026-10-28',
  title: 'What everyone sees seals the previews a screen opens inside its frames',
  kind: 'fix',
  highlights: [
    'A frame of What everyone sees that draws What customers see opens the customer previews inside itself, and until now those previews ran on the browser’s real storage, where the dev’s own session lives. A check on 2026-10-28 found every signed-in preview reading the dev’s own user row and two settings tables with that session, the contract preview calling a real RPC, and the submittal and trade-partner previews sending the session to their edge functions.',
    'Now a frame the screen itself opens is named before it loads and boots sealed too, on the frame’s own memory and invented world, so it holds no real session and reads no real row.',
    'Each sealed preview still draws its sample: on a customer’s sample page the edge-function call alone goes out, as the anonymous customer’s on the sample token, and everything else stays in the invented world. Open alone ↗ from such a preview opens it sealed as well.',
  ],
}

export default note
