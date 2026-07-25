/** New report dialog (v2.1017): should closing ask "Discard this report?"
 * Dirty = the tech has actually entered something — any field value with
 * non-whitespace content. Untouched fields never appear in the map (the
 * percent slider renders '0' without writing until moved), so a fresh form
 * is clean and closing it stays one tap. */
export function hasUnsavedReportEntries(fieldValues: Record<string, string>): boolean {
  return Object.values(fieldValues).some((v) => (v ?? '').trim() !== '')
}
