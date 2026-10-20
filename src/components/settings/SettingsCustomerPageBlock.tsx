import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import { useAuth } from '../../hooks/useAuth'
import { canOpenGcProjects } from '../../lib/gc/access'
import { customerPageWordGroups, findWordLines, wordEditProblem, type SavedWord, type WordLine } from '../../lib/portal/customerPageWordsEdit'
import { loadPortalSwitchJobs, loadSavedWords, saveWord, setPortalSwitch, type PortalSwitch, type PortalSwitchJob } from '../../lib/portal/customerPageWordsIo'
import { formatDenverDateTimeShort } from '../../utils/dateUtils'
import { formatErrorMessage } from '../../utils/errorHandling'

const CARD: CSSProperties = { border: '1px solid var(--border)', borderRadius: 10, background: 'var(--surface)', padding: '0.85rem 1rem', marginBottom: '0.9rem', display: 'grid', gap: '0.9rem' }
const MUTED: CSSProperties = { fontSize: '0.78rem', color: 'var(--text-muted)' }
const HEAD: CSSProperties = { margin: 0, fontSize: '0.8rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-muted)' }
const BUTTON: CSSProperties = { font: 'inherit', fontSize: '0.8rem', padding: '0.3rem 0.7rem', minHeight: 32, borderRadius: 6, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--text-base)', cursor: 'pointer' }
const PRIMARY: CSSProperties = { ...BUTTON, background: '#2563eb', borderColor: '#2563eb', color: 'white', fontWeight: 600 }
const FIELD: CSSProperties = { font: 'inherit', fontSize: '0.85rem', width: '100%', boxSizing: 'border-box', padding: '0.4rem 0.5rem', borderRadius: 6, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--text-base)' }
const ALERT: CSSProperties = { margin: 0, fontSize: '0.8rem', color: 'var(--text-red-700)' }

const when = (at: string): string => {
  const ms = Date.parse(at)
  return Number.isNaN(ms) ? '' : formatDenverDateTimeShort(ms)
}

/**
 * Messages, cut 8d: Settings → What customers see → Customer page. What a customer reads on a GC job's page in their
 * portal (`PortalGcPage`): the three switches on each job, then every sentence of ours in English and Spanish by where
 * it shows (`customerPageWordsEdit.ts`). The office team changes them; anyone else on this tab, and a training account,
 * reads them.
 */
export function SettingsCustomerPageBlock() {
  const { role, readOnly } = useAuth()
  const canEdit = canOpenGcProjects(role) && !readOnly
  return (
    <section style={CARD} aria-label="Customer page">
      <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.6rem', flexWrap: 'wrap' }}>
        <h3 style={{ margin: 0, fontSize: '0.95rem' }}>Customer page</h3>
        <span style={MUTED}>What a customer reads on a GC job’s page in their portal.</span>
      </div>
      {!canEdit && <p style={{ ...MUTED, margin: 0 }}>{readOnly ? 'A training account reads these. Nothing here changes.' : 'Only the office team changes these.'}</p>}
      <Switches canEdit={canEdit} />
      <Words canEdit={canEdit} />
    </section>
  )
}

const SWITCHES: readonly { key: PortalSwitch; label: string; note: string }[] = [
  { key: 'photos', label: 'Photos', note: 'This week’s line links to the job’s photos.' },
  { key: 'forecast', label: 'Next bill', note: 'The page sizes the next bill once it can.' },
  { key: 'spanish', label: 'Spanish', note: 'The page offers Spanish once it is on for every portal.' },
]

const STAGE: Readonly<Record<string, string>> = { buyout: 'buying out', building: 'building', closed: 'closed' }

