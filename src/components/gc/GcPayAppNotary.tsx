/**
 * GC mode design spike: the notary block under the contractor's signature on a pay application's
 * 702 (the owner, 2026-10-04, question 12). One block for ours to the owner and a trade's to us; the
 * Building lane renders it in the trade's window. Blank lines, as the form has them: the notary
 * fills them in by hand. Texas, where our jobs are.
 */
export function GcPayAppNotary({ fontSize = '0.78rem' }: { fontSize?: string }) {
  const blank = (width: string) => (
    <span style={{ display: 'inline-block', width, borderBottom: '1px solid currentColor', height: '0.9em', verticalAlign: 'baseline' }} />
  )
  return (
    <div style={{ display: 'grid', gap: '0.4rem', fontSize, marginTop: '0.6rem' }}>
      <div>
        State of Texas. County of {blank('8rem')}.
      </div>
      <div>
        Subscribed and sworn to before me this {blank('2.5rem')} day of {blank('6rem')}, 20{blank('1.5rem')}.
      </div>
      <div>Notary public: {blank('10rem')}</div>
      <div>My commission expires: {blank('7rem')}</div>
    </div>
  )
}
