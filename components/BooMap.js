'use client'

import { useEffect, useRef } from 'react'
import mapboxgl from 'mapbox-gl'
import 'mapbox-gl/dist/mapbox-gl.css'

const DEFAULT_CENTER = [-73.5817, 45.5231] // Montréal (Plateau)

function toGeoJSON(houses) {
  return {
    type: 'FeatureCollection',
    features: (houses || []).map((h) => ({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [h.lng, h.lat] },
      properties: { id: h.id, status: h.status },
    })),
  }
}

export default function BooMap({ houses, userPoint, onSelect, fallbackText }) {
  const containerRef = useRef(null)
  const mapRef = useRef(null)
  const loadedRef = useRef(false)
  const onSelectRef = useRef(onSelect)
  const userMarkerRef = useRef(null)
  const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN

  useEffect(() => { onSelectRef.current = onSelect }, [onSelect])

  // Init map once
  useEffect(() => {
    if (!token || !containerRef.current || mapRef.current) return
    const map = new mapboxgl.Map({
      accessToken: token,
      container: containerRef.current,
      style: 'mapbox://styles/mapbox/dark-v11',
      center: DEFAULT_CENTER,
      zoom: 13,
    })
    mapRef.current = map
    map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), 'top-right')

    map.on('load', () => {
      map.addSource('boohouses', {
        type: 'geojson',
        data: toGeoJSON([]),
        cluster: true,
        clusterMaxZoom: 14,
        clusterRadius: 50,
      })
      map.addLayer({
        id: 'clusters', type: 'circle', source: 'boohouses',
        filter: ['has', 'point_count'],
        paint: {
          'circle-color': '#f97316',
          'circle-opacity': 0.9,
          'circle-stroke-color': '#7c2d12',
          'circle-stroke-width': 2,
          'circle-radius': ['step', ['get', 'point_count'], 18, 10, 24, 50, 32],
        },
      })
      map.addLayer({
        id: 'cluster-count', type: 'symbol', source: 'boohouses',
        filter: ['has', 'point_count'],
        layout: { 'text-field': ['get', 'point_count_abbreviated'], 'text-size': 13 },
        paint: { 'text-color': '#ffffff' },
      })
      map.addLayer({
        id: 'house-points', type: 'circle', source: 'boohouses',
        filter: ['!', ['has', 'point_count']],
        paint: {
          'circle-color': ['match', ['get', 'status'], 'green', '#22c55e', 'red', '#ef4444', 'white', '#f8fafc', '#f8fafc'],
          'circle-radius': 10,
          'circle-stroke-color': '#1e1b2e',
          'circle-stroke-width': 2.5,
        },
      })

      map.on('click', 'clusters', (e) => {
        const feature = map.queryRenderedFeatures(e.point, { layers: ['clusters'] })[0]
        map.getSource('boohouses').getClusterExpansionZoom(feature.properties.cluster_id, (err, zoom) => {
          if (!err) map.easeTo({ center: feature.geometry.coordinates, zoom })
        })
      })
      map.on('click', 'house-points', (e) => {
        const p = e.features[0]
        if (onSelectRef.current) onSelectRef.current(p.properties.id)
      })
      for (const layer of ['clusters', 'house-points']) {
        map.on('mouseenter', layer, () => { map.getCanvas().style.cursor = 'pointer' })
        map.on('mouseleave', layer, () => { map.getCanvas().style.cursor = '' })
      }
      loadedRef.current = true
      map.getSource('boohouses').setData(toGeoJSON(houses))
    })

    return () => { map.remove(); mapRef.current = null; loadedRef.current = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token])

  // Live data updates without remounting the map
  useEffect(() => {
    const map = mapRef.current
    if (map && loadedRef.current) {
      const src = map.getSource('boohouses')
      if (src) src.setData(toGeoJSON(houses))
    }
  }, [houses])

  // User location marker
  useEffect(() => {
    const map = mapRef.current
    if (!map || !userPoint) return
    if (userMarkerRef.current) userMarkerRef.current.remove()
    const el = document.createElement('div')
    el.style.cssText = 'width:18px;height:18px;border-radius:50%;background:#a855f7;border:3px solid #fff;box-shadow:0 0 12px #a855f7;'
    userMarkerRef.current = new mapboxgl.Marker({ element: el }).setLngLat(userPoint).addTo(map)
    map.flyTo({ center: userPoint, zoom: 14 })
  }, [userPoint])

  if (!token) {
    return (
      <div className="flex h-[45vh] min-h-[300px] w-full flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-orange-500/40 bg-[#241a35] p-6 text-center">
        <span className="text-5xl">🗺️👻</span>
        <p className="max-w-md text-sm text-orange-200/80">{fallbackText}</p>
      </div>
    )
  }

  return <div ref={containerRef} className="h-[52vh] min-h-[380px] w-full rounded-xl" data-testid="boo-map" />
}
