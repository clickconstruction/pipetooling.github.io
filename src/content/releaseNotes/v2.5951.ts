import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5951',
  date: '2026-10-26',
  title: 'Empty lists in Materials, Banking and Settings name the next press',
  kind: 'feature',
  highlights: [
    'Materials: an empty Parts Book, Assembly Book, PO Builder or Purchase Orders list offers its own button, like Add Part, + Add Assembly or Create PO. A search or a filter with no match quotes what you typed and offers Clear the search or Clear the filters.',
    'Supply houses: a house with no invoices offers Add Invoice, a house with nothing unpaid offers Show paid invoices, and the aging table says Nothing unpaid when every invoice is settled.',
    'Banking: the Accounting and Drag Sort tables say when the Banking filters hide every row and offer Clear the filters. Empty rules, labels, tags and saved runs offer New rule, Add Accounting Label, Reset to defaults or Check against bank statements.',
    'Settings: Service types, Clauses, Sample accounts, Contracts, the Customer page, Deleted records, Usage and the People lists each say what fills them, with the press or a link to the page that does.',
  ],
}

export default note
