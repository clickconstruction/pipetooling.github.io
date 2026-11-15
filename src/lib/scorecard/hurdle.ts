/**
 * The hurdle (team scorecard, design spike 2026-11-15): what one paid field hour has to make
 * before the company keeps anything. Break-even is the overhead pool over the same window's
 * paid field hours; the hurdle is break-even plus the profit per hour the owner wants. The
 * target is the one setting (`scorecard_hurdle_v1`); nothing here is a hard-coded dollar.
 * Pure: the loader passes the pool and the hours.
 */

export const APP_SETTINGS_KEY_SCORECARD_HURDLE_V1 = 'scorecard_hurdle_v1' as const

export type HurdleSetting = {
  /** The profit per paid field hour the owner wants on top of break-even. */
  targetProfitPerHourUsd: number
}

export const DEFAULT_HURDLE_SETTING: HurdleSetting = { targetProfitPerHourUsd: 25 }

export function parseHurdleSetting(raw: string | null | undefined): HurdleSetting {
  if (!raw) return DEFAULT_HURDLE_SETTING
  try {
    const o = JSON.parse(raw) as { targetProfitPerHourUsd?: unknown }
    const n = Number(o?.targetProfitPerHourUsd)
    if (!Number.isFinite(n) || n < 0 || n > 1000) return DEFAULT_HURDLE_SETTING
    return { targetProfitPerHourUsd: Math.round(n * 100) / 100 }
  } catch {
    return DEFAULT_HURDLE_SETTING
  }
}

export function serializeHurdleSetting(s: HurdleSetting): string {
  return JSON.stringify({ targetProfitPerHourUsd: s.targetProfitPerHourUsd })
}

export type Hurdle = {
  /** Overhead per paid field hour over the window; null when no hours were paid. */
  breakEvenPerHourUsd: number | null
  targetProfitPerHourUsd: number
  /** Break-even + target; null when break-even is unknown. */
  hurdlePerHourUsd: number | null
  overheadUsd: number
  paidFieldHours: number
  windowDays: number
}

export function buildHurdle(args: { overheadUsd: number; paidFieldHours: number; windowDays: number; setting: HurdleSetting }): Hurdle {
  const hours = Math.max(0, args.paidFieldHours)
  const breakEven = hours > 0 ? args.overheadUsd / hours : null
  return {
    breakEvenPerHourUsd: breakEven,
    targetProfitPerHourUsd: args.setting.targetProfitPerHourUsd,
    hurdlePerHourUsd: breakEven == null ? null : breakEven + args.setting.targetProfitPerHourUsd,
    overheadUsd: args.overheadUsd,
    paidFieldHours: hours,
    windowDays: args.windowDays,
  }
}

export const usdPerHour = (n: number): string => `${n < 0 ? '−' : ''}$${Math.round(Math.abs(n)).toLocaleString('en-US')}/h`

/** One sentence under the hurdle figure, in plain words. */
export function hurdleWords(h: Hurdle): string {
  if (h.breakEvenPerHourUsd == null || h.hurdlePerHourUsd == null) return `No paid field hours in the last ${h.windowDays} days, so there is no break-even yet.`
  return `Break-even is ${usdPerHour(h.breakEvenPerHourUsd)}: $${Math.round(h.overheadUsd).toLocaleString('en-US')} of overhead over ${Math.round(h.paidFieldHours).toLocaleString('en-US')} paid field hours in ${h.windowDays} days. The hurdle adds the ${usdPerHour(h.targetProfitPerHourUsd)} target.`
}

/** Clears when the figure is at or above the hurdle. Null when there is no hurdle or no figure. */
export function clearsHurdle(perHourUsd: number | null, h: Pick<Hurdle, 'hurdlePerHourUsd'>): boolean | null {
  if (perHourUsd == null || h.hurdlePerHourUsd == null) return null
  return perHourUsd >= h.hurdlePerHourUsd
}
