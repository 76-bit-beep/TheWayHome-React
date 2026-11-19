
import {useState} from 'react'
import {createConfirmedReservation} from '../utils/availabilityFirestore'
import {isStayBlocked} from '../utils/bookingAvailability'

const PRICE_PER_PERSON = 400

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
  const [error, setError] = useState('')

  const updateField = (event) => {
    const {name, value} = event.target

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

  const total = nights * Number(form.guests) * PRICE_PER_PERSON

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


    if (!window.confirm(
      'Save this TEST reservation as confirmed in Firebase?'
    )) {
      return
    }

    setSaving(true)

    try {
                await createConfirmedReservation({
            guestName: form.guestName,
            email: form.email,
            phone: form.phone,
            checkIn: form.checkIn,
            checkOut: form.checkOut,
            guests,
            notes: form.notes
            })

      setForm({...initialForm})
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
        TEST MODE — Do not enter real guest information yet.
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
          <strong>
            Estimated total: R {total.toLocaleString('en-ZA')}
          </strong>
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
            disabled={saving}
          >
            {saving ? 'Saving...' : 'Save Test Reservation'}
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
            Cancel
          </button>
        </div>
      </form>
    </section>
  )
}

export default ManualReservation
