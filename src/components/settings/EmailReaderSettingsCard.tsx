/**
 * Messages, cut 6: Settings → Phone and texts → **Read bids@**, for the owner and a dev. The switch for the `gmail-sync`
 * reader (`app_settings.gmail_sync_on_v1`, through `emailReaderIo.ts`), turned on after a confirm since it starts
 * reading the live mailbox, and how the reader is doing in words (`readerHealthWords`, from `gmail_sync_state`). It is
 * how the owner turns the reader on after the live email test.
 */
import { useEffect, useState, type CSSProperties } from 'react'
import { useConfirmDialog } from '../../contexts/ConfirmDialogContext'
import { useToastContext } from '../../contexts/ToastContext'
import { READER_CONFIRM, READER_OFF_TOAST, READER_ON_TOAST, READER_TITLE, READER_WHAT, readerHealthWords, teamBoxHealthWords, type ReaderHealth } from '../../lib/messages/emailReader'
import { supabaseEmailReaderIo, type EmailReaderIo } from '../../lib/messages/emailReaderIo'
import { formatErrorMessage } from '../../utils/errorHandling'

const DEFAULT_IO = supabaseEmailReaderIo()

const cardStyle: CSSProperties = { border: '1px solid var(--border)', borderRadius: 10, padding: '0.8rem 0.9rem', display: 'grid', gap: '0.6rem', background: 'var(--surface)' }
const muted: CSSProperties = { color: 'var(--text-muted)', fontSize: '0.85rem', margin: 0 }

export function EmailReaderSettingsCard({ io = DEFAULT_IO, nowIso }: { io?: EmailReaderIo; nowIso?: string }) {
  const confirm = useConfirmDialog()
  const { showToast } = useToastContext()
  const [loaded, setLoaded] = useState<{ on: boolean; health: ReaderHealth | null; teamHealth?: ReaderHealth | null } | null>(null)
  const [problem, setProblem] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    let live = true
    io.load().then(
      (r) => {
        if (live) setLoaded(r)
      },
      (e: unknown) => {
        if (live) setProblem(formatErrorMessage(e))
      },
    )
    return () => {
      live = false
    }
  }, [io])

  const flip = async () => {
    if (!loaded) return
    const next = !loaded.on
    // Turning it on starts reading the live mailbox, so it asks first. Turning it off does not.
    if (next && !(await confirm({ ...READER_CONFIRM, cancelIsSafe: true }))) return
    setSaving(true)
    setProblem(null)
    try {
      await io.setOn(next)
      setLoaded((l) => (l ? { ...l, on: next } : l))
      showToast(next ? READER_ON_TOAST : READER_OFF_TOAST, 'success')
    } catch (e) {
      setProblem(formatErrorMessage(e))
    } finally {
      setSaving(false)
    }
  }

  return (
    <section aria-labelledby="phone-texts-read-bids" data-settings-read-bids style={cardStyle}>
      <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'center', flexWrap: 'wrap' }}>
        <h3 id="phone-texts-read-bids" style={{ margin: 0, fontSize: '1rem' }}>
          {READER_TITLE}
        </h3>
        {loaded && (
          <button
            type="button"
            role="switch"
            aria-checked={loaded.on}
            aria-label={READER_TITLE}
            onClick={() => void flip()}
            disabled={saving}
            style={{
              border: '1px solid var(--border-strong)',
              borderRadius: 999,
              padding: '0.15rem 0.7rem',
              fontSize: '0.85rem',
              fontWeight: 600,
              cursor: saving ? 'default' : 'pointer',
              background: loaded.on ? '#16a34a' : 'var(--surface)',
              color: loaded.on ? 'white' : 'var(--text-base)',
              opacity: saving ? 0.6 : 1,
            }}
          >
            {saving ? 'Saving…' : loaded.on ? 'On' : 'Off'}
          </button>
        )}
      </div>
      <p style={{ margin: 0, fontSize: '0.9rem' }}>{READER_WHAT}</p>
      {loaded ? (
        <>
          <p data-reader-health style={muted}>
            {readerHealthWords(loaded.health, nowIso ?? new Date().toISOString())}
          </p>
          {/* The team box (R6), once Settings holds its address and the reader has read it. */}
          {loaded.teamHealth && (
            <p data-reader-health-team style={muted}>
              {teamBoxHealthWords(loaded.teamHealth, nowIso ?? new Date().toISOString())}
            </p>
          )}
        </>
      ) : (
        !problem && <p style={muted}>Loading the switch…</p>
      )}
      {problem && (
        <div role="alert" style={{ color: 'var(--text-red-700)', fontSize: '0.875rem' }}>
          {problem}
        </div>
      )}
    </section>
  )
}
