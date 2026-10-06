import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { Mail, Share } from 'lucide-react'
import { formatUsdNoCents } from '../../lib/jobs/jobFormatting'
import { formatYmdMonthDay } from '../../lib/jobs/billedExpectedPay'
import { lienShareScopeFacts, type LienShareScope, type LienShareScopeOption } from '../../lib/jobs/lienDeskShare'

/** Filled buttons carry a white label, so the fill is a literal that holds in both themes (the desk's FILL). */
const PRIMARY = '#2563eb'

const boxHead: CSSProperties = { fontSize: '0.62rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-muted)' }
const plainBtn: CSSProperties = { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 7, padding: '7px 13px', borderRadius: 8, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--text-700)', font: 'inherit', fontSize: '0.84rem', fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' }
const primaryBtn: CSSProperties = { ...plainBtn, padding: '8px 14px', border: '1px solid transparent', background: PRIMARY, color: '#fff' }
const linkBtn: CSSProperties = { border: 'none', background: 'none', color: 'var(--text-link)', cursor: 'pointer', font: 'inherit', fontSize: '0.78rem', fontWeight: 600, padding: '4px 2px', whiteSpace: 'nowrap' }

function scopeSub(o: LienShareScopeOption): string {
  const bits = [`${o.jobs} ${o.jobs === 1 ? 'job' : 'jobs'}`]
  if (o.firstYmd) bits.push(o.toHouses ? `first house notice by ${formatYmdMonthDay(o.firstYmd)}` : `first by ${formatYmdMonthDay(o.firstYmd)}`)
  if (o.waiting) bits.push(`${o.waiting} waiting for approval`)
  if (o.needOwner) bits.push(o.needOwner === 1 ? 'needs the owner' : `${o.needOwner} need the owner`)
  return bits.join(' · ')
}

