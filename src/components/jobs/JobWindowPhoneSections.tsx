import { useState, type CSSProperties, type ReactNode } from 'react'
import { useToastContext } from '../../contexts/ToastContext'
import { usePromptDialog } from '../../contexts/ConfirmDialogContext'
import { openInExternalBrowser } from '../../lib/openInExternalBrowser'
import { whenWords } from '../../lib/messages/thread'
import type { JobActivityMessage } from '../../lib/jobs/jobActivityMessages'
import { newestCustomerLines, openThreadWords, threadRows } from '../../lib/jobs/jobWindowPhoneSections'
import type { ThreadSummary } from '../../lib/jobs/threadSummary'
import CustomerPortalGlobeButton from '../customers/CustomerPortalGlobeButton'

/**
 * The Job tab's sections on a phone (punch list #355, PR B, v2.7278): a section title with a band above it, rows of
 * a label and its answer with the act as blue words at the end, a fold under More on this job, the Who section
 * (the number and the address as presses with Text and Copy beside them, the customer's three links as presses with
 * their words), and the thread (three labelled rows, the newest two messages as bubbles, the door to the thread).
 * The words come from `jobWindowPhoneSections.ts`; the desk draws none of this.
 */

const BLUE: CSSProperties = { padding: 0, border: 'none', background: 'none', font: 'inherit', fontWeight: 700, color: 'var(--text-link)', cursor: 'pointer' }
const PRESS: CSSProperties = { minHeight: 44, borderRadius: 10, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--text-strong)', font: 'inherit', fontWeight: 700, fontSize: '0.9375rem', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem', padding: '0 0.7rem', minWidth: 0 }

export function PhoneSectionTitle({ children, right, first = false }: { children: ReactNode; right?: ReactNode; first?: boolean }) {
  return (
    <div
      data-phone-section=""
      style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', margin: first ? '0.25rem -0.9rem 0.5rem' : '1.1rem -0.9rem 0.5rem', padding: '0.6rem 0.9rem 0.3rem', borderTop: first ? 'none' : '6px solid var(--bg-subtle)' }}
    >
      <span aria-hidden style={{ width: 4, height: 18, borderRadius: 2, background: '#2563eb', flex: 'none' }} />
      <h3 style={{ margin: 0, fontSize: '1.0625rem', fontWeight: 800, color: 'var(--text-strong)', minWidth: 0 }}>{children}</h3>
      {right ? <span style={{ marginLeft: 'auto', flex: 'none' }}>{right}</span> : null}
    </div>
  )
}

/** A labelled row: the label at the left, the answer at the right with its quiet line and its act in blue words. */
export function PhoneRow({ label, value, sub, act, onAct, testId }: { label: string; value: ReactNode; sub?: ReactNode; act?: string | null; onAct?: () => void; testId?: string }) {
  return (
    <div data-testid={testId} style={{ display: 'grid', gridTemplateColumns: '92px minmax(0, 1fr)', gap: '2px 10px', alignItems: 'start', padding: '0.6rem 0', minHeight: 44, borderBottom: '1px solid var(--border)' }}>
      <span style={{ color: 'var(--text-muted)', fontSize: '0.8125rem', fontWeight: 600, paddingTop: 2 }}>{label}</span>
      <span style={{ fontSize: '0.9375rem', fontWeight: 600, color: 'var(--text-strong)', minWidth: 0 }}>
        {value}
        {sub || act ? (
          <span style={{ display: 'block', fontWeight: 400, color: 'var(--text-muted)', fontSize: '0.8125rem', marginTop: 2 }}>
            {sub}
            {sub && act ? ' ' : null}
            {act && onAct ? (
              <button type="button" onClick={onAct} style={{ ...BLUE, fontSize: '0.8125rem' }}>
                {act}
              </button>
            ) : null}
          </span>
        ) : null}
      </span>
    </div>
  )
}

/** A fold under More on this job: a 44 px row with the title and a count, the content under it while open. */
export function PhoneFold({ title, count, open, onToggle, children }: { title: string; count?: string; open: boolean; onToggle: () => void; children: ReactNode }) {
  return (
    <div data-phone-fold={title} data-open={open ? '' : undefined} style={{ border: '1px solid var(--border)', borderRadius: 10, marginBottom: 6 }}>
      <button type="button" onClick={onToggle} aria-expanded={open} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', width: '100%', minHeight: 44, padding: '0.5rem 0.75rem', border: 'none', background: 'none', font: 'inherit', fontWeight: 700, fontSize: '0.9375rem', color: 'var(--text-strong)', textAlign: 'left', cursor: 'pointer' }}>
        <span style={{ minWidth: 0 }}>{title}</span>
        {count ? <span style={{ marginLeft: 'auto', color: 'var(--text-muted)', fontWeight: 600, fontSize: '0.8125rem', whiteSpace: 'nowrap' }}>{count}</span> : null}
        <span aria-hidden style={{ marginLeft: count ? 0 : 'auto', color: 'var(--text-faint)', transform: open ? 'rotate(90deg)' : undefined, transition: 'transform 120ms' }}>
          ›
        </span>
      </button>
      {/* Kept mounted: a draft typed in a fold survives its close. */}
      <div style={open ? { padding: '0 0.75rem 0.75rem' } : { display: 'none' }}>{children}</div>
    </div>
  )
}

