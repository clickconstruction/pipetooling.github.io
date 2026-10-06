import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4723',
  date: '2026-10-06',
  title: 'Cover Letter: two versions in one letter are two options, each with its own alternate',
  kind: 'feature',
  highlights: [
    'A letter with two or more base versions now reads as options the GC picks between. Each option prints its own amount in words and figures, and its alternate prices are deducts against that option, not against a sum. The letter never adds the versions up.',
    'The first version in the letter is Option 1. Mark sent today stamps its amount as the bid value, and the Bid Board, the payment schedule and the best effort number follow it. Every version still gets its own sent value. Use the arrows in step 1 to pick which version leads.',
    'Each option lists its own fixtures when the lists differ, and once when they match. Exclusions, terms and the closing print once. Alternates number across the whole letter, so a GC can say Option 2 with Alternate 2. Click any option or alternate line in the preview to reword it.',
    'The approval PDF, the printed letter and the Google Docs copy all say the same thing. The bid room signs Option 1 and offers the other options in place of it.',
  ],
}

export default note
