/**
 * The Contract window's rail (v2.4154): how this one gets signed. Three ways as radio rows — one
 * pre-picked from what the job knows — the fields the picked way needs, one button whose label
 * follows the pick, a sentence that says what pressing it does, and the two exits under it. A
 * builder's job leads with *File their subcontract* and keeps our ways one tap behind *Send ours
 * anyway*, as the Contract sweep does. Presentational: the window owns every value and act.
 */
import type { CSSProperties, ReactNode } from 'react'
import type { PaperSend, WindowWay, WindowWayButton, WindowWaysPlan } from '../../lib/jobs/contractWindowWays'

export type JobContractSigningRailProps = {
  plan: WindowWaysPlan
  way: WindowWay
  onPick: (way: WindowWay) => void
  /** A builder's job: our three ways are shown (after *Send ours anyway*). */
  oursShown: boolean
  onShowOurs: () => void
  gcName: string | null
  recipientName: string
  setRecipientName: (v: string) => void
  email: string
  setEmail: (v: string) => void
  phone: string
  setPhone: (v: string) => void
  textToo: boolean
  setTextToo: (v: boolean) => void
  cc: string
  setCc: (v: string) => void
  message: string
  setMessage: (v: string) => void
  remindersEnabled: boolean
  setRemindersEnabled: (v: boolean) => void
  paperSend: PaperSend
  setPaperSend: (v: PaperSend) => void
  sentence: string
  button: WindowWayButton
  busy: boolean
  onGo: () => void
  onCopyLink: () => void
  onFileSigned: () => void
  onNotNeeded: () => void
  /** The Not needed reasons panel, rendered by the window when it is open. */
  notNeededPanel?: ReactNode
}

const label: CSSProperties = { fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 600, paddingTop: '0.35rem' }
const input: CSSProperties = { width: '100%', boxSizing: 'border-box', padding: '0.4rem 0.55rem', border: '1px solid var(--border-strong)', borderRadius: 6, background: 'var(--surface)', color: 'inherit', font: 'inherit', fontSize: '0.85rem' }
const row: CSSProperties = { display: 'grid', gridTemplateColumns: '78px minmax(0, 1fr)', gap: '0.3rem 0.6rem', alignItems: 'start' }
const sectionHead: CSSProperties = { font: '600 0.68rem/1.2 inherit', letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--text-muted)', margin: 0 }
const btn: CSSProperties = { padding: '0.45rem 0.8rem', borderRadius: 6, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--text-700)', font: 'inherit', fontSize: '0.82rem', fontWeight: 600, cursor: 'pointer' }
const btnPrimary: CSSProperties = { ...btn, background: 'var(--text-link)', borderColor: 'var(--text-link)', color: 'white', width: '100%' }
const link: CSSProperties = { background: 'none', border: 'none', padding: 0, font: 'inherit', fontSize: '0.78rem', color: 'var(--text-link)', textDecoration: 'underline', cursor: 'pointer' }
const chip = (on: boolean): CSSProperties => ({ ...btn, padding: '0.22rem 0.6rem', fontSize: '0.75rem', borderRadius: 999, background: on ? 'var(--bg-blue-tint)' : 'var(--surface)', color: on ? 'var(--text-blue-700)' : 'var(--text-700)', borderColor: on ? 'var(--border-blue)' : 'var(--border-strong)' })

function WayRow({ option, on, onPick }: { option: WindowWaysPlan['ways'][number]; on: boolean; onPick: () => void }) {
  const off = Boolean(option.disabledReason)
  return (
    <div
      role="radio"
      aria-checked={on}
      aria-disabled={off || undefined}
      tabIndex={0}
      data-testid={`contract-way-${option.way}`}
      onClick={() => {
        if (!off) onPick()
      }}
      onKeyDown={(e) => {
        if ((e.key === ' ' || e.key === 'Enter') && !off) {
          e.preventDefault()
          onPick()
        }
      }}
      style={{
        display: 'grid',
        gridTemplateColumns: 'auto minmax(0, 1fr)',
        gap: '0.1rem 0.55rem',
        alignItems: 'start',
        padding: '0.5rem 0.65rem',
        borderRadius: 8,
        border: `1px solid ${on ? 'var(--border-blue)' : 'var(--border)'}`,
        background: on ? 'var(--bg-blue-tint)' : 'var(--surface)',
        opacity: off ? 0.6 : 1,
        cursor: off ? 'not-allowed' : 'pointer',
      }}
    >
      <span aria-hidden style={{ width: 13, height: 13, marginTop: 3, borderRadius: '50%', border: `2px solid ${on ? 'var(--text-link)' : 'var(--border-strong)'}`, background: on ? 'radial-gradient(var(--text-link) 45%, transparent 50%)' : 'transparent', gridRow: 'span 2' }} />
      <b style={{ fontSize: '0.86rem', color: on ? 'var(--text-blue-700)' : 'var(--text-700)' }}>{option.label}</b>
      <span style={{ fontSize: '0.74rem', color: off ? 'var(--text-amber-800)' : 'var(--text-muted)' }}>{option.disabledReason ?? option.detail}</span>
    </div>
  )
}

