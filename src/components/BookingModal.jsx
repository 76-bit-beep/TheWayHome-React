
import { useEffect, useState } from 'react'
import './BookingModal.css'

// Starting price: R400 per person per night.
// Future admin settings will control seasonal and date-specific prices.
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

function BookingModal({ isOpen, onClose }) {
  const [month, setMonth] = useState(
    () => new Date(
      new Date().getFullYear(),
      new Date().getMonth(),
      1
    )
  )

  const [checkIn, setCheckIn] = useState(null)
  const [checkOut, setCheckOut] = useState(null)
  const [guests, setGuests] = useState(2)

  useEffect(() => {
    if (!isOpen) return

    function handleEscape(event) {
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

  // Calculate number of nights
  const nights =
    checkIn && checkOut
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

  // Calculate total based on guests and nights
  const total =
    nights * guests * PRICE_PER_PERSON_PER_NIGHT

  function changeMonth(amount) {
    setMonth(
      new Date(year, monthNumber + amount, 1)
    )
  }

  function selectDate(day) {
    const selected = new Date(
      year,
      monthNumber,
      day
    )

    if (selected < today) return

    if (
      !checkIn ||
      checkOut ||
      selected <= checkIn
    ) {
      setCheckIn(selected)
      setCheckOut(null)
    } else {
      setCheckOut(selected)
    }
  }

  const calendarCells = [
    ...Array(startingDay).fill(null),
    ...Array.from(
      { length: daysInMonth },
      (_, index) => index + 1
    )
  ]

  return (
    <div
      className="booking-overlay"
      onMouseDown={event => {
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
          ×
        </button>

        <h2 id="booking-title">
          The Cottage
        </h2>

        <p className="booking-subtitle">
          Select your preferred booking dates
        </p>

        <p className="booking-notice">
          Booking preview — live availability is not
          connected yet. Dates shown are not confirmed
          available.
        </p>

        {/* Calendar */}

        <div className="booking-calendar">
          <div className="booking-month-header">
            <button
              type="button"
              onClick={() => changeMonth(-1)}
              aria-label="Previous month"
            >
              ❮
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
              ❯
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
            ].map(day => (
              <strong key={day}>
                {day}
              </strong>
            ))}

            {calendarCells.map((day, index) => {
              if (!day) {
                return (
                  <span key={`empty-${index}`} />
                )
              }

              const date = new Date(
                year,
                monthNumber,
                day
              )

              const key = dateKey(date)

              const isPast = date < today

              const isStart =
                checkIn &&
                dateKey(checkIn) === key

              const isEnd =
                checkOut &&
                dateKey(checkOut) === key

              const inRange =
                checkIn &&
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
                  aria-pressed={Boolean(
                    isStart || isEnd
                  )}
                >
                  {day}
                </button>
              )
            })}
          </div>
        </div>

        {/* Selected dates */}

        <div className="booking-selection">
          <div>
            <label>Check-in</label>
            <strong>
              {formatDate(checkIn)}
            </strong>
          </div>

          <div>
            <label>Check-out</label>
            <strong>
              {formatDate(checkOut)}
            </strong>
          </div>
        </div>

        {/* Number of guests */}

        <div className="booking-guests">
          <label htmlFor="booking-guest-count">
            Number of guests
          </label>

          <select
            id="booking-guest-count"
            value={guests}
            onChange={event =>
              setGuests(
                Number(event.target.value)
              )
            }
          >
            {[1, 2, 3, 4, 5].map(number => (
              <option
                key={number}
                value={number}
              >
                {number}
                {number === 1
                  ? ' guest'
                  : ' guests'}
              </option>
            ))}
          </select>
        </div>

        {/* Price calculation */}

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

            <strong>
              R {total.toLocaleString('en-ZA')}
            </strong>
          </div>
        </div>

        {/* Booking submission */}

        <button
          type="button"
          className="booking-submit"
          disabled
          title="Booking requests will be enabled after the secure booking system is connected"
        >
          Request Booking — Coming Soon
        </button>

        <p className="booking-disclaimer">
          This is an estimated price based on the
          standard rate of R400 per person per night.
          Final availability and pricing must be
          confirmed by the owners. No booking request
          will be sent yet.
        </p>
      </div>
    </div>
  )
}

export default BookingModal
