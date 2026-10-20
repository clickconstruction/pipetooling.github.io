/**
 * Settings → Your account → **Your bio** (v2.5587, punch list #114): the office's lines about the signed-in tech, the
 * bio as a customer gets it, and one switch a line, **Say it** / **Don't say this**, the tech's usual picks. A line
 * turned off leaves the bio by default; the office sees it on the desk. The rules are `lib/bio/bio.ts`; the reads and
 * the write (`bio_line_say`) are `lib/bio/bioIo.ts`. Drawn for the people who press On my way: a primary, a helper, or
 * an office member. A client ahead of the push draws nothing.
 */
import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import { useToastContext } from '../../contexts/ToastContext'
import { useAuth, type UserRole } from '../../hooks/useAuth'
import { formatErrorMessage } from '../../utils/errorHandling'
import { BIO_WORDS, bioText, firstNameOf, liveLines, type BioLine } from '../../lib/bio/bio'
import { supabaseBioIo, type BioIo } from '../../lib/bio/bioIo'
import { yourBioShown } from '../../lib/bio/bioGates'


const card: CSSProperties = { marginBottom: '2rem', border: '1px solid var(--border)', borderRadius: 8, padding: '1rem', background: 'var(--bg-subtle)' }
const preview: CSSProperties = { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, padding: '0.5rem 0.65rem', fontSize: '0.875rem', whiteSpace: 'pre-wrap', margin: '0 0 0.75rem' }
const row: CSSProperties = { display: 'grid', gridTemplateColumns: '1.25rem 1fr auto', gap: '0.5rem', alignItems: 'center', padding: '0.5rem 0', borderTop: '1px solid var(--border)' }
const pill: CSSProperties = { display: 'inline-flex', border: '1px solid var(--border-strong)', borderRadius: 999, overflow: 'hidden', fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer', background: 'var(--surface)', padding: 0 }
const half: CSSProperties = { padding: '0.3rem 0.6rem', color: 'var(--text-muted)', minHeight: 32, display: 'inline-flex', alignItems: 'center' }
const onHalf: CSSProperties = { ...half, background: 'var(--bg-green-tint)', color: 'var(--text-green-800)' }
const offHalf: CSSProperties = { ...half, background: 'var(--bg-muted)', color: 'var(--text-700)' }

export function YourBioCard({ role, name, userId: userIdProp, io: ioProp }: { role: UserRole | null | undefined; name: string | null; userId?: string; io?: BioIo }) {
  const { showToast } = useToastContext()
  const { user } = useAuth()
  const userId = userIdProp ?? user?.id ?? null
  const io = useMemo(() => ioProp ?? supabaseBioIo(), [ioProp])
  const shown = yourBioShown(role) && Boolean(userId)
  const [lines, setLines] = useState<BioLine[] | null | undefined>(undefined)
  const [busy, setBusy] = useState<string | null>(null)
  const [tick, setTick] = useState(0)

  useEffect(() => {
    if (!shown || !userId) return
    let live = true
    io.loadLines(userId).then(
      (l) => live && setLines(l),
      (e: unknown) => {
        if (!live) return
        setLines([])
        showToast(formatErrorMessage(e, 'Your bio could not be read.'), 'error')
      },
    )
    return () => {
      live = false
    }
  }, [io, userId, shown, tick, showToast])

  const first = firstNameOf(name)
  const live = useMemo(() => liveLines(lines ?? []), [lines])
  const words = useMemo(() => bioText({ lines: lines ?? [], first }), [lines, first])

  if (!shown || lines == null) return null

  const say = async (line: BioLine, next: boolean) => {
    if (busy) return
    setBusy(line.id)
    try {
      await io.say(line.id, next)
      showToast(next ? BIO_WORDS.saidToast : BIO_WORDS.notSaidToast, 'success')
      setTick((t) => t + 1)
    } catch (e) {
      showToast(formatErrorMessage(e, 'Your bio was not changed.'), 'error')
    } finally {
      setBusy(null)
    }
  }

  return (
    <div style={card} data-settings-your-bio>
      <h2 style={{ fontSize: '1rem', marginTop: 0, marginBottom: '0.5rem', fontWeight: 600 }}>{BIO_WORDS.yourTitle}</h2>
      <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', margin: '0 0 0.75rem' }}>{BIO_WORDS.yourHint}</p>
      {live.length === 0 ? (
        <p style={{ fontSize: '0.875rem', margin: 0 }}>{BIO_WORDS.yourEmpty}</p>
      ) : (
        <>
          <p style={preview} data-testid="your-bio-preview">
            {words ?? 'Nothing goes while every line is off.'}
          </p>
          {live.map((line, i) => {
            const on = !line.offByUser
            return (
              <div key={line.id} style={row} data-testid="your-bio-line">
                <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)' }}>{i + 1}</span>
                <span style={{ fontSize: '0.875rem', color: on ? 'var(--text-strong)' : 'var(--text-muted)', textDecoration: on ? undefined : 'line-through' }}>{line.text}</span>
                <button type="button" role="switch" aria-checked={on} aria-label={line.text} style={pill} disabled={busy === line.id} onClick={() => void say(line, !on)}>
                  <span style={on ? onHalf : half}>{BIO_WORDS.sayIt}</span>
                  <span style={on ? half : offHalf}>{BIO_WORDS.dontSay}</span>
                </button>
              </div>
            )
          })}
        </>
      )}
    </div>
  )
}
