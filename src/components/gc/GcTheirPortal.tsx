import { useCallback, useEffect, useState } from 'react'
import { tradePortalPath, tradePortalUrl } from '../../lib/gc/tradePortalPage'
import { tradeLinkStatus, type TradeLinkStatus } from '../../lib/gc/tradePortalLinks'
import { loadTradePortalLinks, makeTradePortalLink, turnOffTradePortalLink } from '../../lib/gc/tradePortalLinksIo'
import { PUBLIC_PREVIEW_PARAM } from '../../lib/publicViewCounting'
import { formatErrorMessage } from '../../utils/errorHandling'
import { Btn, Chip, type Tone } from './gcUi'

/**
 * GC mode, a trade partner's portal link (the Portal lane, PORTAL_REAL_BUILD.md decision 3): where it stands and
 * what a dev can do with it. Make the link, copy it, open it as the office (not counted), make a new one (the old
 * one stops working) or turn it off; the last two ask once more. `GcTheirPortal` loads one company's link and is the
 * company window's *Their portal* section (the Board's B3-c), the one place a link is made since v2.4942;
 * `TheirPortalControls` is its block, given the status already loaded.
 */

const TONE: Record<TradeLinkStatus['state'], Tone> = { none: 'grey', off: 'grey', waiting: 'amber', active: 'green' }

export function TheirPortalControls({ companyId, status, onChanged }: { companyId: string; status: TradeLinkStatus; onChanged: () => Promise<void> }) {
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
    <div style={{ display: 'grid', gap: '0.35rem' }}>
      <div>
        <Chip tone={TONE[status.state]}>{status.word}</Chip>
        <div style={{ color: 'var(--text-600)', fontSize: '0.8rem', marginTop: '0.2rem' }}>{status.words}</div>
        {note && <div style={{ color: 'var(--text-green-800)', fontSize: '0.8rem', marginTop: '0.2rem' }}>{note}</div>}
        {problem && <div style={{ color: 'var(--text-red-700)', fontSize: '0.8rem', marginTop: '0.2rem' }}>{problem}</div>}
      </div>
      {asking ? (
        <span style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap', alignItems: 'center' }}>
          <span style={{ fontSize: '0.8rem' }}>{asking === 'remake' ? 'The old link stops working.' : 'The link stops working.'}</span>
          <Btn
            kind="primary"
            disabled={busy}
            onClick={() => (asking === 'remake' ? run(() => makeTradePortalLink(companyId, true), 'A new link is on. Send it to them.') : run(() => turnOffTradePortalLink(companyId), 'The link is off.'))}
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
        <span>
          <Btn kind="primary" disabled={busy} onClick={() => run(() => makeTradePortalLink(companyId, false), 'The link is on. Copy it and send it with the ask to quote.')}>
            Make the link
          </Btn>
        </span>
      )}
    </div>
  )
}

/** One company's portal link, loaded on its own: the company window's *Their portal*. */
export function GcTheirPortal({ companyId }: { companyId: string }) {
  const [status, setStatus] = useState<TradeLinkStatus | null>(null)
  const [problem, setProblem] = useState<string | null>(null)
  const read = useCallback(async () => {
    const got = await loadTradePortalLinks([companyId])
    setStatus(tradeLinkStatus(got.links, companyId, got.visits[companyId] ?? null))
  }, [companyId])
  useEffect(() => {
    setStatus(null)
    setProblem(null)
    read().catch((e: unknown) => setProblem(formatErrorMessage(e, 'The portal link did not load.')))
  }, [read])
  if (problem) return <div style={{ color: 'var(--text-red-700)', fontSize: '0.85rem' }}>{problem}</div>
  if (!status) return <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Loading the link…</div>
  return <TheirPortalControls companyId={companyId} status={status} onChanged={read} />
}
