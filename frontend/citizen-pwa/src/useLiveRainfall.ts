import { useEffect, useRef, useState } from 'react'
import { fetchForecast, type ForecastHour } from './api'

export interface RainfallReading {
  timestamp: number // real wall-clock ms, when this reading arrived
  day: number
  hourOfDay: number
  rainfallMm: number
}

const STORAGE_KEY = 'citizen-pwa-rainfall-log'
const MAX_HISTORY = 60
const TICK_MS = 6000 // one simulated forecast-hour "arrives" every 6s of real time

function loadStoredHistory(): RainfallReading[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function saveHistory(history: RainfallReading[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(history))
  } catch {
    // localStorage unavailable (private mode, quota) - live readings still work in-memory
  }
}

/**
 * Simulates a live rainfall feed for the citizen PWA: replays the same
 * synthetic 72-hour forecast curve the admin dashboard's simulation uses
 * (GET /api/forecast, real IMD data pending - see data/DATA_SOURCES.md),
 * one hour "arriving" every TICK_MS of real time, looping continuously so
 * there's always a fresh reading (an ongoing feed, not a one-shot demo).
 *
 * Each reading is timestamped with the real wall-clock time it arrived and
 * persisted to localStorage (capped to the last MAX_HISTORY readings) so
 * the recent rainfall history survives a page reload.
 */
export function useLiveRainfall() {
  const [hours, setHours] = useState<ForecastHour[]>([])
  const [history, setHistory] = useState<RainfallReading[]>(() => loadStoredHistory())
  const hourIndexRef = useRef(0)

  useEffect(() => {
    fetchForecast(3).then((res) => setHours(res.hours))
  }, [])

  useEffect(() => {
    if (hours.length === 0) return

    const recordReading = () => {
      const h = hours[hourIndexRef.current % hours.length]
      const reading: RainfallReading = {
        timestamp: Date.now(),
        day: h.day,
        hourOfDay: h.hour_of_day,
        rainfallMm: h.rainfall_mm,
      }
      setHistory((prev) => {
        const next = [...prev, reading].slice(-MAX_HISTORY)
        saveHistory(next)
        return next
      })
      hourIndexRef.current += 1
    }

    recordReading()
    const id = window.setInterval(recordReading, TICK_MS)
    return () => window.clearInterval(id)
  }, [hours])

  const current = history[history.length - 1] ?? null
  return { current, history, loading: hours.length === 0 }
}
