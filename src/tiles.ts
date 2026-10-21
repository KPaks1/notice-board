import L from 'leaflet'

interface TileProvider {
  url: string
  attribution: string
}

const OSM: TileProvider = {
  url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
  attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
}

const ESRI: TileProvider = {
  url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}',
  attribution: 'Tiles &copy; <a href="https://www.esri.com">Esri</a>',
}

// OSM serves its "Access blocked" tile as an image with a 418 status, which an <img> tile
// displays without firing tileerror. Probe once with fetch, where the status is visible.
let osmUsable: Promise<boolean> | null = null

function checkOsm(): Promise<boolean> {
  osmUsable ??= fetch('https://tile.openstreetmap.org/0/0/0.png', { signal: AbortSignal.timeout(4000) })
    .then((r) => r.ok, () => false)
  return osmUsable
}

// Adds an OSM base layer to the map, falling back to Esri if OSM is unreachable or starts
// failing mid-session. Returns a cleanup function that cancels a pending add.
export function addBaseTileLayer(map: L.Map): () => void {
  let cancelled = false

  checkOsm().then((ok) => {
    if (cancelled) return
    if (!ok) {
      L.tileLayer(ESRI.url, { attribution: ESRI.attribution }).addTo(map)
      return
    }

    const layer = L.tileLayer(OSM.url, { attribution: OSM.attribution }).addTo(map)
    layer.once('tileerror', () => {
      osmUsable = Promise.resolve(false)
      map.attributionControl?.removeAttribution(OSM.attribution).addAttribution(ESRI.attribution)
      layer.options.attribution = ESRI.attribution
      layer.setUrl(ESRI.url)
    })
  })

  return () => { cancelled = true }
}
