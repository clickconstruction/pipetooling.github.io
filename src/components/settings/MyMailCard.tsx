/**
 * Messages → My email (punch list #230 PR 3): **My email in Messages**, a card on Settings → Your account for the
 * office team, the tab's own people (the mock-up's section 4). Its one switch, *Show my mail on the My email tab*, is
 * on by default and saves at once (`my_mail_set`); under it the card says, every time it is drawn, what the tab reads
 * (the person's own address, live), what it keeps (nothing until a tag), what a tag and an untag do, what is never
 * read, the one write to their Gmail and who sees the tab, with the labels they leave out as chips, each with ×, and
 * **+ a label**. Before the switch's column is pushed the card still draws and says the switch waits. The words and
 * the label rules are `lib/myMail/settingCard.ts`; the reads and the save `lib/myMail/myMailIo.ts`.
 */
import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import { useToastContext } from '../../contexts/ToastContext'
import { useAuth, type UserRole } from '../../hooks/useAuth'
import { GC_OFFICE_TEAM } from '../../lib/gc/access'
import { supabaseMyMailSettingIo, type MyMailSetting, type MyMailSettingIo } from '../../lib/myMail/myMailIo'
import { hiddenLabelProblem, MY_MAIL_CARD_WORDS, withHiddenLabel, withoutHiddenLabel } from '../../lib/myMail/settingCard'
import { MY_MAIL_SETTINGS_ANCHOR } from '../../lib/myMail/tab'
import { formatErrorMessage } from '../../utils/errorHandling'

const W = MY_MAIL_CARD_WORDS

const card: CSSProperties = { marginBottom: '2rem', border: '1px solid var(--border)', borderRadius: 8, padding: '1rem' }
const muted: CSSProperties = { color: 'var(--text-muted)', fontSize: '0.8125rem', margin: 0 }
const chip: CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: '0.3rem', padding: '0.1rem 0.55rem', borderRadius: 999, background: 'var(--bg-subtle)', border: '1px solid var(--border-strong)', fontSize: '0.8125rem', fontWeight: 600 }
const quiet: CSSProperties = { border: 0, background: 'none', padding: 0, font: 'inherit', cursor: 'pointer', color: 'var(--text-muted)' }
const smallButton: CSSProperties = { padding: '0.2rem 0.6rem', fontSize: '0.8125rem', border: '1px solid var(--border-strong)', borderRadius: 4, background: 'var(--surface)', color: 'var(--text-base)', cursor: 'pointer', font: 'inherit' }

