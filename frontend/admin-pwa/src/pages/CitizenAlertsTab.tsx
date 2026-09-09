import { useEffect, useState } from 'react'
import { deleteCitizen, fetchCitizens, sendTestAlert, type RegisteredCitizen, type TestAlertResult } from '../api'

export default function CitizenAlertsTab() {
  const [citizens, setCitizens] = useState<RegisteredCitizen[]>([])
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [rainfallMm, setRainfallMm] = useState(100)
  const [loading, setLoading] = useState(false)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [results, setResults] = useState<TestAlertResult[] | null>(null)

  const refresh = () => {
    setLoading(true)
    setError(null)
    fetchCitizens()
      .then((res) => {
        setCitizens(res.citizens)
        setSelected(new Set(res.citizens.map((c) => c.id)))
      })
      .catch((err) => setError(String(err)))
      .finally(() => setLoading(false))
  }

  useEffect(refresh, [])

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const toggleAll = () => {
    setSelected((prev) => (prev.size === citizens.length ? new Set() : new Set(citizens.map((c) => c.id))))
  }

  const handleRemove = async (id: string) => {
    await deleteCitizen(id)
    refresh()
  }

  const handleSend = async () => {
    if (selected.size === 0) return
    setSending(true)
    setError(null)
    setResults(null)
    try {
      const res = await sendTestAlert([...selected], rainfallMm)
      setResults(res.results)
    } catch (err) {
      setError(String(err))
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-4">
      <div className="rounded-lg border border-slate-300 bg-white p-4">
        <div className="flex items-center justify-between mb-2">
          <div>
            <h2 className="text-sm font-semibold text-slate-700">Registered citizens</h2>
            <p className="text-[11px] text-slate-400">
              Citizens who opted in via the Citizen PWA (name, phone, address) to receive real SMS/WhatsApp alerts.
            </p>
          </div>
          <button onClick={refresh} className="text-xs px-3 py-1.5 rounded border border-slate-300 hover:bg-slate-100 whitespace-nowrap">
            Refresh
          </button>
        </div>

        {loading && <p className="text-xs text-slate-400">Loading...</p>}
        {error && <p className="text-xs text-red-600">{error}</p>}

        {!loading && citizens.length === 0 && (
          <p className="text-xs text-slate-400 py-4 text-center">
            No one has registered yet - open the Citizen PWA and use "Get SMS/WhatsApp alerts" to register a demo number.
          </p>
        )}

        {citizens.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-left text-slate-400 border-b border-slate-200">
                  <th className="py-1.5 pr-2">
                    <input type="checkbox" checked={selected.size === citizens.length} onChange={toggleAll} />
                  </th>
                  <th className="py-1.5 pr-2">Name</th>
                  <th className="py-1.5 pr-2">Phone</th>
                  <th className="py-1.5 pr-2">Address</th>
                  <th className="py-1.5 pr-2">Registered</th>
                  <th className="py-1.5 pr-2"></th>
                </tr>
              </thead>
              <tbody>
                {citizens.map((c) => (
                  <tr key={c.id} className="border-b border-slate-100">
                    <td className="py-1.5 pr-2">
                      <input type="checkbox" checked={selected.has(c.id)} onChange={() => toggle(c.id)} />
                    </td>
                    <td className="py-1.5 pr-2 font-medium">{c.name}</td>
                    <td className="py-1.5 pr-2">{c.phone_number}</td>
                    <td className="py-1.5 pr-2">{c.address}</td>
                    <td className="py-1.5 pr-2 text-slate-400">{new Date(c.registered_at).toLocaleString()}</td>
                    <td className="py-1.5 pr-2">
                      <button onClick={() => handleRemove(c.id)} className="text-red-600 hover:underline">
                        Remove
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="rounded-lg border border-slate-300 bg-white p-4 space-y-3">
        <div>
          <h2 className="text-sm font-semibold text-slate-700">Send a testing alert</h2>
          <p className="text-[11px] text-slate-400">
            Demo control for live presentations: bump the rainfall figure and fire a real (or dry-run, without Twilio
            credentials) SMS/WhatsApp message to the selected citizens, referencing their registered address as "the area".
          </p>
        </div>

        <div className="flex items-center gap-3">
          <label className="text-xs text-slate-600 whitespace-nowrap">
            Rainfall for this test:
            <input
              type="number"
              min={0}
              value={rainfallMm}
              onChange={(e) => setRainfallMm(Number(e.target.value))}
              className="ml-2 w-20 border border-slate-300 rounded px-2 py-1 text-xs"
            />
            mm
          </label>
          <span className="text-xs text-slate-400">{selected.size} of {citizens.length} selected</span>
          <button
            onClick={handleSend}
            disabled={sending || selected.size === 0}
            className="ml-auto text-xs font-semibold px-3 py-1.5 rounded bg-orange-800 text-white hover:bg-orange-900 disabled:opacity-50"
          >
            {sending ? 'Sending...' : 'Send Testing Alert'}
          </button>
        </div>

        {results && (
          <div className="pt-2 border-t border-slate-200 space-y-1.5">
            <p className="text-xs font-semibold text-slate-600">Results ({results.length} sent)</p>
            <ul className="space-y-1.5 max-h-60 overflow-y-auto">
              {results.map((r) => (
                <li key={r.citizen.id} className="text-[11px] rounded bg-slate-50 border border-slate-200 p-2">
                  <p>
                    <strong>{r.citizen.name}</strong> ({r.citizen.phone_number}) —{' '}
                    <span className={r.delivery.status === 'sent' ? 'text-emerald-700' : 'text-amber-700'}>{r.delivery.status}</span>
                  </p>
                  <p className="text-slate-500 mt-0.5">{r.message}</p>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  )
}
