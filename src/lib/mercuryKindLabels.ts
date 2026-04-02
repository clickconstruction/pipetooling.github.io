/** Human-readable labels for Mercury transaction `kind` API strings (display only; store/filter raw values). */
const MERCURY_KIND_LABELS: Record<string, string> = {
  debitCardTransaction: 'Debit Card',
}

export function formatMercuryKind(kind: string): string {
  return MERCURY_KIND_LABELS[kind] ?? kind
}
