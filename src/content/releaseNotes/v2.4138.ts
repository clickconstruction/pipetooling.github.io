import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4138',
  date: '2026-09-29',
  title: 'What customers see shows the sender above each sample email',
  kind: 'feature',
  highlights: [
    'Settings → What customers see now prints a From line above each sample email, beside its Subject — "Click Plumbing and Electrical <team@noreply.clicktooling.com>" for the bill, the GC statement, the price request and the rest; "Click Plumbing <…>" for the estimate, which keeps its trade name — so the office can see exactly what the inbox shows.',
    'Two older lines that named the sender caught up: GC Review\'s "share the whole week" note said an address from the old domain, and the Estimates page built its own From — both now read the same line the samples do.',
    'This closes the sender-name work: every email a customer, GC, supply house or law firm reads comes from the company, staff emails stay ClickTooling, and the build refuses a new customer email that would say otherwise.',
  ],
}

export default note
