import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2431',
  date: '2026-08-28',
  title: 'A twin seat any AI can plug into',
  kind: 'infra',
  highlights: [
    'New twin-mcp server: agents from any provider (Claude, Grok, GPT…) connect over the Model Context Protocol with their per-twin token and get everything a seat needs — sign-in sessions, the role brief, the app directory, missions, and a report-filing tool.',
    'It exposes no business data by itself — the work still happens in the app through the minted, banner-wearing browser session.',
  ],
}

export default note
