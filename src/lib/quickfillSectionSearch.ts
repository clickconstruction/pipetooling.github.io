/**
 * Case-insensitive substring match of a Quickfill section label against the
 * section search box. Blank or whitespace-only search matches everything.
 */
export function matchesQuickfillSectionSearch(label: string, search: string): boolean {
  const q = search.trim().toLowerCase()
  if (q === '') return true
  return label.toLowerCase().includes(q)
}
