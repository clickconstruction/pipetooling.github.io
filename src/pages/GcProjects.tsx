/**
 * GC mode, the real build, step 4: the GC projects page, dev-only while the build goes on. It
 * lists every GC project as the kernels read it (the sets, the sheets, the trades with their scope
 * lines and the gaps), and holds the New project window. `src/lib/gc/gcIo.ts` does the reading
 * and the one write; the window and the kernels decide the rest.
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Navigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { useToastContext } from '../contexts/ToastContext'
import { formatErrorMessage } from '../utils/errorHandling'
import { todayYmdInAppTz } from '../utils/dateUtils'
import { GcNewProjectWindow } from '../components/gc/GcNewProject'
import { GcScopeBookWindow } from '../components/gc/GcScopeBook'
import { Btn, Chip } from '../components/gc/gcUi'
import {
  checkDriveAccess,
  createGcProject,
  editScopeBookLine,
  loadGcPickerCustomers,
  loadGcProjects,
  loadScopeBookStore,
  makeDriveFolders,
  mergeScopeBookLines,
  saveScopeBookLine,
  saveScopeSet,
  type GcPickerCustomer,
} from '../lib/gc/gcIo'
import { DRIVE_RESTRICTED_WORDS } from '../components/gc/GcNewProjectDriveLink'
import { scopeBook, scopeSetsFor, type ScopeBookInput } from '../lib/gc/scopeBook'
import { scopeGaps } from '../lib/gc/plans'
import type { GcProjectView } from '../lib/gc/projectRows'
import type { ScopeBookStore } from '../lib/gc/types'

interface Loaded {
  customers: GcPickerCustomer[]
  projects: GcProjectView[]
  store: ScopeBookStore
}

function money(n: number): string {
  return `$${Math.round(n).toLocaleString('en-US')}`
}

export default function GcProjects() {
  const { role, loading: authLoading } = useAuth()
  const { showToast } = useToastContext()
  const [params, setParams] = useSearchParams()
  const [loaded, setLoaded] = useState<Loaded | null>(null)
  const [loadProblem, setLoadProblem] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [createProblem, setCreateProblem] = useState<string | null>(null)
  const [justMade, setJustMade] = useState<string | null>(null)
  /** A set whose Drive link is being checked, as `<projectId>:<rev>`. */
  const [checking, setChecking] = useState<string | null>(null)
  const today = todayYmdInAppTz()
  const windowOpen = params.get('new') === '1'
  /** The scope book's window: `book=1`, and `trade=<trade>&project=<id>` to save that scope as a set. */
  const bookOpen = params.get('book') === '1'
  const bookTrade = params.get('trade')
  const bookProjectId = params.get('project')

  const load = useCallback(async () => {
    try {
      const [customers, projects, store] = await Promise.all([loadGcPickerCustomers(), loadGcProjects(), loadScopeBookStore()])
      setLoaded({ customers, projects, store })
      setLoadProblem(null)
    } catch (e) {
      setLoadProblem(formatErrorMessage(e, 'The GC projects did not load.'))
    }
  }, [])

  useEffect(() => {
    if (role !== 'dev') return
    void load()
  }, [role, load])

  const bookInput = useMemo<ScopeBookInput | null>(
    () => (loaded ? { projects: loaded.projects, store: loaded.store, pastJobs: [], today } : null),
    [loaded, today],
  )
  const book = useMemo(() => (bookInput ? scopeBook(bookInput) : []), [bookInput])

  if (authLoading) return null
  if (role !== 'dev') return <Navigate to="/dashboard" replace />

  const setWindow = (open: boolean) => {
    const next = new URLSearchParams(params)
    if (open) next.set('new', '1')
    else next.delete('new')
    setParams(next, { replace: true })
  }
  const setBook = (open: { trade?: string; projectId?: string } | null) => {
    const next = new URLSearchParams(params)
    for (const k of ['book', 'trade', 'project']) next.delete(k)
    if (open) {
      next.set('book', '1')
      if (open.trade) next.set('trade', open.trade)
      if (open.projectId) next.set('project', open.projectId)
    }
    setParams(next, { replace: true })
  }
  const bookProject = bookProjectId ? (loaded?.projects.find((p) => p.id === bookProjectId) ?? null) : null
  const bookTradeView = bookProject && bookTrade ? (bookProject.trades.find((t) => t.trade === bookTrade) ?? null) : null
  const current = bookProject && bookTradeView ? { trade: bookTradeView.trade, lines: bookTradeView.scope.map((l) => l.label), projectName: bookProject.name, projectId: bookProject.id } : null
  const after = (work: Promise<void>, failed: string) => {
    void work.then(() => load()).catch((e) => showToast(formatErrorMessage(e, failed), 'error'))
  }

  return (
    <div style={{ padding: '1rem', display: 'grid', gap: '1rem', maxWidth: 1100 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
        <h1 style={{ margin: 0, fontSize: '1.25rem' }}>GC projects</h1>
        <Chip tone="grey">dev only, the real build</Chip>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: '0.5rem' }}>
          <Btn kind="quiet" onClick={() => setBook({})} disabled={!loaded}>
            Open the scope book
          </Btn>
          <Btn kind="primary" onClick={() => setWindow(true)} disabled={!loaded}>
            New project
          </Btn>
        </div>
      </div>
      <div style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>
        Each project as the window left it: its sets of plans, its sheets, its trades with their scope lines and the gaps. Who to ask comes with the company record.
      </div>

      {loadProblem && <div style={{ color: 'var(--text-red-700)', fontSize: '0.875rem' }}>{loadProblem}</div>}
      {!loaded && !loadProblem && <div style={{ fontSize: '0.875rem' }}>Loading…</div>}
      {loaded && loaded.projects.length === 0 && <div style={{ fontSize: '0.875rem' }}>No GC project yet. Press New project when the first plans come in.</div>}

      {loaded?.projects.map((p) => {
        const gaps = scopeGaps(p.trades.map((t) => ({ trade: t.trade, scope: t.scope.map((s) => s.label), excludes: t.excludes })))
        const newest = p.planSets[p.planSets.length - 1]
        return (
          <div key={p.id} data-gc-project={p.id} style={{ border: '1px solid var(--border)', borderRadius: 10, padding: '0.9rem 1rem', display: 'grid', gap: '0.6rem', background: 'var(--surface)' }}>
            <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'baseline', flexWrap: 'wrap' }}>
              <strong style={{ fontSize: '1.02rem' }}>{p.name}</strong>
              <Chip tone={justMade === p.id ? 'green' : 'grey'}>{p.stage}</Chip>
              <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>{p.address}</span>
              {p.bidDue && <span style={{ fontSize: '0.85rem' }}>bid due {p.bidDue}</span>}
              {(p.sqFt || p.sizeNote) && (
                <span style={{ fontSize: '0.85rem' }}>{[p.sqFt ? `${p.sqFt.toLocaleString('en-US')} sq ft` : '', p.sizeNote].filter(Boolean).join(' ')}</span>
              )}
            </div>
            <div style={{ fontSize: '0.85rem' }}>
              {p.planSets.length} {p.planSets.length === 1 ? 'set' : 'sets'} of plans
              {newest ? `, newest ${newest.label} of ${newest.issuedOn}` : ''}. {p.sheets.length} {p.sheets.length === 1 ? 'sheet' : 'sheets'}
              {p.specs.length > 0 ? `, ${p.specs.length} ${p.specs.length === 1 ? 'section' : 'sections'}` : ''}.
            </div>
            {(
              <div style={{ fontSize: '0.85rem', display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                {p.driveFolderUrl ? (
                  <a href={p.driveFolderUrl} target="_blank" rel="noreferrer">
                    The job folder in Drive
                  </a>
                ) : (
                  <Btn
                    kind="quiet"
                    disabled={checking === `${p.id}:folders`}
                    onClick={() => {
                      setChecking(`${p.id}:folders`)
                      void makeDriveFolders(p.id)
                        .then(async (folders) => {
                          await load()
                          if (!folders.plansShared) showToast(`The folders are made, but Plans could not be shared with anyone with the link: ${folders.reason ?? 'Drive said no'}.`, 'error')
                        })
                        .catch((e) => showToast(formatErrorMessage(e, 'The Drive folders were not made.'), 'error'))
                        .finally(() => setChecking(null))
                    }}
                  >
                    {checking === `${p.id}:folders` ? 'Making the folder…' : 'Make the Drive folder'}
                  </Btn>
                )}
                {newest?.drive.url && (
                  <>
                    <a href={newest.drive.url} target="_blank" rel="noreferrer">
                      {newest.label}'s plans
                    </a>
                    <span style={{ color: newest.drive.access === 'anyone' ? 'var(--text-green-700)' : newest.drive.access === 'restricted' || newest.drive.checkedOn ? 'var(--text-red-700)' : 'var(--text-muted)' }}>
                      {newest.drive.access === 'anyone'
                        ? `Anyone with the link can open it, checked ${newest.drive.checkedOn ?? ''}.`
                        : newest.drive.access === 'restricted'
                          ? `Only some people can open it, checked ${newest.drive.checkedOn ?? ''}. Please correct. ${DRIVE_RESTRICTED_WORDS}`
                          : newest.drive.checkedOn
                            ? `Our helper could not see this link on ${newest.drive.checkedOn}. Share it with the intake service account, or move the plans into the job folder.`
                            : 'Who can open it is not checked yet.'}
                    </span>
                    <Btn
                      kind="quiet"
                      disabled={checking === `${p.id}:${newest.rev}`}
                      onClick={() => {
                        setChecking(`${p.id}:${newest.rev}`)
                        void checkDriveAccess(newest.drive.url, { projectId: p.id, rev: newest.rev })
                          .then(async (v) => {
                            await load()
                            if (!v.seen && v.note) showToast(v.note, 'error')
                          })
                          .catch((e) => showToast(formatErrorMessage(e, 'The link was not checked.'), 'error'))
                          .finally(() => setChecking(null))
                      }}
                    >
                      {checking === `${p.id}:${newest.rev}` ? 'Checking…' : newest.drive.access === null ? 'Check the link' : 'Check again'}
                    </Btn>
                  </>
                )}
              </div>
            )}
            <div style={{ display: 'grid', gap: '0.4rem' }}>
              {p.trades.map((t) => (
                <div key={t.id} style={{ display: 'grid', gap: '0.15rem', fontSize: '0.85rem' }}>
                  <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'baseline', flexWrap: 'wrap' }}>
                    <strong>{t.trade}</strong>
                    {t.ours && <Chip tone="blue">ours</Chip>}
                    {t.budget > 0 && <span style={{ color: 'var(--text-muted)' }}>{money(t.budget)}</span>}
                    <span style={{ color: 'var(--text-muted)' }}>
                      {t.scope.length} scope {t.scope.length === 1 ? 'line' : 'lines'}
                      {t.excludes.length > 0 ? `, leaves out ${t.excludes.length}` : ''}
                    </span>
                    {t.scope.length > 0 && (
                      <Btn kind="quiet" onClick={() => setBook({ trade: t.trade, projectId: p.id })}>
                        Save as a set
                      </Btn>
                    )}
                  </div>
                  <ul style={{ margin: 0, paddingLeft: '1.2rem', color: 'var(--text-muted)' }}>
                    {t.scope.map((s) => (
                      <li key={s.id}>
                        {s.label}
                        {s.sheets && s.sheets.length > 0 ? ` · ${s.sheets.join(', ')}` : ''}
                        {s.specs && s.specs.length > 0 ? ` · ${s.specs.join(', ')}` : ''}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
            {gaps.length > 0 && (
              <div style={{ fontSize: '0.85rem', color: 'var(--text-red-700)' }}>
                {gaps.length} {gaps.length === 1 ? 'gap' : 'gaps'}: {gaps.map((g) => `${g.trade} leaves out ${g.label} for ${g.by}`).join('. ')}.
              </div>
            )}
          </div>
        )
      })}

      {bookOpen && loaded && bookInput && (
        <GcScopeBookWindow
          input={bookInput}
          onClose={() => setBook(null)}
          startTrade={bookTrade ?? undefined}
          current={current}
          writes={{
            onSave: (trade, words, spec) => after(saveScopeBookLine(trade, words, spec), 'The line was not saved.'),
            onEdit: (trade, words, to) => after(editScopeBookLine(trade, words, to), 'The line was not changed.'),
            onMerge: (trade, from, into) => after(mergeScopeBookLines(trade, from, into), 'The lines were not folded.'),
            onSaveSet: (trade, name, lines, fromProjectId) => after(saveScopeSet(trade, name, lines, fromProjectId), 'The set was not saved.'),
          }}
        />
      )}

      {windowOpen && loaded && bookInput && (
        <GcNewProjectWindow
          customers={loaded.customers}
          book={book}
          setsFor={(trade) => scopeSetsFor(bookInput, trade)}
          today={today}
          creating={creating}
          problem={createProblem}
          onClose={() => setWindow(false)}
          onSaveToBook={(trade, words, spec) => {
            void saveScopeBookLine(trade, words, spec)
              .then(() => load())
              .catch((e) => showToast(formatErrorMessage(e, 'The line was not saved.'), 'error'))
          }}
          onCreate={(draft) => {
            setCreating(true)
            setCreateProblem(null)
            void createGcProject(draft)
              .then(async (id) => {
                await load()
                setJustMade(id)
                setWindow(false)
                showToast(`${draft.name} is made.`, 'success')
                // Its folder in Drive, with Plans and Team only inside (step 5). A failure is said, never a stop.
                try {
                  const folders = await makeDriveFolders(id)
                  await load()
                  if (!folders.plansShared) showToast(`The folders are made, but Plans could not be shared with anyone with the link: ${folders.reason ?? 'Drive said no'}.`, 'error')
                } catch (e) {
                  showToast(formatErrorMessage(e, 'The Drive folders were not made.'), 'error')
                }
              })
              .catch((e) => setCreateProblem(formatErrorMessage(e, 'The project was not made.')))
              .finally(() => setCreating(false))
          }}
        />
      )}
    </div>
  )
}