export default function JobContractSigningRail(p: JobContractSigningRailProps) {
  const ours = p.plan.demoted.length > 0 ? p.plan.demoted : p.plan.ways
  const shownWays = p.plan.demoted.length > 0 ? (p.oursShown ? [...p.plan.ways, ...p.plan.demoted] : p.plan.ways) : p.plan.ways
  const ourWayPicked = ours.some((o) => o.way === p.way)
  return (
    <div style={{ display: 'grid', gap: '0.7rem' }} data-testid="contract-rail">
      <div style={sectionHead}>How this one gets signed</div>
      <div role="radiogroup" aria-label="How this one gets signed" style={{ display: 'grid', gap: '0.4rem' }}>
        {shownWays.map((o) => (
          <WayRow key={o.way} option={o} on={o.way === p.way} onPick={() => p.onPick(o.way)} />
        ))}
        {p.plan.demoted.length > 0 && !p.oursShown ? (
          <button type="button" style={{ ...link, justifySelf: 'start' }} onClick={p.onShowOurs} data-testid="contract-send-ours">
            Send ours anyway
          </button>
        ) : null}
      </div>

      {ourWayPicked ? (
        <div style={{ display: 'grid', gap: '0.45rem', padding: '0.6rem 0.7rem', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-subtle)' }} data-testid={`contract-pane-${p.way}`}>
          <div style={row}>
            <span style={label}>Signer</span>
            <input style={input} value={p.recipientName} onChange={(e) => p.setRecipientName(e.target.value)} placeholder="Customer's full name" aria-label="Signer's name" />
          </div>
          {p.way === 'link' ? (
            <>
              <div style={row}>
                <span style={label}>Email</span>
                <input style={input} type="email" value={p.email} onChange={(e) => p.setEmail(e.target.value)} placeholder="Where the Review & sign link goes" aria-label="Signer's email" />
              </div>
              <div style={row}>
                <span style={label}>Mobile</span>
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                  <input style={{ ...input, flex: 1, minWidth: 140 }} value={p.phone} onChange={(e) => p.setPhone(e.target.value)} placeholder="Optional" aria-label="Signer's mobile" />
                  <label style={{ display: 'flex', gap: '0.3rem', alignItems: 'center', fontSize: '0.78rem', whiteSpace: 'nowrap', color: 'var(--text-700)' }}>
                    <input type="checkbox" checked={p.textToo} onChange={(e) => p.setTextToo(e.target.checked)} /> Text it too
                  </label>
                </div>
              </div>
              <div style={row}>
                <span style={label}>Copies</span>
                <input style={input} value={p.cc} onChange={(e) => p.setCc(e.target.value)} placeholder="A GC or property manager who only reads it (optional)" aria-label="Copies to" />
              </div>
              <div style={row}>
                <span style={label}>Message</span>
                <input style={input} value={p.message} onChange={(e) => p.setMessage(e.target.value)} placeholder="A line for the email (optional)" aria-label="Message for the email" />
              </div>
              <div style={row}>
                <span style={label}>Reminders</span>
                <label style={{ display: 'flex', gap: '0.35rem', alignItems: 'center', fontSize: '0.78rem', paddingTop: '0.3rem', color: 'var(--text-700)' }}>
                  <input type="checkbox" checked={p.remindersEnabled} onChange={(e) => p.setRemindersEnabled(e.target.checked)} /> Every 3 days until signed, up to 3
                </label>
              </div>
            </>
          ) : null}
          {p.way === 'here' ? (
            <div style={row}>
              <span style={label}>Their copy</span>
              <input style={input} type="email" value={p.email} onChange={(e) => p.setEmail(e.target.value)} placeholder="Email for the signed copy (optional)" aria-label="Email for the signed copy" />
            </div>
          ) : null}
          {p.way === 'paper' ? (
            <>
              <div style={row}>
                <span style={label}>Send it</span>
                <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
                  <button type="button" style={chip(p.paperSend === 'download')} aria-pressed={p.paperSend === 'download'} onClick={() => p.setPaperSend('download')}>
                    Download to print
                  </button>
                  <button type="button" style={chip(p.paperSend === 'pdf_email')} aria-pressed={p.paperSend === 'pdf_email'} onClick={() => p.setPaperSend('pdf_email')}>
                    Email the PDF
                  </button>
                </div>
              </div>
              {p.paperSend === 'pdf_email' ? (
                <div style={row}>
                  <span style={label}>Email</span>
                  <input style={input} type="email" value={p.email} onChange={(e) => p.setEmail(e.target.value)} placeholder="Where the PDF goes" aria-label="Email for the PDF" />
                </div>
              ) : null}
            </>
          ) : null}
        </div>
      ) : null}

      <div style={{ display: 'grid', gap: '0.4rem' }}>
        <button type="button" style={p.button.disabled ? { ...btnPrimary, opacity: 0.5, cursor: 'not-allowed' } : btnPrimary} disabled={p.busy || p.button.disabled} onClick={p.onGo} data-testid="contract-way-go">
          {p.busy ? p.button.busyLabel : p.button.label}
        </button>
        <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)', lineHeight: 1.4 }} data-testid="contract-way-sentence">
          {p.sentence}
          {p.way === 'link' ? (
            <>
              {' '}
              <button type="button" style={link} onClick={p.onCopyLink} disabled={p.busy}>
                Copy the link
              </button>{' '}
              to paste it anywhere.
            </>
          ) : null}
        </div>
      </div>

      <div style={{ display: 'grid', gap: '0.25rem', fontSize: '0.78rem', color: 'var(--text-muted)', borderTop: '1px solid var(--border)', paddingTop: '0.6rem' }}>
        <span>
          Already signed outside the app?{' '}
          <button type="button" style={link} onClick={p.onFileSigned} data-testid="contract-exit-file">
            File their signed contract
          </button>
        </span>
        <span>
          This job doesn&apos;t need one?{' '}
          <button type="button" style={link} onClick={p.onNotNeeded} data-testid="contract-exit-not-needed">
            Not needed…
          </button>
        </span>
      </div>
      {p.notNeededPanel ?? null}
    </div>
  )
}
