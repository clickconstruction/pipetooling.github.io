/** Bid Board “Bid #” cell: trade prefix (all letters) smaller than the numeric part. */
export function BidBoardBidNumberMark({ bidPrefix, bidNumber }: { bidPrefix: string; bidNumber: string }) {
  const pref = (bidPrefix || 'B').trim() || 'B'
  return (
    <span style={{ display: 'inline-flex', alignItems: 'baseline', gap: '0.05em', font: 'inherit' }}>
      <span style={{ fontSize: '0.7em', lineHeight: 1, fontWeight: 600 }}>{pref}</span>
      <span>{bidNumber}</span>
    </span>
  )
}
