/**
 * What a sample frame needs besides its step (v2.4098): the built sample emails and papers, and
 * the origin. The same reads and builders as Settings → What customers see, loaded only while a
 * reader is open. `emailIds` limits the emails built to the ones the caller will show.
 */
import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from './useAuth'
import { withSupabaseRetry } from '../utils/errorHandling'
import { APP_CALENDAR_TZ, todayYmdInAppTz } from '../utils/dateUtils'
import { CUSTOMER_SAMPLE_SETTING_KEYS, buildSampleEmail, type AppSettingRow, type SampleEmailContext } from '../lib/customerSampleEmails'
import type { SampleEmailId } from '../lib/customerJourneys'
import { fetchTestReportSettings } from '../lib/jobs/testReportSettings'
import type { TestReportSettings } from '../lib/jobs/testReport'
import { paperSample, type PaperId, type PaperSample } from '../lib/journeys/paperSamples'
import type { SampleEmails } from '../lib/journeys/stepFrame'

export function useSampleFrameSources(emailIds: readonly SampleEmailId[], paperIds: readonly PaperId[]): { emails: SampleEmails | null; papers: Partial<Record<string, PaperSample>>; origin: string; loading: boolean } {
  const { user, profileName } = useAuth()
  const [rows, setRows] = useState<AppSettingRow[] | null>(null)
  const [senderPhone, setSenderPhone] = useState('')
  const [testReportSettings, setTestReportSettings] = useState<TestReportSettings | null>(null)
  const needsEmails = emailIds.length > 0
  const needsTestReport = emailIds.includes('test-report')

  useEffect(() => {
    if (!needsEmails) return
    let cancelled = false
    void (async () => {
      try {
        const [settings, me, trs] = await Promise.all([
          withSupabaseRetry(() => supabase.from('app_settings').select('key, value_text').in('key', [...CUSTOMER_SAMPLE_SETTING_KEYS]), 'contract reader settings'),
          user?.id ? withSupabaseRetry(() => supabase.from('users').select('phone').eq('id', user.id).maybeSingle(), 'contract reader sender') : Promise.resolve(null),
          needsTestReport ? fetchTestReportSettings().catch(() => null) : Promise.resolve(null),
        ])
        if (cancelled) return
        setTestReportSettings(trs)
        setRows(((settings ?? []) as AppSettingRow[]).map((r) => ({ key: r.key, value_text: r.value_text })))
        setSenderPhone(String((me as { phone?: string | null } | null)?.phone ?? '').trim())
      } catch {
        if (!cancelled) setRows([])
      }
    })()
    return () => {
      cancelled = true
    }
  }, [user?.id, needsEmails, needsTestReport])

  const origin = typeof window !== 'undefined' ? window.location.origin : ''

  const emails = useMemo((): SampleEmails | null => {
    if (!needsEmails) return {}
    if (!rows) return null
    const ctx: SampleEmailContext = {
      rows,
      origin,
      todayYmd: todayYmdInAppTz(),
      dateLabel: new Intl.DateTimeFormat('en-US', { timeZone: APP_CALENDAR_TZ, month: 'short', day: 'numeric', year: 'numeric' }).format(new Date()),
      sender: user?.email ? { name: profileName?.trim() || '', email: user.email, phone: senderPhone } : null,
      testReportSettings,
    }
    const out: SampleEmails = {}
    for (const id of emailIds) {
      try {
        out[id] = buildSampleEmail(id, ctx)
      } catch {
        /* a builder that throws leaves its chip reading "could not build" */
      }
    }
    return out
  }, [needsEmails, rows, origin, user?.email, profileName, senderPhone, testReportSettings, emailIds])

  const papers = useMemo((): Partial<Record<string, PaperSample>> => {
    const today = todayYmdInAppTz()
    const out: Partial<Record<string, PaperSample>> = {}
    for (const id of paperIds) {
      try {
        out[id] = paperSample(id, today)
      } catch {
        /* same */
      }
    }
    return out
  }, [paperIds])

  return { emails, papers, origin, loading: needsEmails && rows === null }
}
