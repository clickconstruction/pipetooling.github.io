/**
 * GC mode design spike: the notary block under the contractor's signature on a pay application's
 * 702 (the owner, 2026-10-04, question 12). One block for ours to the owner and a trade's to us; the
 * Building lane renders it in the trade's window, in Spanish when the trade reads the portal in
 * Spanish (the lines are on the Portal lane's list for a native speaker). Blank lines, as the form
 * has them: the notary fills them in by hand. Texas, where our jobs are. The downloads stay English:
 * they are the AIA form itself.
 */
export function GcPayAppNotary({ fontSize = '0.78rem', lang = 'en' }: { fontSize?: string; lang?: 'en' | 'es' }) {
  const blank = (width: string) => (
    <span style={{ display: 'inline-block', width, borderBottom: '1px solid currentColor', height: '0.9em', verticalAlign: 'baseline' }} />
  )
  return (
    <div style={{ display: 'grid', gap: '0.4rem', fontSize, marginTop: '0.6rem' }}>
      {lang === 'es' ? (
        <>
          <div>Estado de Texas. Condado de {blank('8rem')}.</div>
          <div>
            Suscrito y jurado ante mí este {blank('2.5rem')} día de {blank('6rem')} de 20{blank('1.5rem')}.
          </div>
          <div>Notario público: {blank('10rem')}</div>
          <div>Mi comisión vence: {blank('7rem')}</div>
        </>
      ) : (
        <>
          <div>State of Texas. County of {blank('8rem')}.</div>
          <div>
            Subscribed and sworn to before me this {blank('2.5rem')} day of {blank('6rem')}, 20{blank('1.5rem')}.
          </div>
          <div>Notary public: {blank('10rem')}</div>
          <div>My commission expires: {blank('7rem')}</div>
        </>
      )}
    </div>
  )
}