export function MyMailCard({ role, userId: userIdProp, io: ioProp }: { role: UserRole | null | undefined; userId?: string; io?: MyMailSettingIo }) {
  const { showToast } = useToastContext()
  const { user } = useAuth()
  const userId = userIdProp ?? user?.id ?? null
  const office = Boolean(role) && GC_OFFICE_TEAM.includes(role!)
  const io = useMemo(() => ioProp ?? supabaseMyMailSettingIo(), [ioProp])
  /** The switch as read; undefined while it is read, null when the read failed. */
  const [loaded, setLoaded] = useState<MyMailSetting | null | undefined>(undefined)
  const [busy, setBusy] = useState(false)
  const [problem, setProblem] = useState<string | null>(null)
  /** The label being typed; null while the box is shut. */
  const [adding, setAdding] = useState<string | null>(null)

  useEffect(() => {
    if (!office || !userId) return
    let live = true
    io.load(userId).then(
      (s) => live && setLoaded(s),
      (e: unknown) => {
        if (!live) return
        setLoaded(null)
        setProblem(formatErrorMessage(e, W.notRead))
      },
    )
    return () => {
      live = false
    }
  }, [io, office, userId])

  if (!office || !userId) return null

  const save = async (on: boolean, labels: string[] | null) => {
    if (!loaded) return
    setBusy(true)
    setProblem(null)
    try {
      const saved = await io.save(on, labels)
      setLoaded({ ...loaded, ...saved })
      showToast(W.saved, 'success')
      return true
    } catch (e) {
      setProblem(formatErrorMessage(e, W.notSaved))
      return false
    } finally {
      setBusy(false)
    }
  }

  const labels = loaded?.hiddenLabels ?? []
  const typed = adding?.trim() ?? ''
  const bad = adding !== null ? hiddenLabelProblem(labels, adding) : null
  const add = async () => {
    if (!loaded || !typed || bad) return
    if (await save(loaded.on, withHiddenLabel(labels, typed))) setAdding(null)
  }

  return (
    <div id={MY_MAIL_SETTINGS_ANCHOR} data-my-mail-card style={card}>
      <h2 style={{ marginTop: 0, marginBottom: '0.6rem', fontSize: '1rem', fontWeight: 600 }}>{W.title}</h2>
      {loaded === undefined && !problem ? <p style={muted}>{W.loading}</p> : null}
      {loaded ? (
        <div style={{ display: 'grid', gap: '0.6rem' }}>
          <button
            type="button"
            role="switch"
            aria-checked={loaded.on}
            disabled={busy || !loaded.ready}
            onClick={() => void save(!loaded.on, null)}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '0.55rem', justifySelf: 'start', border: 0, background: 'none', padding: 0, font: 'inherit', fontWeight: 600, fontSize: '0.875rem', color: 'var(--text-base)', cursor: busy || !loaded.ready ? 'default' : 'pointer', opacity: loaded.ready ? 1 : 0.6 }}
          >
            <span aria-hidden style={{ position: 'relative', width: 36, height: 20, borderRadius: 999, background: loaded.on ? '#16a34a' : 'var(--bg-200)', flex: 'none' }}>
              <span style={{ position: 'absolute', top: 2, left: loaded.on ? 18 : 2, width: 16, height: 16, borderRadius: 999, background: 'var(--surface)' }} />
            </span>
            {W.switch}
          </button>
          {!loaded.ready ? (
            <p data-my-mail-wait style={muted}>
              {W.wait}
            </p>
          ) : null}
          <ul style={{ margin: 0, paddingLeft: '1.1rem', display: 'grid', gap: '0.3rem', fontSize: '0.875rem', color: 'var(--text-base)' }}>
            <li data-my-mail-reads>{W.reads(loaded.address)}</li>
            <li>
              {W.tag} {W.untag}
            </li>
            <li>
              {W.never}
              <div role="group" aria-label={W.hidden} data-my-mail-hidden style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap', alignItems: 'center', marginTop: '0.35rem' }}>
                {labels.map((l) => (
                  <span key={l} style={chip}>
                    {l}
                    <button type="button" aria-label={W.showAgain(l)} title={W.showAgain(l)} disabled={busy || !loaded.ready} onClick={() => void save(loaded.on, withoutHiddenLabel(labels, l))} style={{ ...quiet, fontSize: '0.9rem', lineHeight: 1 }}>
                      ×
                    </button>
                  </span>
                ))}
                {adding === null ? (
                  <button type="button" disabled={busy || !loaded.ready} onClick={() => setAdding('')} style={{ ...chip, borderStyle: 'dashed', color: 'var(--text-muted)', background: 'var(--surface)', cursor: busy || !loaded.ready ? 'default' : 'pointer', font: 'inherit', fontSize: '0.8125rem' }}>
                    {W.addLabel}
                  </button>
                ) : (
                  <>
                    <input
                      autoFocus
                      aria-label={W.labelBox}
                      placeholder={W.labelHint}
                      value={adding}
                      disabled={busy}
                      onChange={(e) => setAdding(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') void add()
                        if (e.key === 'Escape') setAdding(null)
                      }}
                      style={{ width: '10rem', padding: '0.25rem 0.45rem', border: '1px solid var(--border-strong)', borderRadius: 4, background: 'var(--surface)', color: 'var(--text-base)', font: 'inherit', fontSize: '0.8125rem' }}
                    />
                    <button type="button" disabled={busy || !typed || Boolean(bad)} onClick={() => void add()} style={smallButton}>
                      {W.leaveOut}
                    </button>
                    <button type="button" onClick={() => setAdding(null)} style={{ ...quiet, fontSize: '0.8125rem' }}>
                      {W.cancel}
                    </button>
                  </>
                )}
              </div>
              {bad ? (
                <p role="alert" style={{ ...muted, color: 'var(--text-red-700)', marginTop: '0.3rem' }}>
                  {bad}
                </p>
              ) : null}
            </li>
            <li>{W.gmailLabel}</li>
            <li>{W.onlyYou}</li>
          </ul>
        </div>
      ) : null}
      {problem ? (
        <div role="alert" style={{ color: 'var(--text-red-700)', fontSize: '0.875rem', marginTop: '0.5rem' }}>
          {problem}
        </div>
      ) : null}
    </div>
  )
}
