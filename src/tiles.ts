import L from 'leaflet'

interface TileProvider {
  url: string
  attribution: string
  probeUrl: string
}

const ESRI: TileProvider = {
  url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}',
  attribution: 'Tiles &copy; <a href="https://www.esri.com">Esri</a>',
  probeUrl: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/0/0/0',
}

const OSM: TileProvider = {
  url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
  attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
  probeUrl: 'https://tile.openstreetmap.org/0/0/0.png',
}

const PRIMARY = ESRI
const FALLBACK = OSM

let primaryUsable: Promise<boolean> | null = null

function checkPrimary(): Promise<boolean> {
  primaryUsable ??= fetch(PRIMARY.probeUrl, { signal: AbortSignal.timeout(4000) })
    .then((r) => r.ok, () => false)
  return primaryUsable
}

export function addBaseTileLayer(map: L.Map): () => void {
  let cancelled = false

  checkPrimary().then((ok) => {
    if (cancelled) return
    if (!ok) {
      L.tileLayer(FALLBACK.url, { attribution: FALLBACK.attribution }).addTo(map)
      return
    }

    const layer = L.tileLayer(PRIMARY.url, { attribution: PRIMARY.attribution }).addTo(map)
    layer.once('tileerror', () => {
      primaryUsable = Promise.resolve(false)
      map.attributionControl?.removeAttribution(PRIMARY.attribution).addAttribution(FALLBACK.attribution)
      layer.options.attribution = FALLBACK.attribution
      layer.setUrl(FALLBACK.url)
    })
  })

  return () => { cancelled = true }
}
