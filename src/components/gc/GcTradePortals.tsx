import { useCallback, useEffect, useState } from 'react'
import { tradeLinkStatus, type TradeLinkRow, type TradeLinkVisits } from '../../lib/gc/tradePortalLinks'
import { loadTradePortalLinks } from '../../lib/gc/tradePortalLinksIo'
import type { GcState } from '../../lib/gc/types'
import { formatErrorMessage } from '../../utils/errorHandling'
import { TheirPortalControls } from './GcTheirPortal'
import { td, th } from './gcUi'

/**
 * GC mode, the trade partner portal (P1b-ii-b, to-dos/gc-mode/PORTAL_REAL_BUILD.md, decision 3): every company's
 * portal link on one list, for a dev while the portal is built, loaded at once. Each row is the same block the
 * company window shows (`GcTheirPortal.tsx`). The door opens it to the office.
 */

export function GcTradePortals({ state }: { state: GcState }) {
  const partners = [...state.partners].sort((a, b) => a.company.localeCompare(b.company))
  const ids = partners.map((p) => p.id).join(',')
  const [links, setLinks] = useState<TradeLinkRow[] | null>(null)
  const [visits, setVisits] = useState<Record<string, TradeLinkVisits>>({})
  const [problem, setProblem] = useState<string | null>(null)
  const read = useCallback(async () => {
    const got = await loadTradePortalLinks(ids ? ids.split(',') : [])
    setLinks(got.links)
    setVisits(got.visits)
  }, [ids])
  useEffect(() => {
    read().catch((e: unknown) => setProblem(formatErrorMessage(e, 'The portal links did not load.')))
  }, [read])

  return (
    <section aria-label="Trade portals" style={{ display: 'grid', gap: '0.6rem' }}>
      <div style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>
        One link per company. It opens everything the company has with us, read only for now. Only a dev makes links while the portal is built.
      </div>
      {problem && <div style={{ color: 'var(--text-red-700)', fontSize: '0.875rem' }}>{problem}</div>}
      {partners.length === 0 ? (
        <div style={{ fontSize: '0.875rem' }}>No trade partner yet. Add one on Trade partners.</div>
      ) : links === null ? (
        !problem && <div style={{ fontSize: '0.875rem' }}>Loading the links…</div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: '0.875rem' }}>
            <thead>
              <tr>
                <th style={th}>Company</th>
                <th style={th}>Their portal</th>
              </tr>
            </thead>
            <tbody>
              {partners.map((p) => (
                <tr key={p.id} data-gc-trade-portal={p.id}>
                  <td style={{ ...td, minWidth: '12rem' }}>
                    <strong>{p.company}</strong>
                    <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>{p.contact || 'no contact yet'}</div>
                  </td>
                  <td style={{ ...td, minWidth: '16rem' }}>
                    <TheirPortalControls companyId={p.id} status={tradeLinkStatus(links, p.id, visits[p.id] ?? null)} onChanged={read} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}