function Switches({ canEdit }: { canEdit: boolean }) {
  const [jobs, setJobs] = useState<PortalSwitchJob[] | null>(null)
  const [problem, setProblem] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  useEffect(() => {
    let live = true
    loadPortalSwitchJobs()
      .then((j) => live && setJobs(j))
      .catch((e: unknown) => live && setProblem(formatErrorMessage(e, 'The jobs did not load.')))
    return () => {
      live = false
    }
  }, [])
  const flip = async (job: PortalSwitchJob, which: PortalSwitch, on: boolean) => {
    setBusy(true)
    setProblem(null)
    try {
      await setPortalSwitch(job.projectId, which, on)
      setJobs((all) => all?.map((j) => (j.projectId === job.projectId ? { ...j, [which]: on } : j)) ?? all)
    } catch (e) {
      setProblem(formatErrorMessage(e, 'That switch did not change.'))
    } finally {
      setBusy(false)
    }
  }
  return (
    <div style={{ display: 'grid', gap: '0.45rem' }}>
      <h4 style={HEAD}>Each job</h4>
      <ul style={{ ...MUTED, margin: 0, paddingLeft: '1.1rem', display: 'grid', gap: '0.15rem' }}>
        {SWITCHES.map((s) => (
          <li key={s.key}>
            <strong>{s.label}</strong>: {s.note}
          </li>
        ))}
      </ul>
      {problem && (
        <p role="alert" style={ALERT}>
          {problem}
        </p>
      )}
      {jobs === null ? (
        !problem && <p style={{ ...MUTED, margin: 0 }}>Loading the jobs…</p>
      ) : jobs.length === 0 ? (
        <p style={{ ...MUTED, margin: 0 }}>No job is on a customer’s portal yet.</p>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ borderCollapse: 'collapse', fontSize: '0.85rem', minWidth: '100%' }}>
            <thead>
              <tr>
                <th style={{ textAlign: 'left', padding: '0.3rem 0.5rem 0.3rem 0', ...MUTED }}>Job</th>
                {SWITCHES.map((s) => (
                  <th key={s.key} style={{ padding: '0.3rem 0.5rem', ...MUTED }}>
                    {s.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {jobs.map((job) => (
                <tr key={job.projectId} style={{ borderTop: '1px solid var(--border)' }}>
                  <td style={{ padding: '0.35rem 0.5rem 0.35rem 0' }}>
                    {job.name} <span style={MUTED}>· {STAGE[job.stage] ?? job.stage}</span>
                  </td>
                  {SWITCHES.map((s) => (
                    <td key={s.key} style={{ textAlign: 'center', padding: '0.35rem 0.5rem' }}>
                      <input
                        type="checkbox"
                        aria-label={`${s.label} on ${job.name}`}
                        checked={job[s.key]}
                        disabled={!canEdit || busy}
                        onChange={(e) => void flip(job, s.key, e.target.checked)}
                        style={{ width: 18, height: 18, cursor: canEdit ? 'pointer' : 'default' }}
                      />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function Words({ canEdit }: { canEdit: boolean }) {
  const [saved, setSaved] = useState<SavedWord[] | null>(null)
  const [problem, setProblem] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [editing, setEditing] = useState<string | null>(null)
  useEffect(() => {
    let live = true
    loadSavedWords()
      .then((w) => live && setSaved(w))
      .catch((e: unknown) => live && setProblem(formatErrorMessage(e, 'The sentences did not load.')))
    return () => {
      live = false
    }
  }, [])
  const groups = useMemo(() => (saved ? customerPageWordGroups(saved) : []), [saved])
  const shown = useMemo(() => findWordLines(groups, search), [groups, search])
  const searching = search.trim() !== ''
  const onSaved = (word: SavedWord) => setSaved((all) => [...(all ?? []).filter((w) => w.key !== word.key), word])
  return (
    <div style={{ display: 'grid', gap: '0.45rem' }}>
      <h4 style={HEAD}>Our words</h4>
      <p style={{ ...MUTED, margin: 0 }}>
        Every sentence of ours on the page, in English and Spanish. A change reads on every customer’s page. Words in braces are blanks the page fills in, like a day
        or a name.
      </p>
      <input type="search" aria-label="Find a sentence" placeholder="Type words you see on the page" value={search} onChange={(e) => setSearch(e.target.value)} style={{ ...FIELD, maxWidth: 420 }} />
      {problem && (
        <p role="alert" style={ALERT}>
          {problem}
        </p>
      )}
      {saved === null ? (
        !problem && <p style={{ ...MUTED, margin: 0 }}>Loading the sentences…</p>
      ) : shown.length === 0 ? (
        <p style={{ ...MUTED, margin: 0 }}>No sentence has those words.</p>
      ) : (
        shown.map((group) => (
          <details key={group.title} open={searching || undefined} style={{ borderTop: '1px solid var(--border)', paddingTop: '0.35rem' }}>
            <summary style={{ cursor: 'pointer', fontSize: '0.88rem', fontWeight: 600, minHeight: 28 }}>
              {group.title} <span style={MUTED}>· {group.lines.length}</span>
            </summary>
            <ul aria-label={group.title} style={{ listStyle: 'none', margin: 0, padding: 0 }}>
              {group.lines.map((line) => (
                <Line
                  key={line.key}
                  line={line}
                  canEdit={canEdit}
                  editing={editing === line.key}
                  onEdit={() => setEditing(line.key)}
                  onDone={() => setEditing(null)}
                  onSaved={onSaved}
                />
              ))}
            </ul>
          </details>
        ))
      )}
    </div>
  )
}

function Line({
  line,
  canEdit,
  editing,
  onEdit,
  onDone,
  onSaved,
}: {
  line: WordLine
  canEdit: boolean
  editing: boolean
  onEdit: () => void
  onDone: () => void
  onSaved: (word: SavedWord) => void
}) {
  const [en, setEn] = useState(line.now.en)
  const [es, setEs] = useState(line.now.es)
  const [busy, setBusy] = useState(false)
  const [problem, setProblem] = useState<string | null>(null)
  useEffect(() => {
    if (!editing) return
    setEn(line.now.en)
    setEs(line.now.es)
    setProblem(null)
  }, [editing, line.now.en, line.now.es])
  const check = editing ? wordEditProblem(line, en, es) : null
  const same = en.trim() === line.now.en && es.trim() === line.now.es
  const save = async () => {
    if (check || same) return
    setBusy(true)
    setProblem(null)
    try {
      onSaved(await saveWord(line.key, en, es))
      onDone()
    } catch (e) {
      setProblem(formatErrorMessage(e, 'The sentence did not save.'))
    } finally {
      setBusy(false)
    }
  }
  const shipped = line.changed && (line.code.en !== line.now.en || line.code.es !== line.now.es)
  return (
    <li data-word={line.key} style={{ display: 'grid', gap: '0.3rem', padding: '0.5rem 0', borderTop: '1px solid var(--border)' }}>
      {line.part && <div style={{ ...MUTED, fontWeight: 600 }}>{line.part}</div>}
      {editing ? (
        <div style={{ display: 'grid', gap: '0.4rem' }}>
          <label style={{ display: 'grid', gap: '0.15rem', ...MUTED }}>
            English
            <textarea value={en} onChange={(e) => setEn(e.target.value)} rows={2} style={FIELD} disabled={busy} />
          </label>
          <label style={{ display: 'grid', gap: '0.15rem', ...MUTED }}>
            Spanish
            <textarea lang="es" value={es} onChange={(e) => setEs(e.target.value)} rows={2} style={FIELD} disabled={busy} />
          </label>
          {line.blanks.length > 0 && <div style={MUTED}>Keep {line.blanks.map((b) => `{${b}}`).join(', ')} as written in both.</div>}
          {(problem ?? check) && (
            <p role="alert" style={ALERT}>
              {problem ?? check}
            </p>
          )}
          <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
            <button type="button" style={PRIMARY} disabled={busy || !!check || same} onClick={() => void save()}>
              {busy ? 'Saving…' : 'Save'}
            </button>
            <button type="button" style={BUTTON} disabled={busy} onClick={onDone}>
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(14rem, 1fr))', gap: '0.3rem 1rem', fontSize: '0.88rem' }}>
          <div>
            <div style={MUTED}>English</div>
            {line.now.en}
          </div>
          <div lang="es">
            <div style={MUTED}>Spanish</div>
            {line.now.es}
          </div>
        </div>
      )}
      <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'center', flexWrap: 'wrap', ...MUTED }}>
        {line.changed ? <span>Changed{line.changed.by ? ` by ${line.changed.by}` : ''} {when(line.changed.at)}</span> : !line.saved ? <span>Comes with the next update.</span> : null}
        {canEdit && line.saved && !editing && (
          <button type="button" style={BUTTON} onClick={onEdit} aria-label={`Edit: ${line.now.en}`}>
            Edit
          </button>
        )}
      </div>
      {shipped && !editing && (
        <div style={MUTED}>
          As we shipped it: {line.code.en} <span lang="es">· {line.code.es}</span>
        </div>
      )}
    </li>
  )
}
