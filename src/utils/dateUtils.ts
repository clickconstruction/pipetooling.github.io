/** Week range: Sunday–Saturday for the current week */
export function getDefaultWeekRange(): { start: string; end: string } {
  const d = new Date()
  const day = d.getDay()
  const start = new Date(d)
  start.setDate(d.getDate() - day)
  const end = new Date(start)
  end.setDate(start.getDate() + 6)
  return {
    start: start.toLocaleDateString('en-CA'),
    end: end.toLocaleDateString('en-CA'),
  }
}

/** Week range: Sunday–Saturday for the previous week */
export function getLastWeekRange(): { start: string; end: string } {
  const d = new Date()
  const day = d.getDay()
  const thisSun = new Date(d)
  thisSun.setDate(d.getDate() - day)
  const lastSun = new Date(thisSun)
  lastSun.setDate(thisSun.getDate() - 7)
  const lastSat = new Date(lastSun)
  lastSat.setDate(lastSun.getDate() + 6)
  return {
    start: lastSun.toLocaleDateString('en-CA'),
    end: lastSat.toLocaleDateString('en-CA'),
  }
}