/** The customer on a phone: the name, then the number and the address as presses with Text and Copy, then the three links. */
export function JobWindowWho({
  name,
  phone,
  email,
  customerId,
  gcName,
  developmentName,
  onOpenDevelopment,
  onText,
  onEmail,
  links,
}: {
  name: string
  phone: string
  email: string
  customerId: string | null
  gcName: string
  developmentName: string
  onOpenDevelopment?: () => void
  /** The customer's sheet on Text; absent, the 💬 is not drawn. */
  onText?: () => void
  /** The customer's sheet on Email; absent, the address is copied. */
  onEmail?: () => void
  /** Customer Files and Customer Photos: the link, or the add-link box for the roles that may; absent, not drawn. */
  links: Array<{ key: 'files' | 'photos'; label: string; url: string; onAdd?: () => void }>
}) {
  const { showToast } = useToastContext()
  const promptDialog = usePromptDialog()
  const copy = async (what: 'phone' | 'email') => {
    const value = what === 'phone' ? phone : email
    if (!value) return
    try {
      await navigator.clipboard.writeText(value)
      showToast(what === 'phone' ? 'Phone number copied' : 'Email address copied', 'success')
    } catch {
      await promptDialog({ title: what === 'phone' ? 'Copy the phone number' : 'Copy the email address', message: 'The app could not reach the clipboard. Select it below and copy it.', defaultValue: value, confirmLabel: 'I copied it' })
    }
  }
  const square: CSSProperties = { ...PRESS, width: 52, padding: 0, flex: 'none' }
  const wide: CSSProperties = { ...PRESS, justifyContent: 'flex-start', flex: '1 1 auto', minWidth: 0 }
  const verb: CSSProperties = { marginLeft: 'auto', fontSize: '0.6875rem', color: 'var(--text-muted)', fontWeight: 700, paddingLeft: 8, flex: 'none' }
  const value: CSSProperties = { minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--text-link)' }
  return (
    <div data-testid="job-window-who" style={{ display: 'grid', gap: 6 }}>
      <div style={{ fontSize: '1.0625rem', fontWeight: 700, color: 'var(--text-strong)', wordBreak: 'break-word' }}>{name || '[missing customer name]'}</div>
      {gcName ? <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>GC: {gcName}</div> : null}
      {developmentName ? (
        onOpenDevelopment ? (
          <button type="button" onClick={onOpenDevelopment} style={{ ...BLUE, fontSize: '0.8125rem', fontWeight: 600, textAlign: 'left' }}>
            {developmentName} · Open ›
          </button>
        ) : (
          <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>{developmentName}</div>
        )
      ) : null}
      <div style={{ display: 'flex', gap: 6 }}>
        {phone ? (
          <>
            <button type="button" onClick={() => openInExternalBrowser(`tel:${phone}`)} aria-label={`Call ${phone}`} style={wide}>
              📞 <span style={value}>{phone}</span>
              <span style={verb}>CALL</span>
            </button>
            {onText ? (
              <button type="button" onClick={onText} aria-label="Text the customer" title="Text the customer from the office" style={square}>
                💬
              </button>
            ) : null}
            <button type="button" onClick={() => void copy('phone')} aria-label="Copy the phone number" title="Copy the phone number" style={square}>
              ⧉
            </button>
          </>
        ) : (
          <span style={{ ...wide, color: 'var(--text-faint)', borderStyle: 'dashed', cursor: 'default' }}>📞 no phone</span>
        )}
      </div>
      <div style={{ display: 'flex', gap: 6 }}>
        {email ? (
          <>
            <button type="button" onClick={onEmail ?? (() => void copy('email'))} aria-label={onEmail ? `Email ${email}` : `Copy ${email}`} style={wide}>
              ✉ <span style={value}>{email}</span>
              <span style={verb}>EMAIL</span>
            </button>
            <button type="button" onClick={() => void copy('email')} aria-label="Copy the email address" title="Copy the email address" style={square}>
              ⧉
            </button>
          </>
        ) : (
          <span style={{ ...wide, color: 'var(--text-faint)', borderStyle: 'dashed', cursor: 'default' }}>✉ no email</span>
        )}
      </div>
      {(customerId && name) || links.length ? (
        <div style={{ display: 'grid', gridTemplateColumns: `repeat(${(customerId && name ? 1 : 0) + links.length}, minmax(0, 1fr))`, gap: 6 }}>
          {customerId && name ? (
            <span
              role="presentation"
              style={{ ...PRESS, color: 'var(--text-link)' }}
              data-testid="job-window-who-portal"
              // The whole press opens the portal window: a tap on the word reaches the globe's own button.
              onClick={(e) => {
                const globe = e.currentTarget.querySelector('button')
                if (globe && e.target !== globe && !globe.contains(e.target as Node)) globe.click()
              }}
            >
              <CustomerPortalGlobeButton customerId={customerId} customerName={name} size={16} />
              Portal
            </span>
          ) : null}
          {links.map((l) => {
            const has = l.url !== ''
            return (
              <button
                key={l.key}
                type="button"
                disabled={!has && !l.onAdd}
                onClick={() => (has ? openInExternalBrowser(l.url) : l.onAdd?.())}
                aria-label={has ? `${l.label}: open` : `${l.label}: no link yet, set it`}
                style={{ ...PRESS, color: has ? 'var(--text-link)' : 'var(--text-muted)' }}
              >
                {l.key === 'files' ? '▲' : '🖼'} {l.label}
                {!has ? <span style={{ fontSize: '0.6875rem', fontWeight: 600 }}>· set</span> : null}
              </button>
            )
          })}
        </div>
      ) : null}
    </div>
  )
}

