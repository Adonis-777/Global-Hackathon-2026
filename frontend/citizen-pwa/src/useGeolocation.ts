import { useState } from 'react'

export type LocationSource = 'gps' | 'demo'

export interface LocationState {
  lat: number
  lon: number
  source: LocationSource
}

export function useGeolocation(demoLocation: { lat: number; lon: number }) {
  const [location, setLocation] = useState<LocationState>({ ...demoLocation, source: 'demo' })
  const [status, setStatus] = useState<'idle' | 'locating' | 'granted' | 'denied' | 'unsupported'>('idle')

  const requestLocation = () => {
    if (!('geolocation' in navigator)) {
      setStatus('unsupported')
      return
    }
    setStatus('locating')
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocation({ lat: pos.coords.latitude, lon: pos.coords.longitude, source: 'gps' })
        setStatus('granted')
      },
      () => {
        setStatus('denied')
      },
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 60_000 },
    )
  }

  return { location, status, requestLocation }
}
