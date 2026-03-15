type ClockSessionLocationCellProps = {
  clockInLat: number | null
  clockInLng: number | null
  clockOutLat: number | null
  clockOutLng: number | null
  variant?: 'compact' | 'full'
}

const MapPinIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" width={16} height={16} style={{ display: 'inline-block', verticalAlign: 'middle' }}>
    <path d="M576 112C576 100.9 570.3 90.6 560.8 84.8C551.3 79 539.6 78.4 529.7 83.4L413.5 141.5L234.1 81.6C226 78.9 217.3 79.5 209.7 83.3L81.7 147.3C70.8 152.8 64 163.9 64 176L64 528C64 539.1 69.7 549.4 79.2 555.2C88.7 561 100.4 561.6 110.3 556.6L226.4 498.5L399.7 556.3C395.4 549.9 391.2 543.2 387.1 536.4C376.1 518.1 365.2 497.1 357.1 474.6L255.9 440.9L255.9 156.4L383.9 199.1L383.9 298.4C414.9 262.6 460.9 240 511.9 240C534.5 240 556.1 244.4 575.9 252.5L576 112zM512 288C445.7 288 392 340.8 392 405.9C392 474.8 456.1 556.3 490.6 595.2C502.2 608.2 521.9 608.2 533.5 595.2C568 556.3 632.1 474.8 632.1 405.9C632.1 340.8 578.4 288 512.1 288zM472 408C472 385.9 489.9 368 512 368C534.1 368 552 385.9 552 408C552 430.1 534.1 448 512 448C489.9 448 472 430.1 472 408z" fill="currentColor" />
  </svg>
)

const RouteIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" width={16} height={16} style={{ display: 'inline-block', verticalAlign: 'middle' }}>
    <path d="M576 112C576 100.9 570.3 90.6 560.8 84.8C551.3 79 539.6 78.4 529.7 83.4L413.5 141.5L234.1 81.6C226 78.9 217.3 79.5 209.7 83.3L81.7 147.3C70.8 152.8 64 163.9 64 176L64 528C64 539.1 69.7 549.4 79.2 555.2C88.7 561 100.4 561.6 110.3 556.6L226.4 498.5L405.8 558.3C413.9 561 422.6 560.4 430.2 556.6L558.2 492.6C569 487.2 575.9 476.1 575.9 464L575.9 112zM256 440.9L256 156.4L384 199.1L384 483.6L256 440.9z" fill="currentColor" />
  </svg>
)

const linkStyle: React.CSSProperties = { color: '#2563eb', textDecoration: 'none' }

export function ClockSessionLocationCell({
  clockInLat,
  clockInLng,
  clockOutLat,
  clockOutLng,
  variant = 'compact',
}: ClockSessionLocationCellProps) {
  const hasIn = clockInLat != null && clockInLng != null
  const hasOut = clockOutLat != null && clockOutLng != null
  if (!hasIn && !hasOut) return <>—</>

  if (variant === 'compact') {
    return (
      <>
        In: {hasIn ? <a href={`https://www.google.com/maps?q=${clockInLat},${clockInLng}`} target="_blank" rel="noopener noreferrer" title="View location in Google Maps" style={linkStyle}><MapPinIcon /></a> : '—'}
        {hasOut && <> | Out: <a href={`https://www.google.com/maps?q=${clockOutLat},${clockOutLng}`} target="_blank" rel="noopener noreferrer" title="View location in Google Maps" style={linkStyle}><MapPinIcon /></a></>}
      </>
    )
  }

  const link = (lat: number, lng: number, label: string) => (
    <a
      key={label}
      href={`https://www.google.com/maps?q=${lat},${lng}`}
      target="_blank"
      rel="noopener noreferrer"
      title={`${label}: ${Number(lat).toFixed(4)}, ${Number(lng).toFixed(4)}`}
      style={linkStyle}
    >
      <MapPinIcon />
    </a>
  )
  const routePoints: string[] = []
  if (hasIn) routePoints.push(`${clockInLat},${clockInLng}`)
  if (hasOut) routePoints.push(`${clockOutLat},${clockOutLng}`)
  const routeUrl = `https://www.google.com/maps/dir/${routePoints.join('/')}`

  return (
    <>
      In: {hasIn ? link(clockInLat, clockInLng, 'In') : '—'}
      {hasOut && <> | Out: {link(clockOutLat, clockOutLng, 'Out')}</>}
      {hasIn && hasOut && (
        <>
          {' | '}
          <a href={routeUrl} target="_blank" rel="noopener noreferrer" title="View route in Google Maps" style={linkStyle}>
            <RouteIcon />
          </a>
        </>
      )}
    </>
  )
}