/** What to send: the whole desk, or one GC. One button, one menu (the desk's GC picker's look). */
export function LienShareScopeMenu({ options, value, onChange, big }: { options: readonly LienShareScopeOption[]; value: LienShareScope; onChange: (s: LienShareScope) => void; big?: boolean }) {
  const [open, setOpen] = useState(false)
  const current = options.find((o) => o.key === value) ?? options[0]
  return (
    <div style={{ position: 'relative' }}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        data-lien-share-scope
        style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', minHeight: big ? 44 : undefined, padding: '7px 10px', border: '1px solid var(--border-strong)', borderRadius: 8, background: 'var(--surface)', color: 'var(--text-base)', font: 'inherit', fontSize: '0.84rem', textAlign: 'left', cursor: 'pointer' }}
      >
        {/* A phone stacks the name over its figures, so neither is cut off on a narrow screen. */}
        <span style={{ display: big ? 'grid' : 'flex', alignItems: 'baseline', gap: big ? 0 : 8, minWidth: 0, flex: '1 1 auto' }}>
          <strong style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', minWidth: 0, flex: '0 1 auto' }}>{current?.name ?? 'Everything on the desk'}</strong>
          {current ? <span style={{ color: 'var(--text-muted)', fontSize: big ? '0.78rem' : undefined, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', minWidth: 0, flex: '0 1 auto' }}>{lienShareScopeFacts(current)}</span> : null}
        </span>
        <span aria-hidden style={{ marginLeft: 'auto', color: 'var(--text-muted)' }}>▾</span>
      </button>
      {open ? (
        <>
          <div onClick={() => setOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 5 }} />
          <div role="menu" aria-label="What to send" style={{ position: 'absolute', left: 0, right: 0, top: 'calc(100% + 4px)', zIndex: 6, maxHeight: 'min(380px, 55dvh)', overflowY: 'auto', background: 'var(--surface)', border: '1px solid var(--border-strong)', borderRadius: 8, boxShadow: '0 10px 25px -5px rgba(0,0,0,0.25)' }}>
            {options.map((o, i) => (
              <button
                key={o.key}
                type="button"
                role="menuitemradio"
                aria-checked={o.key === value}
                className="lienShareItem"
                data-lien-share-scope-option={o.key}
                onClick={() => {
                  onChange(o.key)
                  setOpen(false)
                }}
                style={{ display: 'grid', gap: 1, width: '100%', padding: '8px 12px', border: 'none', borderTop: i === 0 ? 'none' : '1px solid var(--border)', textAlign: 'left', font: 'inherit', color: 'var(--text-base)', cursor: 'pointer' }}
              >
                <span style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                  <strong style={{ fontSize: '0.84rem' }}>{o.name}</strong>
                  <strong style={{ marginLeft: 'auto', fontSize: '0.84rem', fontVariantNumeric: 'tabular-nums' }}>{formatUsdNoCents(o.owed)}</strong>
                </span>
                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{scopeSub(o)}</span>
              </button>
            ))}
          </div>
        </>
      ) : null}
    </div>
  )
}

export type LienDeskSharePanelProps = {
  isMobile: boolean
  /** "2:14 PM": when the numbers were read. */
  asOfWords: string
  options: readonly LienShareScopeOption[]
  scope: LienShareScope
  onScope: (s: LienShareScope) => void
  /** The message as it will be sent: the text, then the link. */
  message: string
  /** The browser has a share sheet (phones, iPads, Safari on a Mac): the main button opens it. */
  canShare: boolean
  onSend: () => void
  onCopy: () => void
  onEmail: () => void
  /** The firm's live portal link, when the office has made one; `url` null when its address is no longer readable (item 22). */
  firm: { firmName: string; url: string | null } | null
  onCopyFirm: () => void
  onClose: () => void
}

/**
 * Share where the liens stand (v2.4311): the panel under the desk's Share button (a sheet on a
 * phone). What to send, the message exactly as it goes, and the ways out: the share sheet (or a
 * copy where there is none), the team email, a plain copy, and counsel's live portal.
 */
export default function LienDeskSharePanel(p: LienDeskSharePanelProps) {
  const sendRef = useRef<HTMLButtonElement | null>(null)
  const onCloseRef = useRef(p.onClose)
  onCloseRef.current = p.onClose
  useEffect(() => {
    sendRef.current?.focus()
    // Capture phase: Escape closes the panel alone, never the desk under it.
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      e.preventDefault()
      e.stopPropagation()
      onCloseRef.current()
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [])

  const sheet: CSSProperties = p.isMobile
    ? { position: 'fixed', left: 0, right: 0, bottom: 'var(--app-bottom-chrome, 0px)', maxHeight: 'calc(100dvh - var(--app-top-chrome, 0px) - var(--app-bottom-chrome, 0px) - 3.5rem)', borderRadius: '16px 16px 0 0', boxShadow: '0 -10px 30px -10px rgba(0,0,0,0.35)' }
    : { position: 'absolute', right: 0, top: 'calc(100% + 8px)', width: 'min(460px, calc(100vw - 2rem))', maxHeight: 'calc(100dvh - 9rem - var(--app-bottom-chrome, 0px))', borderRadius: 10, border: '1px solid var(--border-strong)', boxShadow: '0 14px 30px -6px rgba(0,0,0,0.3)' }

  return (
    <>
      <div onClick={p.onClose} aria-hidden style={p.isMobile ? { position: 'fixed', inset: 0, zIndex: 29, background: 'rgba(17,24,39,0.42)' } : { position: 'fixed', inset: 0, zIndex: 29 }} />
      <div role="dialog" aria-label="Share where the liens stand" data-lien-share-panel style={{ ...sheet, zIndex: 30, display: 'grid', gridTemplateRows: 'auto auto minmax(0, 1fr) auto', gridTemplateColumns: 'minmax(0, 1fr)', background: 'var(--surface)', color: 'var(--text-base)', textAlign: 'left', fontWeight: 400 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, padding: p.isMobile ? '14px 16px 6px' : '12px 14px 6px 16px' }}>
          <strong style={{ fontSize: p.isMobile ? '1rem' : '0.92rem' }}>Share where the liens stand</strong>
          <span style={{ marginLeft: 'auto', fontSize: '0.72rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>as of {p.asOfWords}</span>
          <button type="button" onClick={p.onClose} aria-label="Close" style={{ border: 'none', background: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '1.15rem', lineHeight: 1, padding: '0 2px', minWidth: p.isMobile ? 32 : undefined }}>
            ×
          </button>
        </div>
        <div style={{ padding: '4px 16px 10px', display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: 4 }}>
          <div style={boxHead}>What to send</div>
          <LienShareScopeMenu options={p.options} value={p.scope} onChange={p.onScope} big={p.isMobile} />
        </div>
        <div style={{ padding: '0 16px', minHeight: 0, display: 'grid', gridTemplateRows: 'auto minmax(0, 1fr)', gridTemplateColumns: 'minmax(0, 1fr)' }}>
          <div style={{ ...boxHead, marginBottom: 4 }}>The message</div>
          <div data-lien-share-preview tabIndex={0} aria-label="The message" style={{ border: '1px solid var(--border)', borderRadius: 9, background: 'var(--bg-subtle)', padding: '10px 12px', fontSize: '0.8rem', lineHeight: 1.45, whiteSpace: 'pre-line', overflowWrap: 'anywhere', overflowY: 'auto', minHeight: 0, maxHeight: p.isMobile ? undefined : 360 }}>
            {p.message}
          </div>
        </div>
        <div style={{ padding: p.isMobile ? '12px 16px 16px' : '12px 16px 14px', display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: 8, borderTop: p.isMobile ? '1px solid var(--border)' : undefined, marginTop: p.isMobile ? 10 : 0 }}>
          <div style={{ display: p.isMobile ? 'grid' : 'flex', gridTemplateColumns: p.isMobile ? '1fr auto' : undefined, gap: 8, alignItems: 'center' }}>
            <button ref={sendRef} type="button" onClick={p.onSend} data-lien-share-send style={{ ...primaryBtn, gridColumn: p.isMobile ? '1 / -1' : undefined, minHeight: p.isMobile ? 48 : undefined, fontSize: p.isMobile ? '0.95rem' : primaryBtn.fontSize }}>
              <Share size={p.isMobile ? 18 : 15} aria-hidden />
              {p.canShare ? 'Send…' : 'Copy the text'}
            </button>
            <button type="button" onClick={p.onEmail} data-lien-share-email style={{ ...plainBtn, minHeight: p.isMobile ? 44 : undefined, gridColumn: p.isMobile && !p.canShare ? '1 / -1' : undefined }}>
              <Mail size={15} aria-hidden />
              Email a teammate…
            </button>
            {p.canShare ? (
              <button type="button" onClick={p.onCopy} data-lien-share-copy style={p.isMobile ? { ...plainBtn, minHeight: 44 } : { ...linkBtn, marginLeft: 'auto', fontSize: '0.8rem' }}>
                Copy
              </button>
            ) : null}
          </div>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', lineHeight: 1.4 }}>
            {p.canShare ? 'Send… opens the share sheet: Messages, Mail or any app.' : 'Paste it into a text, an email or a chat.'} The link opens the Lien desk after sign-in. It carries no names or money.
          </div>
          {p.firm ? (
            <div data-lien-share-firm style={{ fontSize: '0.72rem', color: 'var(--text-muted)', lineHeight: 1.4, borderTop: '1px solid var(--border)', paddingTop: 8 }}>
              Counsel already sees every lien, live, on the firm’s portal.{' '}
              {p.firm.url ? (
                <button type="button" onClick={p.onCopyFirm} style={{ ...linkBtn, fontSize: '0.72rem', padding: 0 }}>
                  Copy the firm’s link ›
                </button>
              ) : (
                <span data-lien-share-firm-desk>To send the firm its link, use Send the link on the Legal desk’s Firm’s link card.</span>
              )}
            </div>
          ) : null}
        </div>
      </div>
    </>
  )
}