/** The thread on a phone: Last word, They promised and We owe them as rows, the newest two messages, the door to the thread. */
export function JobWindowThread({
  summary,
  loading,
  customerLines,
  nowIso,
  onOpenHref,
  onOpenThread,
}: {
  summary: ThreadSummary | null
  loading: boolean
  customerLines: readonly JobActivityMessage[] | null | undefined
  nowIso: string
  /** A line's own thread, opened at the line. */
  onOpenHref: (href: string) => void
  /** The customer's thread at its reply box. */
  onOpenThread: () => void
}) {
  const [showing, setShowing] = useState(false)
  const rows = summary ? threadRows(summary.lines) : []
  const bubbles = newestCustomerLines(customerLines)
  return (
    <div data-testid="job-window-thread">
      {!summary && loading ? <p style={{ margin: '0.5rem 0', fontSize: '0.8125rem', color: 'var(--text-muted)' }}>Reading the lines…</p> : null}
      {rows.map((r) => (
        <PhoneRow key={r.key} testId={`job-window-thread-${r.key}`} label={r.label} value={r.value} sub={r.sub} act={r.act} onAct={() => (r.door === 'line' && r.href ? onOpenHref(r.href) : onOpenThread())} />
      ))}
      {bubbles.length ? (
        <div style={{ display: 'grid', gap: 8, margin: '10px 0 4px' }}>
          {bubbles.map((m) => {
            const theirs = m.direction === 'in'
            return (
              <div key={m.id} data-testid="job-window-thread-bubble" style={{ maxWidth: '86%', borderRadius: 14, padding: '8px 12px', fontSize: '0.875rem', lineHeight: 1.35, color: 'var(--text-strong)', justifySelf: theirs ? 'start' : 'end', ...(theirs ? { background: 'var(--bg-amber-100)', borderBottomLeftRadius: 4 } : { background: 'var(--bg-subtle)', border: '1px solid var(--border)', borderBottomRightRadius: 4 }) }}>
                <span style={{ display: 'block', fontSize: '0.71875rem', color: 'var(--text-muted)', fontWeight: 600, marginBottom: 2 }}>
                  {theirs ? (m.contact.goesBy ?? '').trim() || m.contact.name : m.who || 'the app'} · {m.channel} · {whenWords(m.at, nowIso)}
                </span>
                {showing || m.body.length <= 160 ? m.body : `${m.body.slice(0, 160)}…`}
                {m.body.length > 160 && !showing ? (
                  <button type="button" onClick={() => setShowing(true)} style={{ ...BLUE, fontSize: '0.8125rem', marginLeft: 4 }}>
                    more
                  </button>
                ) : null}
              </div>
            )
          })}
        </div>
      ) : null}
      {summary ? (
        <div style={{ textAlign: 'center', padding: '6px 0 2px' }}>
          <button type="button" onClick={onOpenThread} style={{ ...BLUE, fontSize: '0.875rem' }}>
            {openThreadWords(summary.counts.lines)}
          </button>
        </div>
      ) : null}
    </div>
  )
}
