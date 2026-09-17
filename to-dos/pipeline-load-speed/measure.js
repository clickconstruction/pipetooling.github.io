// Pipeline load-speed measurement — paste into the browser console on any Jobs
// tab OTHER than Pipeline (dev server, signed in). It clicks the Pipeline tab,
// records every Supabase request from that click, notes when the board's
// "Loading jobs…" block disappears, and prints a summary after 15 s.
//
// Use SPA clicks only: a full navigation to /jobs?tab=stages under Vite floods
// the resource-timing buffer with module requests and the Supabase entries are
// lost. Run once cold (fresh page load first) and once warm (switch away, back).
;(() => {
  const reqs = []
  const marks = {}
  const t0 = performance.now()
  const obs = new PerformanceObserver((list) => {
    for (const e of list.getEntries()) {
      if (!e.name.includes('supabase.co')) continue
      reqs.push({
        url: e.name.replace(/^https:\/\/[^/]+/, '').replace(/[?&]apikey=[^&]*/, ''),
        start: Math.round(e.startTime - t0),
        ms: Math.round(e.duration),
      })
    }
  })
  obs.observe({ type: 'resource', buffered: false })

  let sawLoading = false
  const poll = setInterval(() => {
    const t = Math.round(performance.now() - t0)
    const loading = /Loading jobs…/.test(document.body.innerText)
    if (loading && !marks.sawLoading) marks.sawLoading = t
    if (loading) sawLoading = true
    if (sawLoading && !loading && !marks.boardReady) marks.boardReady = t
  }, 50)

  const tab = [...document.querySelectorAll('button,a')].find((x) => /^Pipeline$/.test(x.textContent.trim()))
  if (!tab) {
    console.warn('No Pipeline tab on this page — open Jobs first.')
    clearInterval(poll)
    obs.disconnect()
    return
  }
  tab.click()

  setTimeout(() => {
    clearInterval(poll)
    obs.disconnect()
    const rows = reqs.slice().sort((a, b) => a.start - b.start)
    const agg = {}
    for (const r of rows) {
      const k = r.url.split('?')[0].replace('/rest/v1/', '')
      agg[k] = agg[k] || { n: 0, ms: 0 }
      agg[k].n += 1
      agg[k].ms += r.ms
    }
    const boardAt = marks.boardReady ?? null
    console.log('Pipeline load — summary')
    console.table({
      'requests total': rows.length,
      'requests before board': boardAt == null ? '(no Loading block seen — warm cache)' : rows.filter((r) => r.start < boardAt).length,
      'board visible at (ms)': boardAt ?? '(warm)',
      'last response ended (ms)': rows.length ? Math.max(...rows.map((r) => r.start + r.ms)) : 0,
    })
    console.table(
      Object.entries(agg)
        .sort((a, b) => b[1].ms - a[1].ms)
        .map(([endpoint, v]) => ({ endpoint, requests: v.n, 'summed ms': v.ms })),
    )
    window.__pipelineLoadRequests = rows
    console.log('Per-request rows in window.__pipelineLoadRequests')
  }, 15000)
})()
