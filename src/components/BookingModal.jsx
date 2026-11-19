
import {useEffect, useState} from 'react'
import './BookingModal.css'

const PRICE_PER_PERSON_PER_NIGHT = 400

function formatDate(date) {
  if (!date) return 'Select a date'

  return date.toLocaleDateString('en-ZA', {
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  })
}

function dateKey(date) {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0')
  ].join('-')
}

function BookingModal({isOpen, onClose}) {
  const [month, setMonth] = useState(() => {
    const today = new Date()

    return new Date(
      today.getFullYear(),
      today.getMonth(),
      1
    )
  })

  const [checkIn, setCheckIn] = useState(null)
  const [checkOut, setCheckOut] = useState(null)
  const [guests, setGuests] = useState(2)

  const [guestName, setGuestName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [message, setMessage] = useState('')
  const [preview, setPreview] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!isOpen) return

    const handleEscape = (event) => {
      if (event.key === 'Escape') {
        onClose()
      }
    }

    document.addEventListener('keydown', handleEscape)

    return () => {
      document.removeEventListener('keydown', handleEscape)
    }
  }, [isOpen, onClose])

  if (!isOpen) return null

  const year = month.getFullYear()
  const monthNumber = month.getMonth()

  const firstDay = new Date(year, monthNumber, 1)

  const daysInMonth = new Date(
    year,
    monthNumber + 1,
    0
  ).getDate()

  const startingDay = (firstDay.getDay() + 6) % 7

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const nights = checkIn && checkOut
    ? Math.round(
        (
          Date.UTC(
            checkOut.getFullYear(),
            checkOut.getMonth(),
            checkOut.getDate()
          ) -
          Date.UTC(
            checkIn.getFullYear(),
            checkIn.getMonth(),
            checkIn.getDate()
          )
        ) / 86400000
      )
    : 0

  const total = nights * guests * PRICE_PER_PERSON_PER_NIGHT

  const resetPreview = () => {
    setPreview(false)
    setError('')
  }

  const changeMonth = (amount) => {
    const nextMonth = new Date(
      year,
      monthNumber + amount,
      1
    )

    const earliestMonth = new Date(
      today.getFullYear(),
      today.getMonth(),
      1
    )

    if (nextMonth < earliestMonth) return

    setMonth(nextMonth)
  }

  const selectDate = (day) => {
    const selected = new Date(year, monthNumber, day)

    if (selected < today) return

    resetPreview()

    if (!checkIn || checkOut || selected <= checkIn) {
      setCheckIn(selected)
      setCheckOut(null)
    } else {
      setCheckOut(selected)
    }
  }

  const handlePreview = (event) => {
    event.preventDefault()
    setError('')
    setPreview(false)

    if (!checkIn || !checkOut || nights < 1) {
      setError('Please select your arrival and departure dates.')
      return
    }

    if (checkIn < today) {
      setError('Please select a future arrival date.')
      return
    }

    if (guests < 1 || guests > 5) {
      setError('The Cottage accommodates a maximum of five guests.')
      return
    }

    if (!guestName.trim() || !email.trim() || !phone.trim()) {
      setError('Please complete all required guest details.')
      return
    }

    // TEST MODE ONLY.
    // No Firebase writes, emails or booking submissions.
    setPreview(true)
  }

  const calendarCells = [
    ...Array(startingDay).fill(null),
    ...Array.from(
      {length: daysInMonth},
      (_, index) => index + 1
    )
  ]

  const inputStyle = {
    width: '100%',
    padding: '11px',
    border: '1px solid #b7ddf6',
    borderRadius: '8px',
    boxSizing: 'border-box',
    font: 'inherit',
    marginTop: '5px'
  }

  const fieldStyle = {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
    marginBottom: '14px'
  }

  return (
    <div
      className="booking-overlay"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose()
        }
      }}
    >
      <div
        className="booking-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="booking-title"
      >
        <button
          type="button"
          className="booking-close"
          onClick={onClose}
          aria-label="Close booking calendar"
        >
          ├ù
        </button>

        <h2 id="booking-title">The Cottage</h2>

        <p className="booking-subtitle">
          Select your preferred booking dates
        </p>

        <p className="booking-notice">
          TEST MODE ÔÇö Live availability is not connected.
          No reservations will be submitted or held.
        </p>

        {/* CALENDAR */}

        <div className="booking-calendar">
          <div className="booking-month-header">
            <button
              type="button"
              onClick={() => changeMonth(-1)}
              disabled={
                year === today.getFullYear() &&
                monthNumber === today.getMonth()
              }
              aria-label="Previous month"
            >
              ÔØ«
            </button>

            <strong>
              {month.toLocaleDateString('en-ZA', {
                month: 'long',
                year: 'numeric'
              })}
            </strong>

            <button
              type="button"
              onClick={() => changeMonth(1)}
              aria-label="Next month"
            >
              ÔØ»
            </button>
          </div>

          <div className="booking-calendar-grid">
            {[
              'Mon',
              'Tue',
              'Wed',
              'Thu',
              'Fri',
              'Sat',
              'Sun'
            ].map((day) => (
              <strong key={day}>{day}</strong>
            ))}

            {calendarCells.map((day, index) => {
              if (!day) {
                return <span key={`empty-${index}`} />
              }

              const date = new Date(year, monthNumber, day)
              const key = dateKey(date)
              const isPast = date < today

              const isStart = checkIn &&
                dateKey(checkIn) === key

              const isEnd = checkOut &&
                dateKey(checkOut) === key

              const inRange = checkIn &&
                checkOut &&
                date > checkIn &&
                date < checkOut

              return (
                <button
                  key={key}
                  type="button"
                  disabled={isPast}
                  onClick={() => selectDate(day)}
                  className={[
                    'booking-date',
                    isPast ? 'past' : '',
                    isStart || isEnd ? 'selected' : '',
                    inRange ? 'in-range' : ''
                  ].filter(Boolean).join(' ')}
                  aria-pressed={Boolean(isStart || isEnd)}
                >
                  {day}
                </button>
              )
            })}
          </div>
        </div>

        {/* SELECTED DATES */}

        <div className="booking-selection">
          <div>
            <label>Check-in</label>
            <strong>{formatDate(checkIn)}</strong>
          </div>

          <div>
            <label>Check-out</label>
            <strong>{formatDate(checkOut)}</strong>
          </div>
        </div>

        {/* GUEST COUNT */}

        <div className="booking-guests">
          <label htmlFor="booking-guest-count">
            Number of guests
          </label>

          <select
            id="booking-guest-count"
            value={guests}
            onChange={(event) => {
              setGuests(Number(event.target.value))
              resetPreview()
            }}
          >
            {[1, 2, 3, 4, 5].map((number) => (
              <option key={number} value={number}>
                {number} {number === 1 ? 'guest' : 'guests'}
              </option>
            ))}
          </select>
        </div>

        {/* PRICE SUMMARY */}

        <div className="booking-price">
          <p>
            Price per person per night:
            <strong> R400</strong>
          </p>

          <p>
            Number of guests:
            <strong> {guests}</strong>
          </p>

          <p>
            Number of nights:
            <strong> {nights}</strong>
          </p>

          <div className="booking-total">
            <span>Estimated total</span>
            <strong>R {total.toLocaleString('en-ZA')}</strong>
          </div>
        </div>

        {/* GUEST DETAILS */}

        <form onSubmit={handlePreview}>
          <h3 style={{marginTop: '22px',color: '#082f6d'}}>
            Guest Details
          </h3>

          <div style={fieldStyle}>
            <label htmlFor="booking-name">
              Full name *
            </label>

            <input
              id="booking-name"
              type="text"
              autoComplete="name"
              value={guestName}
              onChange={(event) => {
                setGuestName(event.target.value)
                resetPreview()
              }}
              placeholder="Your full name"
              style={inputStyle}
              required
              maxLength={100}
            />
          </div>

          <div style={fieldStyle}>
            <label htmlFor="booking-email">
              Email address *
            </label>

            <input
              id="booking-email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(event) => {
                setEmail(event.target.value)
                resetPreview()
              }}
              placeholder="you@example.com"
              style={inputStyle}
              required
              maxLength={254}
            />
          </div>

          <div style={fieldStyle}>
            <label htmlFor="booking-phone">
              Telephone number *
            </label>

            <input
              id="booking-phone"
              type="tel"
              autoComplete="tel"
              value={phone}
              onChange={(event) => {
                setPhone(event.target.value)
                resetPreview()
              }}
              placeholder="+27 ..."
              style={inputStyle}
              required
              maxLength={30}
            />
          </div>

          <div style={fieldStyle}>
            <label htmlFor="booking-message">
              Special requests (optional)
            </label>

            <textarea
              id="booking-message"
              value={message}
              onChange={(event) => {
                setMessage(event.target.value)
                resetPreview()
              }}
              placeholder="Anything you would like us to know?"
              rows={3}
              maxLength={1000}
              style={{...inputStyle,resize: 'vertical'}}
            />
          </div>

          {error && (
            <p role="alert" style={{color: '#b00020'}}>
              {error}
            </p>
          )}

          <button
            type="submit"
            className="booking-submit"
          >
            Preview Booking Request
          </button>
        </form>

        {/* TEST BOOKING PREVIEW */}

        {preview && (
          <div
            role="status"
            style={{
              marginTop: '18px',
              padding: '18px',
              background: '#eef8ff',
              border: '1px solid #83bde8',
              borderRadius: '10px',
              color: '#082f6d'
            }}
          >
            <h3 style={{marginTop: 0}}>
              Booking Request Preview
            </h3>

            <p><strong>Name:</strong> {guestName.trim()}</p>
            <p><strong>Email:</strong> {email.trim()}</p>
            <p><strong>Phone:</strong> {phone.trim()}</p>

            <p>
              <strong>Check-in:</strong> {formatDate(checkIn)}
            </p>

            <p>
              <strong>Check-out:</strong> {formatDate(checkOut)}
            </p>

            <p><strong>Guests:</strong> {guests}</p>
            <p><strong>Nights:</strong> {nights}</p>

            {message.trim() && (
              <p>
                <strong>Special requests:</strong> {message.trim()}
              </p>
            )}

            <h3>
              Estimated total: R {total.toLocaleString('en-ZA')}
            </h3>

            <p style={{fontWeight: 'bold'}}>
              TEST ONLY ÔÇö No booking has been submitted.
            </p>
          </div>
        )}

        <p className="booking-disclaimer">
          This is an estimated price based on the standard
          rate of R400 per person per night. Availability
          and final pricing must be confirmed by the owners.
          This test form does not send information to Firebase,
          email or WhatsApp.
        </p>
      </div>
    </div>
  )
}

export default BookingModal
