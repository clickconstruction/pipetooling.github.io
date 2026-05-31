import { ymdAddDays } from '../utils/dateUtils'

// Default visible window for the Forecast Specific dense calendar: ~180 days centered on
// today. The rail opens with today in the middle and roughly three months of context in
// each direction; the user clicks the sticky `←` / `→` pillar buttons on the timeline's
// edges to extend further in 90-day chunks. The window is intentionally derived from
// `today` only — NOT from the selected job's stage envelope — so:
//   1) Different jobs all open at the same temporal anchor (predictable mental model).
//   2) A historical job with stages from a year ago doesn't scroll the user back a year
//      every time they open it; they see "now" first and pan back if they care.
//   3) The grid auto-centers on today (existing behavior) consistently across jobs.
// The trade-off is that stages outside the default window are hidden until panned to —
// see docs/PROJECT_DOCUMENTATION.md → Forecast Specific for the user-visible behavior.
export const FORECAST_SPECIFIC_DEFAULT_BACK_DAYS = 90
export const FORECAST_SPECIFIC_DEFAULT_FORWARD_DAYS = 90
export const FORECAST_SPECIFIC_EXTEND_DAYS = 90

export interface ForecastSpecificWindow {
  startYmd: string
  endYmd: string
}

/** Compute the default `[today − 90, today + 90]` window. Pure; given the same
 *  `todayYmd` always returns the same range. The caller is responsible for resolving
 *  `todayYmd` in the company calendar timezone (see `todayYmdCentral` in the tab). */
export function computeForecastSpecificDefaultWindow(todayYmd: string): ForecastSpecificWindow {
  return {
    startYmd: ymdAddDays(todayYmd, -FORECAST_SPECIFIC_DEFAULT_BACK_DAYS),
    endYmd: ymdAddDays(todayYmd, FORECAST_SPECIFIC_DEFAULT_FORWARD_DAYS),
  }
}

/** Compute the effective window for the current render. Each edge either uses the
 *  user's pan override (when not null) or the default for that edge. Defensive: if an
 *  override would shrink the window (e.g. `extendedRightYmd` earlier than the default
 *  end), we keep the wider value so the window only ever grows from its default.
 *  Callers should never produce that situation with the `extend*` helpers below, but
 *  the guard means corrupted persisted state (if persistence is ever added) can't
 *  produce a window narrower than the default. */
export function computeForecastSpecificEffectiveWindow(
  todayYmd: string,
  extendedLeftYmd: string | null,
  extendedRightYmd: string | null,
): ForecastSpecificWindow {
  const def = computeForecastSpecificDefaultWindow(todayYmd)
  const startYmd =
    extendedLeftYmd != null && extendedLeftYmd < def.startYmd ? extendedLeftYmd : def.startYmd
  const endYmd =
    extendedRightYmd != null && extendedRightYmd > def.endYmd ? extendedRightYmd : def.endYmd
  return { startYmd, endYmd }
}

/** Pan the LEFT edge back by `FORECAST_SPECIFIC_EXTEND_DAYS` days. Pure: returns the
 *  new start ymd given the current start. The caller wires this into the tab's
 *  `extendedRangeLeftYmd` state. */
export function extendForecastSpecificWindowLeft(currentStartYmd: string): string {
  return ymdAddDays(currentStartYmd, -FORECAST_SPECIFIC_EXTEND_DAYS)
}

/** Pan the RIGHT edge forward by `FORECAST_SPECIFIC_EXTEND_DAYS` days. Pure: returns
 *  the new end ymd given the current end. */
export function extendForecastSpecificWindowRight(currentEndYmd: string): string {
  return ymdAddDays(currentEndYmd, FORECAST_SPECIFIC_EXTEND_DAYS)
}
