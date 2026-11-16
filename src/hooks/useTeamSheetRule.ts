/**
 * SPIKE ONLY (2026-11-15): which rule the page reads teammate sheets under, so Taunya can read the same screen under
 * each before picking one (`teamSheetRule.ts`). `?teamSheets=owed` or `?teamSheets=payroll` on the address sets it
 * and it is remembered in this browser. With neither, it is her pick of 2026-11-15, `owed`. This hook goes away at
 * wrap-up and every reader takes the constant.
 */
import { useCallback, useEffect, useState } from 'react'
import { TEAM_SHEET_RULE, type TeamSheetRule } from '../lib/subWorkOrders/teamSheetRule'

const KEY = 'spike.teamSheets'
const EVENT = 'spike-team-sheets-changed'

function read(withUrl: boolean): TeamSheetRule {
  try {
    const fromUrl = withUrl ? new URLSearchParams(window.location.search).get('teamSheets') : null
    if (fromUrl === 'owed' || fromUrl === 'payroll') {
      window.localStorage.setItem(KEY, fromUrl)
      return fromUrl
    }
    const kept = window.localStorage.getItem(KEY)
    if (kept === 'owed' || kept === 'payroll') return kept
  } catch {
    // A private window: the rule is today's.
  }
  return TEAM_SHEET_RULE
}

export function useTeamSheetRule(): [TeamSheetRule, (rule: TeamSheetRule) => void] {
  const [rule, setRule] = useState<TeamSheetRule>(() => read(true))
  useEffect(() => {
    const onChange = () => setRule(read(false))
    window.addEventListener(EVENT, onChange)
    return () => window.removeEventListener(EVENT, onChange)
  }, [])
  const set = useCallback((next: TeamSheetRule) => {
    try {
      window.localStorage.setItem(KEY, next)
    } catch {
      // Kept for this page only.
    }
    setRule(next)
    window.dispatchEvent(new Event(EVENT))
  }, [])
  return [rule, set]
}
