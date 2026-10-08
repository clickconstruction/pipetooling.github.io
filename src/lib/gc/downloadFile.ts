/**
 * GC mode, the real build, the schedule's PR 7a: a file saved through the browser, for Export
 * (G-136). Moved word for word from the GC mode prototype (branch spike/gc-mode,
 * `gcDownloadFile.ts`); the plan is to-dos/gc-mode/mockups/schedule-pr7.md on that branch.
 */

/**
 * GC mode design spike: a file saved through the browser, as the pay application's Excel is saved
 * (`gcPayAppFile.ts`): a link with `download` pressed for the person. Export the schedule (G-136)
 * saves its spreadsheet and its project file this way. Its own file so a test can stand in for it.
 */
export function downloadTextFile(text: string, name: string, type: string): void {
  const url = URL.createObjectURL(new Blob([text], { type }))
  const a = document.createElement('a')
  a.href = url
  a.download = name
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
