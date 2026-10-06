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
