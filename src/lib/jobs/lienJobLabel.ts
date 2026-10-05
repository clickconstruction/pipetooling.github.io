/**
 * A job's label on the Lien desk is "663 · Knight Contracting" (the ledger number, a dot, the
 * job's name), built in three places that all agree. Where the number is the door to the job
 * (v2.4535) the label is drawn in its two halves; this is the one place that splits it.
 */
export function splitLienJobLabel(label: string): { number: string; name: string } {
  const at = label.indexOf(' · ')
  if (at < 0) return { number: label.trim(), name: '' }
  return { number: label.slice(0, at).trim(), name: label.slice(at + 3).trim() }
}
