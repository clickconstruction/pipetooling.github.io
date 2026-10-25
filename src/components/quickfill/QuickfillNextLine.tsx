/**
 * The Next line (punch list #176, change 2): one line under a station's question naming the
 * first row to act on and its verb, *Lean on TF Harper · $29,323 · 38 days*. The body sorts its
 * rows worst first and reports the first row's sentence as the metric's `nextLine`; this draws
 * it the same way on the Roller, the round and the Page. A station with nothing to say reports
 * null and the line is not drawn.
 */
export function QuickfillNextLine({ text }: { text: string }) {
  return (
    <p
      data-testid="quickfill-next-line"
      style={{ margin: '0 0 0.5rem', padding: '0.35rem 0.6rem', fontSize: '0.9375rem', color: 'var(--text)', background: 'var(--bg-blue-tint)', borderLeft: '3px solid #2563eb', borderRadius: '0 6px 6px 0' }}
    >
      <b style={{ color: 'var(--text-link)' }}>Next:</b> {text}
    </p>
  )
}
