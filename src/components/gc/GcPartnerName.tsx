import { useCompanyOpener } from './gcCompanyOpener'

/**
 * GC mode, the real build (the Board's B3-c), from the design spike's `PartnerName`
 * (`GcCompanyFile.tsx`): a trade company's name that opens its window wherever the name shows.
 */

const link = { background: 'none', border: 'none', padding: 0, font: 'inherit', cursor: 'pointer', textDecoration: 'underline', textUnderlineOffset: 3 } as const

/** A trade company's name that opens its window. Plain bold text where no window can open. */
export function PartnerName({ partnerId, company }: { partnerId: string; company: string }) {
  const opener = useCompanyOpener()
  if (!opener) return <strong>{company}</strong>
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation()
        opener.openPartner(partnerId)
      }}
      title={`Open ${company}: how they answer, who gets our emails, and their work with us`}
      data-gc-company-name={partnerId}
      style={{ ...link, color: 'var(--text-base)', fontWeight: 700, textDecorationColor: 'var(--border-strong)' }}
    >
      {company}
    </button>
  )
}
