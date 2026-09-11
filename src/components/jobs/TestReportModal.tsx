import { useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react'
import ResponsiveModalShell from '../ResponsiveModalShell'
import TestReportPreview from './TestReportPreview'
import TestReportSendSheet from './TestReportSendSheet'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'
import { useIsMobile } from '../../hooks/useIsMobile'
import { useToastContext } from '../../contexts/ToastContext'
import { useConfirmDialog } from '../../contexts/ConfirmDialogContext'
import { formatErrorMessage, withSupabaseRetry } from '../../utils/errorHandling'
import { todayYmdInAppTz, ymdAddDays } from '../../utils/dateUtils'
import { buildClickToolingUrl } from '../../lib/jobs/jobAddressUrls'
import { openInExternalBrowser } from '../../lib/openInExternalBrowser'
import {
  GAS_FIXTURE_QUICK_PICKS,
  TEST_REPORT_DURATION_CHOICES,
  TEST_REPORT_TYPES,
  buildTestReportBlocks,
  emptyTestReportData,
  formatBtu,
  formatTestType,
  gasFixturesTotalBtu,
  gasPressureFromPsi,
  gasPressureToPsi,
  isHydrostaticType,
  resolveTestReportText,
  testReportPdfFilename,
  testReportShortLabel,
  type GasPressureUnit,
  type TestReportData,
  type TestReportSettings,
  type TestReportType,
} from '../../lib/jobs/testReport'
import { jobStripePayLink, testReportDataFromRow, testReportJobInfoFromJob, testReportRowFromData, testReportStatusLabel, type TestReportRow } from '../../lib/jobs/testReportRow'
import { cachedTestReportSettings, fetchTestReportSettings } from '../../lib/jobs/testReportSettings'
import { buildTestReportPdfBlob } from '../../lib/jobsDocuments/testReportPdf'
import type { JobWithDetails } from '../../types/jobWithDetails'

/**
 * The Test report modal (v2.3298) — opened from the Stages row's test-report
 * button (the door that used to open plumbingtooling.com). Prefilled from the
 * job; the office picks the type, the verdict and the notes; the paper
 * renders live on the right and downloads as a real-text PDF. Send to the GC
 * arrives in PR 3 (the send record columns already exist on the row).
 */
const TYPE_LABEL: Record<TestReportType, string> = { pre_test: 'Pre-Test', post_test: 'Post-Test', pinpoint: 'Pinpoint', gas: 'Gas' }

const label: CSSProperties = { fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)', marginBottom: 4, fontWeight: 600 }
const field: CSSProperties = { marginBottom: 14 }
const input: CSSProperties = { width: '100%', boxSizing: 'border-box', padding: '0.45rem 0.6rem', fontSize: '0.9rem', border: '1px solid var(--border-strong)', borderRadius: 8, background: 'var(--surface)', color: 'var(--text-strong)', fontFamily: 'inherit' }
const pill = (on: boolean, tone: 'ink' | 'copper' = 'ink'): CSSProperties => ({
  border: `1px solid ${on ? (tone === 'copper' ? '#b0662f' : 'var(--text-strong)') : 'var(--border-strong)'}`,
  background: on ? (tone === 'copper' ? '#b0662f' : 'var(--text-strong)') : 'var(--surface)',
  color: on ? 'var(--surface)' : 'var(--text-strong)',
  borderRadius: 999,
  padding: '0.3rem 0.8rem',
  fontSize: 13,
  fontWeight: 600,
  cursor: 'pointer',
})
const quietBtn: CSSProperties = { background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 13, padding: '0.4rem 0.2rem' }
const btn: CSSProperties = { border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--text-strong)', borderRadius: 8, padding: '0.5rem 0.9rem', fontSize: 13, fontWeight: 600, cursor: 'pointer' }
const primaryBtn: CSSProperties = { ...btn, background: '#2563eb', border: '1px solid #2563eb', color: '#fff' }

export default function TestReportModal({
  job,
  initialReportId,
  zIndex,
  onClose,
  onChanged,
}: {
  job: JobWithDetails
  initialReportId: string | null
  zIndex?: number
  onClose: () => void
  onChanged: () => void
}) {
  const { user } = useAuth()
  const { showToast } = useToastContext()
  const confirmDialog = useConfirmDialog()
  const isMobile = useIsMobile()

  const [settings, setSettings] = useState<TestReportSettings>(() => cachedTestReportSettings())
  const [reports, setReports] = useState<TestReportRow[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedId, setSelectedId] = useState<string | null>(initialReportId)
  const [data, setData] = useState<TestReportData>(() => emptyTestReportData('pre_test', todayYmdInAppTz()))
  const [dirty, setDirty] = useState(false)
  const [saving, setSaving] = useState(false)
  const [pdfBusy, setPdfBusy] = useState(false)
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [sendOpen, setSendOpen] = useState(false)
  const [pressureText, setPressureText] = useState<Record<GasPressureUnit, string>>({ psi: '', inWc: '', ozIn2: '', mmWc: '' })

  const jobInfo = useMemo(() => testReportJobInfoFromJob(job), [job])
  const payLink = useMemo(() => jobStripePayLink(job), [job])
  const selected = useMemo(() => reports.find((r) => r.id === selectedId) ?? null, [reports, selectedId])

  const applyRow = useCallback((row: TestReportRow | null) => {
    const next = row ? testReportDataFromRow(row) : emptyTestReportData('pre_test', todayYmdInAppTz())
    setData(next)
    setPressureText(next.gasPressurePsi != null && next.gasPressurePsi > 0 ? textsFromPsi(next.gasPressurePsi) : { psi: '', inWc: '', ozIn2: '', mmWc: '' })
    setDirty(false)
  }, [])

  const loadReports = useCallback(async (): Promise<TestReportRow[]> => {
    const rows = (await withSupabaseRetry(
      async () => supabase.from('job_test_reports').select('*').eq('job_id', job.id).order('created_at', { ascending: false }),
      'load job test reports',
    )) as TestReportRow[] | null
    const list = rows ?? []
    setReports(list)
    return list
  }, [job.id])

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const [s, list] = await Promise.all([fetchTestReportSettings(), loadReports()])
        if (cancelled) return
        setSettings(s)
        const pick = (initialReportId ? list.find((r) => r.id === initialReportId) : null) ?? list.find((r) => r.status === 'draft') ?? null
        setSelectedId(pick?.id ?? null)
        applyRow(pick)
      } catch (e) {
        if (!cancelled) showToast(formatErrorMessage(e, 'Could not load test reports'), 'error')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [initialReportId, loadReports, applyRow, showToast])

  const update = (patch: Partial<TestReportData>) => {
    setData((d) => ({ ...d, ...patch }))
    setDirty(true)
  }

  const pickReport = async (row: TestReportRow | null) => {
    setSendOpen(false)
    if (dirty) {
      const ok = await confirmDialog({ title: 'Unsaved changes', message: 'Leave this report without saving?', confirmLabel: 'Leave', danger: true })
      if (!ok) return
    }
    setSelectedId(row?.id ?? null)
    applyRow(row)
  }

  const requestClose = async () => {
    if (dirty) {
      const ok = await confirmDialog({ title: 'Unsaved changes', message: 'Close without saving this report?', confirmLabel: 'Close', danger: true })
      if (!ok) return
    }
    onClose()
  }

  const save = async (): Promise<TestReportRow | null> => {
    if (!user?.id) {
      showToast('Not signed in', 'error')
      return null
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(data.testDateYmd)) {
      showToast('Pick the test date.', 'error')
      return null
    }
    setSaving(true)
    try {
      const payload = testReportRowFromData(data)
      let id = selectedId
      if (id) {
        await withSupabaseRetry(async () => supabase.from('job_test_reports').update(payload).eq('id', id!), 'update job test report')
      } else {
        const inserted = (await withSupabaseRetry(
          async () => supabase.from('job_test_reports').insert({ ...payload, job_id: job.id, created_by: user.id }).select('id').single(),
          'insert job test report',
        )) as { id: string } | null
        id = inserted?.id ?? null
      }
      const list = await loadReports()
      const row = list.find((r) => r.id === id) ?? null
      setSelectedId(row?.id ?? null)
      setDirty(false)
      showToast(selected?.status === 'sent' ? 'Report updated — re-send it for the GC to see the change.' : 'Draft saved.', 'success')
      onChanged()
      return row
    } catch (e) {
      showToast(formatErrorMessage(e, 'Could not save the test report'), 'error')
      return null
    } finally {
      setSaving(false)
    }
  }

  const deleteDraft = async () => {
    if (!selected || selected.status !== 'draft') return
    const ok = await confirmDialog({ title: 'Delete this draft?', message: `${testReportShortLabel(data.testType, data.system)} on ${jobInfo.jobName || 'this job'} will be removed.`, confirmLabel: 'Delete', danger: true })
    if (!ok) return
    try {
      await withSupabaseRetry(async () => supabase.from('job_test_reports').delete().eq('id', selected.id), 'delete job test report')
      const list = await loadReports()
      const next = list.find((r) => r.status === 'draft') ?? null
      setSelectedId(next?.id ?? null)
      applyRow(next)
      showToast('Draft deleted.', 'success')
      onChanged()
    } catch (e) {
      showToast(formatErrorMessage(e, 'Could not delete the draft'), 'error')
    }
  }

  /** Send needs a saved row (the PDF is stored against it); save first when new or dirty. */
  const openSend = async () => {
    if (!selectedId || dirty) {
      const row = await save()
      if (!row) return
    }
    setSendOpen(true)
  }

  const downloadPdf = async () => {
    setPdfBusy(true)
    try {
      const blob = await buildTestReportPdfBlob(data, jobInfo, settings)
      const url = URL.createObjectURL(blob)
      const win = window.open(url, '_blank', 'noopener')
      if (!win) {
        const a = document.createElement('a')
        a.href = url
        a.download = testReportPdfFilename(jobInfo, data)
        document.body.appendChild(a)
        a.click()
        a.remove()
      }
      window.setTimeout(() => URL.revokeObjectURL(url), 60_000)
    } catch (e) {
      showToast(formatErrorMessage(e, 'Could not build the PDF'), 'error')
    } finally {
      setPdfBusy(false)
    }
  }

  // Gas pressure: whichever unit was typed is the source; the other three follow.
  const setPressure = (unit: GasPressureUnit, text: string) => {
    const n = Number(text)
    if (text.trim() === '' || !Number.isFinite(n) || n < 0) {
      setPressureText({ psi: '', inWc: '', ozIn2: '', mmWc: '', [unit]: text })
      update({ gasPressurePsi: null })
      return
    }
    const psi = gasPressureToPsi(unit, n)
    setPressureText({ ...textsFromPsi(psi), [unit]: text })
    update({ gasPressurePsi: psi })
  }

  const blocks = useMemo(() => buildTestReportBlocks(data, jobInfo, settings), [data, jobInfo, settings])
  const resolved = useMemo(() => resolveTestReportText(data, settings), [data, settings])
  const hydro = isHydrostaticType(data.testType)
  const today = todayYmdInAppTz()
  const statusChip = selected ? (
    <span style={{ fontSize: 11, fontWeight: 700, borderRadius: 999, padding: '2px 8px', background: selected.status === 'sent' ? '#e8f5ec' : '#fff6e0', color: selected.status === 'sent' ? '#1f7a3a' : '#b7791f' }}>{testReportStatusLabel(selected)}</span>
  ) : (
    <span style={{ fontSize: 11, fontWeight: 700, borderRadius: 999, padding: '2px 8px', background: 'var(--surface-muted, var(--surface))', color: 'var(--text-muted)', border: '1px solid var(--border)' }}>New</span>
  )

  const footer = (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
      <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'center' }}>
        <button type="button" style={quietBtn} onClick={() => openInExternalBrowser(buildClickToolingUrl(job))} title="The old report site, kept one release while this replaces it">
          Open in Plumbing Tooling ↗
        </button>
        {selected?.status === 'draft' ? (
          <button type="button" style={{ ...quietBtn, color: '#b42318' }} onClick={() => void deleteDraft()}>
            Delete draft
          </button>
        ) : null}
      </div>
      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
        <button type="button" style={btn} disabled={pdfBusy} onClick={() => void downloadPdf()}>
          {pdfBusy ? 'Building…' : 'Download PDF'}
        </button>
        <button type="button" style={primaryBtn} disabled={saving || loading} onClick={() => void save()}>
          {saving ? 'Saving…' : selected ? 'Save' : 'Save draft'}
        </button>
        <button
          type="button"
          style={{ ...primaryBtn, background: '#b0662f', border: '1px solid #b0662f' }}
          disabled={saving || loading || sendOpen}
          onClick={() => void openSend()}
          title="Email the PDF to the GC with the job's Stripe pay link"
        >
          {selected?.status === 'sent' ? 'Send again…' : 'Send to GC…'}
        </button>
      </div>
    </div>
  )

  return (
    <ResponsiveModalShell
      title={`Test report · ${jobInfo.jobNumber ? `J${jobInfo.jobNumber} ` : ''}${jobInfo.jobName || jobInfo.jobAddress}`}
      onRequestClose={() => void requestClose()}
      footer={footer}
      headerAction={statusChip}
      maxWidthDesktop={1120}
      zIndex={zIndex}
    >
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1.05fr 0.95fr', gap: isMobile ? 16 : 24, padding: '0.25rem 0 1rem' }}>
        <div>
          {/* Reports on this job */}
          <div style={{ ...field, display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
            <span style={{ ...label, marginBottom: 0, marginRight: 4 }}>{loading ? 'Loading…' : reports.length ? 'On this job' : 'No reports yet'}</span>
            {reports.map((r) => (
              <button key={r.id} type="button" style={pill(r.id === selectedId)} onClick={() => void pickReport(r)}>
                {testReportShortLabel(r.test_type as TestReportType, (r.system as 'supply' | 'sewer' | null) ?? null)}
                {r.result ? ` · ${r.result.toUpperCase()}` : ''} · {r.test_date} · {testReportStatusLabel(r)}
              </button>
            ))}
            <button type="button" style={pill(selectedId === null && !loading)} onClick={() => void pickReport(null)}>
              + New
            </button>
          </div>

          <div style={field}>
            <div style={label}>Test type</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {TEST_REPORT_TYPES.map((t) => (
                <button key={t} type="button" style={pill(data.testType === t)} onClick={() => update({ testType: t, system: isHydrostaticType(t) ? (data.system ?? 'sewer') : null, result: isHydrostaticType(t) ? data.result : null, durationMinutes: isHydrostaticType(t) ? (data.durationMinutes ?? 60) : null })}>
                  {TYPE_LABEL[t]}
                </button>
              ))}
            </div>
            {hydro ? (
              <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
                {(['supply', 'sewer'] as const).map((s) => (
                  <button key={s} type="button" style={pill(data.system === s, 'copper')} onClick={() => update({ system: s })}>
                    {s === 'supply' ? 'Supply' : 'Sewer'}
                  </button>
                ))}
              </div>
            ) : null}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: hydro ? '1fr 1fr' : '1fr', gap: 12 }}>
            <div style={field}>
              <div style={label}>Test date</div>
              <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                <input type="date" value={data.testDateYmd} onChange={(e) => update({ testDateYmd: e.target.value })} style={{ ...input, width: 'auto', flex: 1 }} />
                <button type="button" style={pill(data.testDateYmd === ymdAddDays(today, -1))} onClick={() => update({ testDateYmd: ymdAddDays(today, -1) })}>Yesterday</button>
                <button type="button" style={pill(data.testDateYmd === today)} onClick={() => update({ testDateYmd: today })}>Today</button>
              </div>
            </div>
            {hydro ? (
              <div style={field}>
                <div style={label}>Duration (minutes)</div>
                <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  <input type="number" min={1} value={data.durationMinutes ?? ''} onChange={(e) => update({ durationMinutes: e.target.value === '' ? null : Math.max(1, Math.round(Number(e.target.value))) })} style={{ ...input, width: 84 }} />
                  {TEST_REPORT_DURATION_CHOICES.map((m) => (
                    <button key={m} type="button" style={pill(data.durationMinutes === m)} onClick={() => update({ durationMinutes: m })}>{m}</button>
                  ))}
                </div>
              </div>
            ) : null}
          </div>

          {hydro ? (
            <div style={field}>
              <div style={label}>Result</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                {(['pass', 'fail'] as const).map((r) => {
                  const on = data.result === r
                  const color = r === 'pass' ? '#1f7a3a' : '#b42318'
                  return (
                    <button key={r} type="button" onClick={() => update({ result: r })} style={{ textAlign: 'left', border: `2px solid ${on ? color : 'var(--border-strong)'}`, background: on ? (r === 'pass' ? '#e8f5ec' : '#fdecea') : 'var(--surface)', borderRadius: 10, padding: '0.6rem 0.8rem', cursor: 'pointer' }}>
                      <div style={{ fontWeight: 800, fontSize: 15, color: on ? color : 'var(--text-strong)' }}>{r.toUpperCase()}</div>
                      <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{r === 'pass' ? 'No leaks or pressure loss detected' : 'Leaks or pressure loss detected'}</div>
                    </button>
                  )
                })}
              </div>
            </div>
          ) : null}

          {data.testType === 'pinpoint' ? (
            <>
              <div style={field}>
                <div style={label}>Pinpoint location</div>
                <textarea rows={2} value={data.pinpointLocation} onChange={(e) => update({ pinpointLocation: e.target.value })} placeholder="Where the pinpoint test was performed" style={input} />
              </div>
              <div style={field}>
                <div style={label}>Test method</div>
                <input type="text" value={data.pinpointMethod} onChange={(e) => update({ pinpointMethod: e.target.value })} placeholder={settings.pinpointMethodDefault} style={input} />
              </div>
              <div style={field}>
                <div style={label}>Findings</div>
                <textarea rows={5} value={data.pinpointFindings} onChange={(e) => update({ pinpointFindings: e.target.value })} placeholder="Testing revealed a major separation at the second wye fitting approximately 25–26 ft from the exterior clean-out…" style={input} />
              </div>
            </>
          ) : null}

          {data.testType === 'gas' ? (
            <>
              <div style={field}>
                <div style={label}>House pressure — type one, the others follow</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
                  {(
                    [
                      ['psi', 'PSI'],
                      ['inWc', 'in WC'],
                      ['ozIn2', 'oz/in²'],
                      ['mmWc', 'mm WC'],
                    ] as Array<[GasPressureUnit, string]>
                  ).map(([unit, name]) => (
                    <label key={unit} style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                      {name}
                      <input type="number" min={0} step="any" inputMode="decimal" value={pressureText[unit]} onChange={(e) => setPressure(unit, e.target.value)} style={{ ...input, marginTop: 3 }} />
                    </label>
                  ))}
                </div>
                {data.gasPressurePsi != null ? (
                  <button type="button" style={{ ...quietBtn, paddingLeft: 0 }} onClick={() => setPressure('psi', '')}>Reset pressure</button>
                ) : null}
              </div>
              <div style={field}>
                <div style={label}>House utilities</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
                  {GAS_FIXTURE_QUICK_PICKS.map((name) => (
                    <button key={name} type="button" style={pill(false)} onClick={() => update({ gasFixtures: [...data.gasFixtures, { name, btuPerHour: null }] })}>
                      + {name}
                    </button>
                  ))}
                </div>
                {data.gasFixtures.map((f, i) => (
                  <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 140px auto auto', gap: 6, alignItems: 'center', marginBottom: 6 }}>
                    <input type="text" list="test-report-gas-fixtures" value={f.name} placeholder="Fixture" onChange={(e) => update({ gasFixtures: data.gasFixtures.map((g, j) => (j === i ? { ...g, name: e.target.value } : g)) })} style={input} />
                    <input type="number" min={0} step={5000} inputMode="numeric" value={f.btuPerHour ?? ''} placeholder="BTU/hr" onChange={(e) => update({ gasFixtures: data.gasFixtures.map((g, j) => (j === i ? { ...g, btuPerHour: e.target.value === '' ? null : Math.max(0, Number(e.target.value)) } : g)) })} style={input} />
                    <button type="button" style={pill(false)} title="Multiply by 1,000" onClick={() => update({ gasFixtures: data.gasFixtures.map((g, j) => (j === i && g.btuPerHour != null ? { ...g, btuPerHour: g.btuPerHour * 1000 } : g)) })}>×1,000</button>
                    <button type="button" style={{ ...quietBtn, color: '#b42318' }} aria-label="Remove fixture" onClick={() => update({ gasFixtures: data.gasFixtures.filter((_, j) => j !== i) })}>✕</button>
                  </div>
                ))}
                <datalist id="test-report-gas-fixtures">
                  {GAS_FIXTURE_QUICK_PICKS.map((n) => (
                    <option key={n} value={n} />
                  ))}
                  <option value="Other" />
                </datalist>
                <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                  <button type="button" style={pill(false)} onClick={() => update({ gasFixtures: [...data.gasFixtures, { name: '', btuPerHour: null }] })}>+ Add fixture</button>
                  <span style={{ fontSize: 13, fontWeight: 700 }}>Total: {formatBtu(gasFixturesTotalBtu(data.gasFixtures))} BTU/hr</span>
                </div>
              </div>
            </>
          ) : null}

          <div style={field}>
            <div style={label}>Notes</div>
            <textarea rows={3} value={data.notes} onChange={(e) => update({ notes: e.target.value })} placeholder="PVC / ABS / cast iron · lead present? · measured loss of water? · prior plumbing work by others? · toilets re-installed?" style={input} />
          </div>

          <div style={{ ...field, fontSize: 12.5, color: 'var(--text-muted)' }}>
            Certified by <strong style={{ color: 'var(--text-strong)' }}>{settings.certifierName}</strong> {settings.certifierLicense ? `(${settings.certifierLicense})` : ''} · change on Settings → Jobs &amp; billing → Test reports
          </div>

          {hydro ? (
            <div style={field}>
              <button type="button" style={quietBtn} onClick={() => setShowAdvanced((v) => !v)} aria-expanded={showAdvanced}>
                {showAdvanced ? '▾' : '▸'} System, method, pressure, conclusion — change the wording for this report only
              </button>
              {showAdvanced ? (
                <div style={{ display: 'grid', gap: 10, marginTop: 6 }}>
                  <label style={{ fontSize: 12, color: 'var(--text-muted)' }}>System tested<textarea rows={2} value={data.systemTested ?? ''} placeholder={resolved.systemTested} onChange={(e) => update({ systemTested: e.target.value || null })} style={{ ...input, marginTop: 3 }} /></label>
                  <label style={{ fontSize: 12, color: 'var(--text-muted)' }}>Test method<textarea rows={2} value={data.testMethod ?? ''} placeholder={resolved.testMethod} onChange={(e) => update({ testMethod: e.target.value || null })} style={{ ...input, marginTop: 3 }} /></label>
                  <label style={{ fontSize: 12, color: 'var(--text-muted)' }}>Test pressure<input type="text" value={data.testPressure ?? ''} placeholder={resolved.testPressure} onChange={(e) => update({ testPressure: e.target.value || null })} style={{ ...input, marginTop: 3 }} /></label>
                  <label style={{ fontSize: 12, color: 'var(--text-muted)' }}>Conclusion<textarea rows={3} value={data.conclusion ?? ''} placeholder={resolved.conclusion || 'Pick PASS or FAIL for the default conclusion'} onChange={(e) => update({ conclusion: e.target.value || null })} style={{ ...input, marginTop: 3 }} /></label>
                </div>
              ) : null}
            </div>
          ) : null}

          {payLink ? (
            <div style={{ fontSize: 12.5, color: 'var(--text-muted)' }}>Stripe bill on this job: ${payLink.amount.toLocaleString('en-US', { minimumFractionDigits: 2 })} — the pay link rides in the report email.</div>
          ) : (
            <div style={{ fontSize: 12.5, color: 'var(--text-muted)' }}>No Stripe bill on this job yet — Bill Customer first if the report email should carry a pay link.</div>
          )}

          {selected?.status === 'sent' ? (
            <div style={{ marginTop: 10, fontSize: 12.5, color: 'var(--text-muted)', borderLeft: '3px solid #1f7a3a', paddingLeft: 10 }}>
              <strong style={{ color: 'var(--text-strong)' }}>{testReportStatusLabel(selected)}</strong> to {selected.sent_to.join(', ') || '—'}
              {selected.sent_cc.length ? ` · cc ${selected.sent_cc.join(', ')}` : ''}
              {selected.sent_pay_url ? ' · with the pay link' : ' · no pay link'}
              {selected.pdf_version > 1 ? ` · v${selected.pdf_version}` : ''}
              {selected.certifier_name ? ` · certified by ${selected.certifier_name}` : ''}
              {dirty ? ' — unsaved edits here are not what the GC has; Send again to update them.' : ''}
            </div>
          ) : null}

          {sendOpen && selected ? (
            <TestReportSendSheet
              reportId={selected.id}
              data={data}
              jobInfo={jobInfo}
              job={job}
              settings={settings}
              payLink={payLink}
              previouslySentTo={selected.sent_to ?? []}
              onClose={() => setSendOpen(false)}
              onSent={() => {
                setSendOpen(false)
                void loadReports()
                onChanged()
              }}
            />
          ) : null}
        </div>

        <div>
          <div style={{ ...label, display: 'flex', justifyContent: 'space-between' }}>
            <span>Preview · {formatTestType(data.testType, data.system)}</span>
            <span style={{ textTransform: 'none', letterSpacing: 0 }}>what the PDF prints</span>
          </div>
          <TestReportPreview blocks={blocks} />
        </div>
      </div>
    </ResponsiveModalShell>
  )
}

function textsFromPsi(psi: number): Record<GasPressureUnit, string> {
  const p = gasPressureFromPsi(psi)
  return { psi: String(p.psi), inWc: String(p.inWc), ozIn2: String(p.ozIn2), mmWc: String(p.mmWc) }
}
