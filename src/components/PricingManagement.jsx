
import { useEffect, useState } from 'react'

import {
  DEFAULT_PRICING,
  loadPricing,
  saveDefaultPricing,
  saveSeasonalPricing,
  deleteSeasonalPricing
} from '../utils/pricing.js'

import './PricingManagement.css'

const EMPTY_SEASON = {
  name: '',
  startDate: '',
  endDate: '',
  nightlyRate: 400,
  minimumStay: 1
}

export default function PricingManagement() {
  const [settings, setSettings] = useState({
    ...DEFAULT_PRICING
  })

  const [seasons, setSeasons] = useState([])
  const [season, setSeason] = useState({
    ...EMPTY_SEASON
  })

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  // LOAD PRICING

  async function refreshPricing() {
    const result = await loadPricing()

    setSettings(result.settings)

    setSeasons(
      result.seasons.sort((a, b) =>
        a.startDate.localeCompare(b.startDate)
      )
    )
  }

  useEffect(() => {
    refreshPricing()
      .catch(err => {
        console.error(err)
        setError('Unable to load pricing settings.')
      })
      .finally(() => setLoading(false))
  }, [])

  // SAVE DEFAULT SETTINGS

  async function handleSaveDefault(event) {
    event.preventDefault()

    setSaving(true)
    setMessage('')
    setError('')

    try {
      await saveDefaultPricing(settings)
      await refreshPricing()

      setMessage('Default pricing saved successfully.')
    } catch (err) {
      console.error(err)
      setError('Unable to save default pricing.')
    } finally {
      setSaving(false)
    }
  }

  // SAVE SEASON

  async function handleSaveSeason(event) {
    event.preventDefault()

    setMessage('')
    setError('')

    if (!season.name.trim()) {
      setError('Please enter a season name.')
      return
    }

    if (season.endDate < season.startDate) {
      setError('End date cannot be before start date.')
      return
    }

    const duration = item =>
      Date.parse(item.endDate) -
      Date.parse(item.startDate)

    const conflict = seasons.some(existing =>
      existing.id !== season.id &&
      season.startDate <= existing.endDate &&
      season.endDate >= existing.startDate &&
      duration(existing) === duration(season)
    )

    if (conflict) {
      setError(
        'This period conflicts with another equally specific pricing period.'
      )
      return
    }

    setSaving(true)

    try {
      await saveSeasonalPricing(season)
      await refreshPricing()

      setSeason({ ...EMPTY_SEASON })
      setShowForm(false)
      setMessage('Seasonal pricing saved successfully.')
    } catch (err) {
      console.error(err)
      setError('Unable to save seasonal pricing.')
    } finally {
      setSaving(false)
    }
  }

  // EDIT SEASON

  function handleEdit(item) {
    setSeason({ ...item })
    setShowForm(true)
    setMessage('')
    setError('')
  }

  // DELETE SEASON

  async function handleDelete(item) {
    const confirmed = window.confirm(
      `Delete pricing period "${item.name}"?`
    )

    if (!confirmed) return

    setSaving(true)
    setMessage('')
    setError('')

    try {
      await deleteSeasonalPricing(item.id)
      await refreshPricing()

      setSeason({ ...EMPTY_SEASON })
      setShowForm(false)
      setMessage('Pricing period deleted.')
    } catch (err) {
      console.error(err)
      setError('Unable to delete pricing period.')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return <p>Loading pricing settings...</p>
  }

  return (
    <section className="pricing-management">

      <h2>Pricing Management</h2>

      <p>
        Manage accommodation rates and minimum stays.
        Rates are entered per person, per night.
        Automatic booking prices have a minimum charge equivalent
        to two guests per night, including seasonal rates.
        Owners may override the final agreed reservation price.
      </p>

      {message && (
        <div className="pricing-success" role="status">
          {message}
        </div>
      )}

      {error && (
        <div className="pricing-error" role="alert">
          {error}
        </div>
      )}

      {/* DEFAULT PRICING */}

      <div className="pricing-card">

        <h3>Standard Pricing</h3>

        <form onSubmit={handleSaveDefault}>

          <div className="pricing-fields">

            <label>
              Nightly rate (R)

              <input
                type="number"
                min="1"
                max="100000"
                step="1"
                required
                value={settings.nightlyRate}
                onChange={event =>
                  setSettings({
                    ...settings,
                    nightlyRate: event.target.value
                  })
                }
              />
            </label>

            <label>
              Minimum stay (nights)

              <input
                type="number"
                min="1"
                max="30"
                required
                value={settings.minimumStay}
                onChange={event =>
                  setSettings({
                    ...settings,
                    minimumStay: event.target.value
                  })
                }
              />
            </label>

          </div>

          <button
            type="submit"
            className="pricing-button"
            disabled={saving}
          >
            Save Standard Pricing
          </button>

        </form>

      </div>

      {/* SEASONAL PRICING */}

      <div className="pricing-card">

        <h3>Seasonal Pricing</h3>

        <p>
          Set special rates for holidays, peak seasons
          or individual dates.
        </p>

        <button
          type="button"
          className="pricing-button"
          disabled={saving}
          onClick={() => {
            setSeason({ ...EMPTY_SEASON })
            setShowForm(true)
            setError('')
            setMessage('')
          }}
        >
          + Add Pricing Period
        </button>

        {showForm && (

          <form
            className="pricing-season-form"
            onSubmit={handleSaveSeason}
          >

            <h3>
              {season.id
                ? 'Edit Pricing Period'
                : 'New Pricing Period'}
            </h3>

            <label>
              Period name

              <input
                type="text"
                placeholder="e.g. Christmas Holidays"
                maxLength="100"
                required
                value={season.name}
                onChange={event =>
                  setSeason({
                    ...season,
                    name: event.target.value
                  })
                }
              />
            </label>

            <div className="pricing-fields">

              <label>
                Start date

                <input
                  type="date"
                  required
                  value={season.startDate}
                  onChange={event =>
                    setSeason({
                      ...season,
                      startDate: event.target.value
                    })
                  }
                />
              </label>

              <label>
                End date (inclusive)

                <input
                  type="date"
                  required
                  min={season.startDate}
                  value={season.endDate}
                  onChange={event =>
                    setSeason({
                      ...season,
                      endDate: event.target.value
                    })
                  }
                />
              </label>

              <label>
                Nightly rate (R)

                <input
                  type="number"
                  min="1"
                  max="100000"
                  step="1"
                  required
                  value={season.nightlyRate}
                  onChange={event =>
                    setSeason({
                      ...season,
                      nightlyRate: event.target.value
                    })
                  }
                />
              </label>

              <label>
                Minimum stay (nights)

                <input
                  type="number"
                  min="1"
                  max="30"
                  required
                  value={season.minimumStay}
                  onChange={event =>
                    setSeason({
                      ...season,
                      minimumStay: event.target.value
                    })
                  }
                />
              </label>

            </div>

            <div className="pricing-actions">

              <button
                type="submit"
                className="pricing-button"
                disabled={saving}
              >
                Save Pricing Period
              </button>

              <button
                type="button"
                className="pricing-secondary-button"
                disabled={saving}
                onClick={() => {
                  setShowForm(false)
                  setSeason({ ...EMPTY_SEASON })
                  setError('')
                }}
              >
                &#8592; Back to Pricing
              </button>

            </div>

          </form>

        )}

        {/* EXISTING SEASONS */}

        <div className="pricing-season-list">

          {seasons.length === 0 && (
            <p>No seasonal pricing periods configured.</p>
          )}

          {seasons.map(item => (

            <div
              className="pricing-season-item"
              key={item.id}
            >

              <div>

                <h4>{item.name}</h4>

                <p>
                  {item.startDate} to {item.endDate}
                </p>

                <p>
                  <strong>R{item.nightlyRate}</strong>
                  {' per person, per night'}
                </p>

                <p>
                  Minimum stay: {item.minimumStay}
                  {' night(s)'}
                </p>

              </div>

              <div className="pricing-actions">

                <button
                  type="button"
                  className="pricing-secondary-button"
                  disabled={saving}
                  onClick={() => handleEdit(item)}
                >
                  Edit
                </button>

                <button
                  type="button"
                  className="pricing-delete-button"
                  disabled={saving}
                  onClick={() => handleDelete(item)}
                >
                  Delete
                </button>

              </div>

            </div>

          ))}

        </div>

      </div>

    </section>
  )
}

