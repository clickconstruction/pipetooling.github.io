import { useCallback, useEffect, useState } from 'react'
import { tradePortalPath, tradePortalUrl } from '../../lib/gc/tradePortalPage'
import { tradeLinkStatus, type TradeLinkRow, type TradeLinkStatus, type TradeLinkVisits } from '../../lib/gc/tradePortalLinks'
import { loadTradePortalLinks, makeTradePortalLink, turnOffTradePortalLink } from '../../lib/gc/tradePortalLinksIo'
import type { GcState, Partner } from '../../lib/gc/types'
import { PUBLIC_PREVIEW_PARAM } from '../../lib/publicViewCounting'
import { formatErrorMessage } from '../../utils/errorHandling'
import { Btn, Chip, td, th, type Tone } from './gcUi'

/**
 * GC mode, the trade partner portal (P1b-ii-b, to-dos/gc-mode/PORTAL_REAL_BUILD.md, decision 3): each company's
 * portal link, for a dev while the portal is built. Make the link, copy it, open it as the office (not counted),
 * make a new one (the old one stops working) or turn it off. The status reads the link's rows and the company's
 * outside visits. It moves into the company window when the Board builds it; the door opens it to the office.
 */

const TONE: Record<TradeLinkStatus['state'], Tone> = { none: 'grey', off: 'grey', waiting: 'amber', active: 'green' }

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
                <th style={th} aria-label="What to do" />
              </tr>
            </thead>
            <tbody>
              {partners.map((p) => (
                <LinkRow key={p.id} partner={p} status={tradeLinkStatus(links, p.id, visits[p.id] ?? null)} onChanged={read} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}

function LinkRow({ partner, status, onChanged }: { partner: Partner; status: TradeLinkStatus; onChanged: () => Promise<void> }) {
  const [busy, setBusy] = useState(false)
  const [asking, setAsking] = useState<'remake' | 'off' | null>(null)
  const [note, setNote] = useState<string | null>(null)
  const [problem, setProblem] = useState<string | null>(null)
  const run = (what: () => Promise<unknown>, done: string) => {
    setBusy(true)
    setProblem(null)
    setNote(null)
    what()
      .then(() => onChanged())
      .then(() => {
        setAsking(null)
        setNote(done)
      })
      .catch((e: unknown) => setProblem(formatErrorMessage(e, 'That did not work.')))
      .finally(() => setBusy(false))
  }
  const copy = (token: string) => {
    navigator.clipboard
      .writeText(tradePortalUrl(window.location.origin, token))
      .then(() => setNote('Link copied. Send it with the ask to quote.'))
      .catch(() => setProblem('The link did not copy. Open it and copy the address.'))
  }
  return (
    <tr data-gc-trade-portal={partner.id}>
      <td style={{ ...td, minWidth: '12rem' }}>
        <strong>{partner.company}</strong>
        <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>{partner.contact || 'no contact yet'}</div>
      </td>
      <td style={{ ...td, minWidth: '14rem' }}>
        <Chip tone={TONE[status.state]}>{status.word}</Chip>
        <div style={{ color: 'var(--text-600)', fontSize: '0.8rem', marginTop: '0.2rem' }}>{status.words}</div>
        {note && <div style={{ color: 'var(--text-green-800)', fontSize: '0.8rem', marginTop: '0.2rem' }}>{note}</div>}
        {problem && <div style={{ color: 'var(--text-red-700)', fontSize: '0.8rem', marginTop: '0.2rem' }}>{problem}</div>}
      </td>
      <td style={td}>
        {asking ? (
          <span style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap', alignItems: 'center' }}>
            <span style={{ fontSize: '0.8rem' }}>{asking === 'remake' ? 'The old link stops working.' : 'The link stops working.'}</span>
            <Btn
              kind="primary"
              disabled={busy}
              onClick={() => (asking === 'remake' ? run(() => makeTradePortalLink(partner.id, true), 'A new link is on. Send it to them.') : run(() => turnOffTradePortalLink(partner.id), 'The link is off.'))}
            >
              {asking === 'remake' ? 'Make a new link' : 'Turn it off'}
            </Btn>
            <Btn kind="quiet" disabled={busy} onClick={() => setAsking(null)}>
              Keep it
            </Btn>
          </span>
        ) : status.token ? (
          <span style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
            <Btn kind="primary" onClick={() => copy(status.token ?? '')}>
              Copy link
            </Btn>
            <a href={`${tradePortalPath(status.token)}?${PUBLIC_PREVIEW_PARAM}=1`} target="_blank" rel="noopener noreferrer" style={{ alignSelf: 'center', fontSize: '0.85rem', color: 'var(--text-blue-500)' }}>
              Open it as the office ↗
            </a>
            <Btn kind="quiet" disabled={busy} onClick={() => setAsking('remake')}>
              Make a new link
            </Btn>
            <Btn kind="quiet" disabled={busy} onClick={() => setAsking('off')}>
              Turn it off
            </Btn>
          </span>
        ) : (
          <Btn kind="primary" disabled={busy} onClick={() => run(() => makeTradePortalLink(partner.id, false), 'The link is on. Copy it and send it with the ask to quote.')}>
            Make the link
          </Btn>
        )}
      </td>
    </tr>
  )
}
