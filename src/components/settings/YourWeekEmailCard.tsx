import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import { useAuth } from '../../hooks/useAuth'
import { useConfirmDialog } from '../../contexts/ConfirmDialogContext'
import { useToastContext } from '../../contexts/ToastContext'
import { lastRunWords, type WeeklySendRun } from '../../lib/bridge/weeklySend'
import { WEEK_EMAIL_WORDS as W, type WeekEmail } from '../../lib/techWeek/weekEmail'
import { supabaseWeekEmailIo, type WeekEmailIo } from '../../lib/techWeek/weekEmailIo'
import { formatErrorMessage } from '../../utils/errorHandling'

/**
 * The Monday email's card on Settings → What the team sees (punch list #255, v2.6607): a dev turns the Monday 6 AM send
 * on or off, after a confirm when turning it on, and reads when it last went and to how many; anyone with a signal
 * previews their own last week as the run would send it, or emails themselves a test. It ships off.
 */

const CARD: CSSProperties = { border: '1px solid var(--border)', borderRadius: 10, background: 'var(--surface)', padding: '0.85rem 1rem', marginBottom: '0.9rem', display: 'grid', gap: '0.6rem' }
const MUTED: CSSProperties = { fontSize: '0.78rem', color: 'var(--text-muted)' }
const BTN: CSSProperties = { font: 'inherit', fontSize: '0.8rem', fontWeight: 600, padding: '0.3rem 0.8rem', minHeight: 32, borderRadius: 6, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--text-strong)', cursor: 'pointer' }
const PRIMARY: CSSProperties = { ...BTN, border: '1px solid #2563eb', background: '#2563eb', color: 'white' }

const dayLabel = (ymd: string): string => {
  const [y = 1970, m = 1, d = 1] = ymd.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

export function YourWeekEmailCard({ io: ioIn }: { io?: WeekEmailIo } = {}) {
  const { role, readOnly } = useAuth()
  const confirm = useConfirmDialog()
  const { showToast } = useToastContext()
  const io = useMemo(() => ioIn ?? supabaseWeekEmailIo(), [ioIn])
  const canFlip = role === 'dev' && !readOnly
  const [on, setOn] = useState<boolean | null>(null)
  const [lastRun, setLastRun] = useState<WeeklySendRun | null>(null)
  const [problem, setProblem] = useState<string | null>(null)
  const [busy, setBusy] = useState<'flip' | 'preview' | 'test' | null>(null)
  const [preview, setPreview] = useState<{ mine: WeekEmail | null; to?: Array<{ name: string; email: string }> } | null>(null)

  useEffect(() => {
    let live = true
    io.load().then(
      (r) => {
        if (!live) return
        setOn(r.on)
        setLastRun(r.lastRun)
      },
      (e: unknown) => live && setProblem(formatErrorMessage(e)),
    )
    return () => {
      live = false
    }
  }, [io])

  const flip = async () => {
    if (on === null) return
    const next = !on
    if (next && !(await confirm({ ...W.confirm, cancelIsSafe: true }))) return
    setBusy('flip')
    setProblem(null)
    try {
      await io.setOn(next)
      setOn(next)
      showToast(next ? W.onToast : W.offToast, 'success')
    } catch (e) {
      setProblem(formatErrorMessage(e))
    } finally {
      setBusy(null)
    }
  }
  const previewMine = async () => {
    setBusy('preview')
    setProblem(null)
    try {
      setPreview(await io.previewMine())
    } catch (e) {
      setProblem(formatErrorMessage(e, 'The preview failed.'))
    } finally {
      setBusy(null)
    }
  }
  const testMine = async () => {
    setBusy('test')
    setProblem(null)
    try {
      const to = await io.testMine()
      showToast(`Sent. Your week is on its way to ${to}.`, 'success')
    } catch (e) {
      setProblem(formatErrorMessage(e, 'The test send failed.'))
    } finally {
      setBusy(null)
    }
  }

  return (
    <section style={CARD} aria-label={W.title} data-testid="your-week-email-card">
      <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.6rem', flexWrap: 'wrap' }}>
        <h3 style={{ margin: 0, fontSize: '0.95rem' }}>{W.title}</h3>
        <span style={MUTED}>{W.what}</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <span style={{ fontSize: '0.85rem', fontWeight: 600, color: on ? 'var(--text-green-700)' : 'var(--text-muted)' }}>{on === null ? 'Reading…' : on ? W.on : W.off}</span>
        {canFlip && on !== null ? (
          <button type="button" style={on ? BTN : PRIMARY} disabled={busy !== null} onClick={() => void flip()}>
            {busy === 'flip' ? 'Saving…' : on ? 'Turn it off' : 'Turn it on'}
          </button>
        ) : null}
        <span style={MUTED}>{lastRunWords(lastRun, dayLabel)}</span>
      </div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <button type="button" style={BTN} disabled={busy !== null} onClick={() => void previewMine()}>
          {busy === 'preview' ? 'Reading…' : W.preview}
        </button>
        <button type="button" style={BTN} disabled={busy !== null || readOnly} onClick={() => void testMine()}>
          {busy === 'test' ? 'Sending…' : 'Email me a test'}
        </button>
      </div>
      {preview ? (
        preview.mine ? (
          <div style={{ border: '1px solid var(--border)', borderRadius: 8, padding: '0.6rem 0.8rem', display: 'grid', gap: 4 }} data-testid="your-week-email-preview">
            <div style={{ fontWeight: 700 }}>{preview.mine.subject}</div>
            <pre style={{ margin: 0, whiteSpace: 'pre-wrap', font: 'inherit', fontSize: '0.82rem', color: 'var(--text-700)' }}>{preview.mine.text}</pre>
            {preview.to ? <span style={MUTED}>Monday it goes to {preview.to.length} {preview.to.length === 1 ? 'person' : 'people'}: {preview.to.map((t) => t.name || t.email).join(', ')}</span> : null}
          </div>
        ) : (
          <span style={MUTED}>{W.nothingToSay}</span>
        )
      ) : null}
      {problem ? (
        <span role="alert" style={{ fontSize: '0.8rem', color: 'var(--text-red-700)' }}>
          {problem}
        </span>
      ) : null}
    </section>
  )
}

export default YourWeekEmailCard
