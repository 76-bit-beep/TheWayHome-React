
import {useState, useEffect} from 'react'
import {createConfirmedReservation} from '../utils/availabilityFirestore'
import {isStayBlocked} from '../utils/bookingAvailability'

import {loadPricing, calculateBookingPrice} from '../utils/pricing.js'

const initialForm = {
  guestName: '',
  email: '',
  phone: '',
  checkIn: '',
  checkOut: '',
  guests: 2,
  notes: ''
}

function ManualReservation({bookings = [], onSaved, onCancel}) {
  const [form, setForm] = useState({...initialForm})
  const [saving, setSaving] = useState(false)
  const [agreedPrice, setAgreedPrice] = useState('')
  const [error, setError] = useState('')

  const updateField = (event) => {
    const {name, value} = event.target

    if (['checkIn', 'checkOut', 'guests'].includes(name)) {
      setAgreedPrice('')
    }

    setForm((current) => ({
      ...current,
      [name]: value
    }))

    setError('')
  }

  const nights = form.checkIn && form.checkOut
    ? Math.max(
        0,
        Math.round(
          (Date.parse(`${form.checkOut}T12:00:00Z`) -
            Date.parse(`${form.checkIn}T12:00:00Z`)) /
            86400000
        )
      )
    : 0

  const [pricing, setPricing] = useState(null)
  const [pricingError, setPricingError] = useState('')

  useEffect(() => {
    let active = true

    loadPricing()
      .then(result => {
        if (active) setPricing(result)
      })
      .catch(() => {
        if (active) setPricingError('Unable to load current pricing.')
      })

    return () => {
      active = false
    }
  }, [])

  let quote = null
  let quoteError = ''

  if (pricing && nights > 0) {
    try {
      quote = calculateBookingPrice(
        form.checkIn,
        form.checkOut,
        Number(form.guests),
        pricing.settings,
        pricing.seasons
      )

    } catch (err) {
      quoteError = err.message
    }
  }

  const total = quote?.total ?? 0

  const finalPrice = agreedPrice.trim() === ''
    ? total
    : Number(agreedPrice)

  const validFinalPrice =
    Number.isInteger(finalPrice) &&
    finalPrice >= 0 &&
    finalPrice <= 15000000

  const handleSubmit = async (event) => {
    event.preventDefault()
    setError('')

    if (!form.guestName.trim()) {
      setError('Please enter a guest name.')
      return
    }

    if (!form.checkIn || !form.checkOut || nights < 1) {
      setError('Please select valid arrival and departure dates.')
      return
    }

    const guests = Number(form.guests)

    if (!Number.isInteger(guests) || guests < 1 || guests > 5) {
      setError('Please select between 1 and 5 guests.')
      return
    }

    
            const conflict = isStayBlocked(
            bookings,
            form.checkIn,
            form.checkOut
            )

            if (conflict) {
            setError(
                'These dates overlap an existing confirmed reservation ' +
                'or an active pending booking.'
            )
            return
            }


    if (!quote || quoteError || pricingError) {
      setError(quoteError || pricingError || 'Pricing is not ready.')
      return
    }

    if (!validFinalPrice) {
      setError('Please enter a valid final reservation price.')
      return
    }

    setSaving(true)

    try {
                const latestPricing = await loadPricing()

      const latestQuote = calculateBookingPrice(
        form.checkIn,
        form.checkOut,
        guests,
        latestPricing.settings,
        latestPricing.seasons
      )

      setPricing(latestPricing)


      if (JSON.stringify(latestQuote) !== JSON.stringify(quote)) {
        setError('Pricing has changed. Review the updated price before saving.')
        return
      }

      if (!window.confirm(
        `Confirm reservation for R ${finalPrice.toLocaleString('en-ZA')} and block the selected dates?`
      )) {
        return
      }

      await createConfirmedReservation({
        originalQuotedTotal: latestQuote.total,
        agreedTotal: finalPrice,
            guestName: form.guestName,
            email: form.email,
            phone: form.phone,
            checkIn: form.checkIn,
            checkOut: form.checkOut,
            guests,
            notes: form.notes
            })

      setForm({...initialForm})
      setAgreedPrice('')
      onSaved?.()
    } catch (err) {
      console.error('Manual reservation failed:', err)
      setError('Could not save the reservation. Check Firebase permissions.')
    } finally {
      setSaving(false)
    }
  }

  const fieldStyle = {
    width: '100%',
    padding: '11px',
    border: '1px solid #b7ddf6',
    borderRadius: '7px',
    boxSizing: 'border-box',
    fontSize: '15px'
  }

  const labelStyle = {
    display: 'block',
    marginBottom: '14px',
    fontWeight: 'bold'
  }

  const buttonStyle = {
    background: '#082f6d',
    color: 'white',
    border: 'none',
    borderRadius: '7px',
    padding: '12px 18px',
    cursor: 'pointer'
  }

  return (
    <section>
      <h2>Add Manual Reservation</h2>

      <p>
        Enter a telephone, WhatsApp or walk-in reservation.
      </p>

      <form onSubmit={handleSubmit}>
        <label style={labelStyle}>
          Guest name *
          <input
            style={fieldStyle}
            name="guestName"
            value={form.guestName}
            onChange={updateField}
            maxLength={120}
            required
          />
        </label>

        <label style={labelStyle}>
          Email address
          <input
            style={fieldStyle}
            type="email"
            name="email"
            value={form.email}
            onChange={updateField}
            maxLength={254}
          />
        </label>

        <label style={labelStyle}>
          Telephone number
          <input
            style={fieldStyle}
            type="tel"
            name="phone"
            value={form.phone}
            onChange={updateField}
            maxLength={40}
          />
        </label>

        <label style={labelStyle}>
          Check-in date *
          <input
            style={fieldStyle}
            type="date"
            name="checkIn"
            value={form.checkIn}
            onChange={updateField}
            required
          />
        </label>

        <label style={labelStyle}>
          Check-out date *
          <input
            style={fieldStyle}
            type="date"
            name="checkOut"
            value={form.checkOut}
            min={form.checkIn || undefined}
            onChange={updateField}
            required
          />
        </label>

        <label style={labelStyle}>
          Number of guests *
          <select
            style={fieldStyle}
            name="guests"
            value={form.guests}
            onChange={updateField}
          >
            {[1, 2, 3, 4, 5].map((number) => (
              <option key={number} value={number}>
                {number}
              </option>
            ))}
          </select>
        </label>

        <label style={labelStyle}>
          Reservation notes
          <textarea
            style={fieldStyle}
            name="notes"
            value={form.notes}
            onChange={updateField}
            maxLength={2000}
            rows={3}
          />
        </label>

        <div style={{
          padding: '16px',
          background: '#eef7fd',
          borderRadius: '8px',
          marginBottom: '18px'
        }}>
          <p>Nights: {nights}</p>
          <p>Guests: {form.guests}</p>

          {!pricing && !pricingError && (
            <p>Loading current pricing...</p>
          )}

          {(pricingError || quoteError) && (
            <p role="alert" style={{color: '#b00020'}}>
              {pricingError || quoteError}
            </p>
          )}

          {quote && (
            <details style={{marginBottom: '12px'}}>
              <summary style={{cursor: 'pointer'}}>
                Nightly price breakdown
              </summary>

              {quote.breakdown.map(night => (
                <p key={night.date}>
                  {night.date}: R {night.nightlyRate.toLocaleString('en-ZA')}
                  {' x '}{night.chargeableGuests ?? night.guests}
                  {' = R '}{night.total.toLocaleString('en-ZA')}
                  {' ('}{night.season}{')'}
                </p>
              ))}
            </details>
          )}
          <strong>
            Estimated total: {quote ? 'R ' + total.toLocaleString('en-ZA') : 'Not yet calculated'}
          </strong>

          {quote && (
            <div style={{marginTop: '16px'}}>
              {Number(form.guests) === 1 && (
                <p>Minimum nightly charge applies for two guests.</p>
              )}

              <label style={labelStyle}>
                Final agreed price (R)
                <input
                  type="number"
                  style={fieldStyle}
                  min={0}
                  max={15000000}
                  step={1}
                  value={agreedPrice}
                  placeholder={String(total)}
                  disabled={saving}
                  onChange={event => {
                    setAgreedPrice(event.target.value)
                    setError('')
                  }}
                />
              </label>

              <p>
                Leave empty to use the calculated price,
                or enter the amount agreed with the guest. Enter R0 for complimentary accommodation.
              </p>

              {validFinalPrice && (
                <>
                  {finalPrice !== total && (
                    <p>
                      {finalPrice < total
                        ? 'Negotiated discount: R '
                        : 'Additional charge: R '}
                      {Math.abs(total - finalPrice).toLocaleString('en-ZA')}
                    </p>
                  )}

                  <h3 style={{color: '#176534'}}>
                    Final price: R {finalPrice.toLocaleString('en-ZA')}
                  </h3>
                </>
              )}
            </div>
          )}
        </div>

        {error && (
          <p role="alert" style={{color: '#b00020'}}>
            {error}
          </p>
        )}

        <div style={{display: 'flex',gap: '12px',flexWrap: 'wrap'}}>
          <button
            type="submit"
            style={buttonStyle}
            disabled={saving || !quote || !validFinalPrice || Boolean(quoteError) || Boolean(pricingError)}
          >
            {saving ? 'Saving...' : 'Save Reservation'}
          </button>

          <button
            type="button"
            onClick={onCancel}
            disabled={saving}
            style={{
              ...buttonStyle,
              background: '#687b8f'
            }}
          >
            &#8592; Back to Dashboard
          </button>
        </div>
      </form>
    </section>
  )
}

export default ManualReservation


