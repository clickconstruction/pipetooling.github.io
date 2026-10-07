/**
 * GC mode — design spike: the superintendent's daily log (Building lane, owner 2026-10-04). One
 * log per working day on a job being built: the weather, who was on site and how many, what got
 * done, what held work up (the look-ahead's reasons), and who came by. It backs up the
 * look-ahead marks (who was on site that week) and says when a working day has no log.
 *
 * Import from `./gcModel`.
 */
// What moved to main (the real build) is re-exported from there, so there is one copy.
export { LOG_LOOKBACK_WORKDAYS, dailyLogOn, daysSinceLastLog, logDelays, logTrades, missingLogs, missingLogsWords, newDailyLog, weekOfLogs, workdaysBetween } from '../gc/buildingLog'

export { isWorkday, onSite, onSiteWords } from '../gc/buildingLog'
