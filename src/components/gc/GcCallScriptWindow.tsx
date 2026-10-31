import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { useOptionalAuth } from '../../hooks/useAuth'
import {
  CALL_SCRIPT_COPIED,
  CALL_SCRIPT_COPY,
  CALL_SCRIPT_HREF,
  CALL_SCRIPT_NEW_TAB,
  CALL_SCRIPT_SUB,
  CALL_SCRIPT_THEN,
  CALL_SCRIPT_TITLE,
  callScript,
  callScriptText,
  callerFirstName,
  type CallScriptJob,
} from '../../lib/gc/callScript'

/**
 * The call script window (v2.5556): what to say when phoning a company new to us, from the Call
 * script button at the right of Trade partners' strip. The words are `callScript.ts`'s, with the
 * signed-in person's first name set in bold. Copy puts the whole script on the clipboard; Open in
 * a new tab opens Trade partners with the window already open (`?script=1`), so the script can sit
 * beside the app while the call is made. Esc, the ×, Close and a press on the dim close it.
 */
const button: CSSProperties = {
  font: 'inherit',
  fontSize: '0.85rem',
  padding: '0.35rem 0.75rem',
  borderRadius: 6,
  border: '1px solid var(--border-strong)',
  background: 'var(--surface)',
  color: 'var(--text-700)',
  cursor: 'pointer',
  textDecoration: 'none',
  display: 'inline-flex',
  alignItems: 'center',
  gap: '0.4rem',
}

export function GcCallScriptWindow({ onClose, job = null }: { onClose: () => void; job?: CallScriptJob | null }) {
  const auth = useOptionalAuth()
  const parts = callScript(callerFirstName(auth?.profileName), undefined, job)
  const [copied, setCopied] = useState(false)
  const cardRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    cardRef.current?.focus({ preventScroll: true })
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  useEffect(() => {
    if (!copied) return
    const t = window.setTimeout(() => setCopied(false), 2000)
    return () => window.clearTimeout(t)
  }, [copied])

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(callScriptText(parts))
      setCopied(true)
    } catch {
      // No clipboard here: the button keeps its label and the words stay on screen to read.
    }
  }

  return (
    <div
      onClick={onClose}
      data-gc-call-script
      style={{ position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.55)', zIndex: 1250, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 'calc(0.75rem + var(--app-top-chrome, 0px)) 0.75rem 0.75rem' }}
    >
      <div
        ref={cardRef}
        role="dialog"
        aria-modal="true"
        aria-label={CALL_SCRIPT_TITLE}
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'var(--surface)',
          color: 'var(--text-base)',
          borderRadius: 10,
          width: 'min(760px, 100%)',
          maxHeight: 'min(94vh, 100%)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          border: '1px solid var(--border-strong)',
          outline: 'none',
        }}
      >
        <div style={{ padding: '0.7rem 1rem', borderBottom: '1px solid var(--border)', display: 'flex', gap: '0.6rem', alignItems: 'flex-start' }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 700, fontSize: '1.05rem' }}>{CALL_SCRIPT_TITLE}</div>
            <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>{CALL_SCRIPT_SUB}</div>
          </div>
          <button type="button" aria-label="Close the call script" onClick={onClose} style={{ border: 'none', background: 'transparent', fontSize: '1.3rem', color: 'var(--text-muted)', cursor: 'pointer', lineHeight: 1, padding: 0 }}>
            ×
          </button>
        </div>
        <div style={{ padding: '0.85rem 1rem 0.4rem', overflowY: 'auto', minHeight: 0, display: 'grid', gap: '0.85rem', fontSize: '0.95rem', lineHeight: 1.5, color: 'var(--text-700)' }}>
          {parts.map((p) => (
            <section key={p.id} aria-label={p.title} data-call-script-part={p.id} style={{ border: '1px solid var(--border)', borderRadius: 8, background: 'var(--bg-subtle)', padding: '0.6rem 0.85rem 0.7rem' }}>
              <div style={{ fontSize: '0.72rem', letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>{p.title}</div>
              {p.lines.map((segs, i) => (
                <p key={i} style={{ margin: p.asks.length && i === p.lines.length - 1 ? '0 0 0.35rem' : 0 }}>
                  {segs.map((s, j) =>
                    s.name ? (
                      <strong key={j} data-caller-name style={{ color: 'var(--text-strong)' }}>
                        {s.text}
                      </strong>
                    ) : (
                      <span key={j}>{s.text}</span>
                    ),
                  )}
                </p>
              ))}
              {p.asks.length > 0 && (
                <ul style={{ margin: 0, paddingLeft: '1.4rem', display: 'grid', gap: '0.15rem' }}>
                  {p.asks.map((a) => (
                    <li key={a}>{a}</li>
                  ))}
                </ul>
              )}
            </section>
          ))}
          <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>{CALL_SCRIPT_THEN}</div>
        </div>
        <div style={{ padding: '0.6rem 1rem 0.85rem', display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap', borderTop: '1px solid var(--border)', marginTop: '0.5rem' }}>
          <a href={CALL_SCRIPT_HREF} target="_blank" rel="noopener noreferrer" data-call-script-new-tab style={{ ...button, marginRight: 'auto' }}>
            <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
              <path d="M15 3h6v6" />
              <path d="M10 14L21 3" />
            </svg>
            {CALL_SCRIPT_NEW_TAB}
          </a>
          <button type="button" onClick={() => void copy()} style={button}>
            {copied ? CALL_SCRIPT_COPIED : CALL_SCRIPT_COPY}
          </button>
          <button type="button" onClick={onClose} style={{ ...button, background: '#2563eb', color: '#fff', border: 'none', fontWeight: 600 }}>
            Close
          </button>
        </div>
      </div>
    </div>
  )
}
