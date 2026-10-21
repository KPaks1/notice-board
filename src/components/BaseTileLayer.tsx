import { useEffect } from 'react'
import { useMap } from 'react-leaflet'
import { addBaseTileLayer } from '../tiles'

export default function BaseTileLayer() {
  const map = useMap()
  useEffect(() => addBaseTileLayer(map), [map])
  return null
}
