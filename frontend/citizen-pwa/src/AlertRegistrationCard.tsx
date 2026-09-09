import { useState, type FormEvent } from 'react'
import { registerCitizen, type RegisteredCitizen } from './api'
import { BellIcon, CheckCircleIcon } from './icons'

const STORAGE_KEY = 'citizen-pwa-registration'

function loadStoredRegistration(): RegisteredCitizen | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

interface Props {
  lat: number
  lon: number
}

export default function AlertRegistrationCard({ lat, lon }: Props) {
  const [registration, setRegistration] = useState<RegisteredCitizen | null>(() => loadStoredRegistration())
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [address, setAddress] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (registration) {
    return (
      <div className="rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-900 p-4 flex items-start gap-3">
        <CheckCircleIcon className="w-5 h-5 shrink-0 mt-0.5" />
        <div>
          <h2 className="font-semibold text-sm">Registered for alerts</h2>
          <p className="text-xs mt-1 opacity-80">
            {registration.name} · {registration.phone_number} · {registration.address}
          </p>
        </div>
      </div>
    )
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!name.trim() || !phone.trim() || !address.trim()) {
      setError('Fill in all three fields.')
      return
    }
    setSubmitting(true)
    setError(null)
    try {
      const result = await registerCitizen({ name: name.trim(), phoneNumber: phone.trim(), address: address.trim(), lat, lon })
      localStorage.setItem(STORAGE_KEY, JSON.stringify(result))
      setRegistration(result)
    } catch (err) {
      setError(String(err))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-xl border border-teal-200 bg-teal-50 text-teal-900 p-4 space-y-2">
      <div className="flex items-center gap-2">
        <BellIcon className="w-5 h-5 shrink-0" />
        <h2 className="font-semibold text-sm">Get SMS/WhatsApp alerts</h2>
      </div>
      <p className="text-xs opacity-80">One-time registration. We'll message you when waterlogging risk rises near your address.</p>

      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Full name"
        className="w-full text-sm rounded-md border border-teal-300 bg-white px-2.5 py-1.5 placeholder:text-slate-400"
      />
      <input
        value={phone}
        onChange={(e) => setPhone(e.target.value)}
        placeholder="Phone number (e.g. +91XXXXXXXXXX)"
        className="w-full text-sm rounded-md border border-teal-300 bg-white px-2.5 py-1.5 placeholder:text-slate-400"
      />
      <input
        value={address}
        onChange={(e) => setAddress(e.target.value)}
        placeholder="Address / locality"
        className="w-full text-sm rounded-md border border-teal-300 bg-white px-2.5 py-1.5 placeholder:text-slate-400"
      />

      {error && <p className="text-xs text-red-600">{error}</p>}

      <button
        type="submit"
        disabled={submitting}
        className="w-full bg-teal-600 text-white text-xs font-medium px-3 py-2 rounded-full hover:bg-teal-700 transition-colors disabled:opacity-50"
      >
        {submitting ? 'Registering...' : 'Register for alerts'}
      </button>
    </form>
  )
}
