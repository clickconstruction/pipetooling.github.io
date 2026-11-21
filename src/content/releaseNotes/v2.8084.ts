import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.8084',
  date: '2026-11-20',
  title: 'Send for signature: a refusal shows beside the Send press',
  kind: 'fix',
  highlights: [
    'When Send email is refused, the reason now shows right above Cancel and Send email. It used to show under the heading, far above what was on screen, so the press looked dead.',
    'The same holds in People → Contracts and in Documents → Agreements, for Send a paper and Send again.',
  ],
}

export default note
