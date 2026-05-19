export function parseXomTime(xom) {
  if (!xom || xom === 'Not Specified') return null
  if (typeof xom === 'number') return xom
  const parts = String(xom).split(':').map(Number)
  if (parts.some(isNaN) || parts.length < 2 || parts.length > 3) return null
  return parts.length === 3
    ? parts[0] * 3600 + parts[1] * 60 + parts[2]
    : parts[0] * 60 + parts[1]
}

export function extractCoreFields(detail) {
  return {
    komTime:       parseXomTime(detail.xoms?.kom),
    qomTime:       parseXomTime(detail.xoms?.qom),
    polyline:      detail.map?.polyline ?? null,
    elevationGain: detail.total_elevation_gain ?? null,
    translatedName: detail.translatedName ?? null,
  }
}
