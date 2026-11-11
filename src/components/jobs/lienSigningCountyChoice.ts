import { useMemo, useState } from 'react'
import type { PhysicalInvoiceIssuer } from '../../lib/physicalInvoiceIssuer'
import { withSigningCounty } from '../../lib/jobs/lienSigningCounty'

/**
 * The county a lien paper is signed in, for this print (punch list #314). The box opens on the county Settings hold
 * and can be typed over; nothing is saved, so the next visit opens on Settings again. `issuer` is the issuer the paper
 * is filled from with that county on it.
 */
export function useLienSigningCounty(issuer: PhysicalInvoiceIssuer | null): { county: string; setCounty: (county: string) => void; issuer: PhysicalInvoiceIssuer | null } {
  // null until someone types: the box follows Settings, which can load after the first draw.
  const [typed, setTyped] = useState<string | null>(null)
  const county = typed ?? (issuer?.signingCounty ?? '').trim()
  const printIssuer = useMemo(() => withSigningCounty(issuer, typed), [issuer, typed])
  return { county, setCounty: setTyped, issuer: printIssuer }
}
