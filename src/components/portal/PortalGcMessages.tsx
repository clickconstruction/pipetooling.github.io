import { useContext, useState, type CSSProperties } from 'react'
import { sampleStateFromToken } from '../../lib/customerSampleMode'
import type { PageWords, PortalLang } from '../../lib/portal/pageWords'
import { threadRows, type PortalThreadLine } from '../../lib/portal/portalThread'
import { CARD, COPPER, HAIR, INK, MUTED } from '../../lib/portal/portalTheme'
import { PortalPreviewContext } from './portalPreviewContext'
import { portalFailure, portalFailureCause, portalFailureKind, type PortalFailureCause } from '../../lib/portal/portalFailure'
import { PortalFailureNote } from './PortalFailureNote'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string

/**
 * Messages, cut 8e: the Messages tab of the customer's page (the prototype's `portalMessagesHtml`, v1.178). The same
 * conversation as their texts and emails with us, oldest first, each line theirs or ours with who, the day and how it
 * came; then a box to write to us. Their line posts to submit-portal-request as `portal_message`, which lands it in the
 * thread on the job of this page; a sample says thank you and keeps it on the page, and the office's preview sends
 * nothing and says so.
 */

/**
 * `error` is the office's preview notice; `failed` a send's failure as kept, its class or the function's own known
 * sentence, worded in the page's language (v2.5965).
 */
type Ui = { kind: 'idle' } | { kind: 'sending' } | { kind: 'error'; text: string } | { kind: 'failed'; failure: PortalFailureCause }

const PREVIEW_WORDS = 'This is the office’s preview. Nothing was sent.'

async function send(token: string, projectId: string, text: string): Promise<{ ok: true; line: PortalThreadLine | null } | { ok: false; failure: PortalFailureCause }> {
  try {
    const res = await fetch(`${supabaseUrl}/functions/v1/submit-portal-request`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, kind: 'portal_message', projectId, text }),
    })
    const json = (await res.json().catch(() => null)) as { ok?: boolean; error?: unknown; line?: PortalThreadLine } | null
    if (!res.ok || !json?.ok) return { ok: false, failure: portalFailureCause(res.status, json, 'send') }
    return { ok: true, line: json.line ?? null }
  } catch (e) {
    return { ok: false, failure: portalFailureKind(e) }
  }
}

const bubble = (mine: boolean): CSSProperties => ({
  borderRadius: 10,
  padding: '7px 10px',
  maxWidth: '90%',
  justifySelf: mine ? 'start' : 'end',
  background: mine ? CARD : 'var(--bg-amber-100)',
  border: `1px solid ${HAIR}`,
  color: INK,
  whiteSpace: 'pre-wrap',
  overflowWrap: 'anywhere',
})

export function PortalGcMessages({
  lang,
  words,
  token,
  projectId,
  company,
  urgent,
  lines: shipped,
  phone = null,
}: {
  lang: PortalLang
  words: PageWords
  token: string
  projectId: string
  company: string
  /** Who to call on site for something urgent. */
  urgent: string
  lines: readonly PortalThreadLine[]
  /** The office's number, offered beside a refusal. */
  phone?: string | null
}) {
  const preview = useContext(PortalPreviewContext)
  const [lines, setLines] = useState<PortalThreadLine[]>([...shipped])
  const [text, setText] = useState('')
  const [ui, setUi] = useState<Ui>({ kind: 'idle' })
  const rows = threadRows(lang, lines, company, words)

  const write = async () => {
    const body = text.trim()
    if (!body || ui.kind === 'sending') return
    if (preview) {
      setUi({ kind: 'error', text: PREVIEW_WORDS })
      return
    }
    setUi({ kind: 'sending' })
    const kept = (line: PortalThreadLine | null) => {
      setLines((all) => [...all, line ?? { id: `mine-${all.length}`, at: new Date().toISOString(), dir: 'in', door: 'portal', who: null, subject: null, body }])
      setText('')
      setUi({ kind: 'idle' })
    }
    if (sampleStateFromToken(token)) {
      kept(null)
      return
    }
    const r = await send(token, projectId, body)
    if (r.ok) kept(r.line)
    else setUi({ kind: 'failed', failure: r.failure })
  }

  return (
    <div data-testid="portal-gc-messages" style={{ display: 'grid', gap: 8 }}>
      <div style={{ color: MUTED, fontSize: 12 }}>{words.say(lang, 'messagesSame')}</div>
      <div role="list" aria-label={words.say(lang, 'tabMessages')} style={{ display: 'grid', gap: 6 }}>
        {rows.length === 0 ? (
          <div style={{ color: MUTED }}>{words.say(lang, 'nothingYetShort')}</div>
        ) : (
          rows.map((r) => (
            <div key={r.id} role="listitem" style={bubble(r.mine)}>
              {r.text}
              <span style={{ display: 'block', color: MUTED, fontSize: 11, marginTop: 2 }}>{r.small}</span>
            </div>
          ))
        )}
      </div>
      <div style={{ display: 'flex', gap: 6, alignItems: 'flex-end' }}>
        <textarea
          aria-label={words.say(lang, 'writeToUs')}
          placeholder={words.say(lang, 'writeToUs')}
          value={text}
          rows={2}
          maxLength={2000}
          disabled={ui.kind === 'sending'}
          onChange={(e) => setText(e.target.value)}
          style={{ flex: 1, minWidth: 0, padding: '0.45rem 0.55rem', border: `1px solid ${HAIR}`, borderRadius: 6, background: CARD, color: INK, font: 'inherit', fontSize: 13, resize: 'vertical' }}
        />
        <button
          type="button"
          onClick={() => void write()}
          disabled={!text.trim() || ui.kind === 'sending'}
          style={{ background: text.trim() ? COPPER : HAIR, color: '#fff', border: 'none', borderRadius: 6, padding: '0.5rem 0.9rem', fontSize: 13, fontWeight: 700, cursor: text.trim() ? 'pointer' : 'not-allowed' }}
        >
          {ui.kind === 'sending' ? '…' : words.say(lang, 'send')}
        </button>
      </div>
      {ui.kind === 'error' && (
        <div role="alert" style={{ color: 'var(--text-red-700)', fontSize: 12 }}>
          {ui.text}
        </div>
      )}
      <PortalFailureNote
        failure={ui.kind === 'failed' ? portalFailure(ui.failure, 'send', lang, { phone }) : null}
        lang={lang}
        onTryAgain={() => void write()}
        messageStyle={{ color: 'var(--text-red-700)', fontSize: 12 }}
      />
      <div style={{ color: MUTED, fontSize: 12 }}>{words.say(lang, 'repliesHours', { name: urgent })}</div>
    </div>
  )
}
