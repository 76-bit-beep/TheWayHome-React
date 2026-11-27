
import {useEffect, useState} from 'react'
import {addDoc, collection, getDocsFromServer, onSnapshot, serverTimestamp} from 'firebase/firestore'
import {db} from '../firebase.js'
import {
  DEFAULT_PRICING,
  loadPricing,
  calculateBookingPrice
} from '../utils/pricing.js'
import './BookingModal.css'



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

const getOccupiedNights = (start, end) => {
  const nights = []
  const current = new Date(`${dateKey(start)}T12:00:00Z`)
  const checkout = dateKey(end)

  while (current.toISOString().slice(0, 10) < checkout && nights.length <= 30) {
    nights.push(current.toISOString().slice(0, 10))
    current.setUTCDate(current.getUTCDate() + 1)
  }

  return nights
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

  // Booking submission state
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [blockedNights, setBlockedNights] = useState(new Set())
  const [availabilityLoading, setAvailabilityLoading] = useState(true)
  const [availabilityError, setAvailabilityError] = useState('')
  const [pricingSettings, setPricingSettings] = useState(DEFAULT_PRICING)
  const [seasonalPricing, setSeasonalPricing] = useState([])
  const [pricingLoading, setPricingLoading] = useState(true)
  const [pricingError, setPricingError] = useState('')

  useEffect(() => {
  if (!isOpen) return

  let active = true

  setPricingLoading(true)
  setPricingError('')
  setPreview(false)

  loadPricing()
    .then(({settings, seasons}) => {
      if (!active) return

      setPricingSettings(settings)
      setSeasonalPricing(seasons)
    })
    .catch((err) => {
      if (!active) return

      console.error('Pricing load failed:', err)
      setPricingError(
        'Unable to load current pricing. Please try again.'
      )
    })
    .finally(() => {
      if (active) setPricingLoading(false)
    })

  return () => {
    active = false
  }
}, [isOpen])

  useEffect(() => {
    if (!isOpen) return

    setAvailabilityLoading(true)
    setAvailabilityError('')

    const unsubscribe = onSnapshot(
      collection(db, 'publicAvailability'),
      (snapshot) => {
        setBlockedNights(new Set(snapshot.docs
          .filter((item) => item.data().status === 'confirmed')
          .map((item) => item.id)))
        setAvailabilityLoading(false)
        setAvailabilityError('')
      },
      (err) => {
        console.error('Availability subscription failed:', err)
        setAvailabilityLoading(false)
        setAvailabilityError('Unable to load availability. Please try again later.')
      }
    )

    return () => unsubscribe()
  }, [isOpen])

  useEffect(() => {
    if (!checkIn || !checkOut) return
    if (getOccupiedNights(checkIn, checkOut).some((night) => blockedNights.has(night))) {
      setCheckOut(null)
      setPreview(false)
      setError('Those dates are no longer available. Please choose another stay.')
    }
  }, [blockedNights, checkIn, checkOut])

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

  let bookingPrice = null
let calculationError = ''

if (checkIn && checkOut && !pricingLoading && !pricingError) {
  try {
    bookingPrice = calculateBookingPrice(
      dateKey(checkIn),
      dateKey(checkOut),
      guests,
      pricingSettings,
      seasonalPricing
    )
  } catch (err) {
    calculationError = err.message
  }
}

const total = bookingPrice?.total ?? 0

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

    if (selected < today || availabilityLoading || availabilityError) return

    const selectedKey = dateKey(selected)
    const isBlocked = blockedNights.has(selectedKey)
    const isCheckoutChoice = checkIn && !checkOut && selected > checkIn

    if (isBlocked && !isCheckoutChoice) return

    if (isCheckoutChoice) {
      const occupied = getOccupiedNights(checkIn, selected)
      if (occupied.length > 30 || occupied.some((night) => blockedNights.has(night))) {
        setError('Your selected stay overlaps booked dates. Please choose different dates.')
        return
      }
    }

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
if (pricingLoading || pricingError) {
  setError('Current pricing is unavailable. Please try again shortly.')
  return
}

if (calculationError) {
  setError(calculationError)
  return
}

if (!bookingPrice) {
  setError('Please select valid booking dates.')
  return
}

    if (availabilityLoading || availabilityError) {
      setError('Availability is not ready. Please try again shortly.')
      return
    }

    if (checkIn && checkOut && getOccupiedNights(checkIn, checkOut).some((night) => blockedNights.has(night))) {
      setError('These dates are already booked. Please select another stay.')
      return
    }

    if (!checkIn || !checkOut || nights < 1 || nights > 30) {
      setError('Please select a stay between 1 and 30 nights.')
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

    // Show the booking preview before submission.
    setPreview(true)
  }

  const handleSubmitBooking = async () => {
    if (!preview || submitting || submitted) return
    if (
      pricingLoading ||
      pricingError ||
      calculationError ||
      !bookingPrice
    ) {
      setPreview(false)
      setError('Please review your booking dates and pricing.')
      return
    }
    if (
      !checkIn ||
      !checkOut ||
      checkIn < today ||
      nights < 1 ||
      nights > 30 ||
      availabilityLoading ||
      Boolean(availabilityError) ||
      !guestName.trim() ||
      !email.trim() ||
      !phone.trim()
    ) {
      setError('Please review your booking details.')
      return
    }

    setSubmitting(true)
    setError('')

    try {
      // Read fresh availability from the server before creating a request.
      // The admin's atomic acceptance transaction remains the final safeguard.
      const availability = await getDocsFromServer(collection(db, 'publicAvailability'))
      const latestBlocked = new Set(availability.docs
        .filter((item) => item.data().status === 'confirmed')
        .map((item) => item.id))
      setBlockedNights(latestBlocked)

      if (getOccupiedNights(checkIn, checkOut).some((night) => latestBlocked.has(night))) {
        setPreview(false)
        setError('These dates have just been booked. Please select different dates.')
        return
      }

      // Retrieve the latest pricing before submitting.
const latestPricing = await loadPricing()

const latestBookingPrice = calculateBookingPrice(
  dateKey(checkIn),
  dateKey(checkOut),
  guests,
  latestPricing.settings,
  latestPricing.seasons
)

setPricingSettings(latestPricing.settings)
setSeasonalPricing(latestPricing.seasons)


if (
  latestBookingPrice.total !== bookingPrice.total ||
  JSON.stringify(latestBookingPrice.breakdown) !==
    JSON.stringify(bookingPrice.breakdown)
) {
  setPreview(false)
  setError(
    'Pricing has changed. Please review the updated price before submitting.'
  )
  return
}

await addDoc(collection(db, 'bookingRequests'), {
  guestName:guestName.trim(),
  email:email.trim(),
  phone:phone.trim(),
  guests:Number(guests),
  checkIn:dateKey(checkIn),
  checkOut:dateKey(checkOut),
  notes:message.trim(),

  // Booking price at the time of submission
  quotedTotal:latestBookingPrice.total,
  currency:latestBookingPrice.currency,
  nights:latestBookingPrice.nights,
  minimumStay:1,
  priceBreakdown:latestBookingPrice.breakdown,

  status:'pending',
  createdAt:serverTimestamp()
})

      setSubmitted(true)
      setPreview(false)
    } catch (err) {
      console.error('Booking request failed:', err)
      setError('Unable to verify availability or submit your request. Please try again.')
    } finally {
      setSubmitting(false)
    }
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
          &#215;
        </button>

        <h2 id="booking-title">The Cottage</h2>

        <p className="booking-subtitle">
          Select your preferred booking dates
        </p>

        {availabilityLoading && <p role="status">Checking live availability...</p>}
        {availabilityError && <p role="alert" style={{color:'#b00020'}}>{availabilityError}</p>}
        <p style={{fontSize:'13px',color:'#435b72'}}>
          Unavailable nights are marked as booked. A booked date may still be selected as checkout.
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
              &#10094;
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
              &#10095;
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
              const isBlocked = blockedNights.has(key)
              const canCheckout = Boolean(checkIn && !checkOut && date > checkIn &&
                !getOccupiedNights(checkIn, date).some((night) => blockedNights.has(night)))
              const unavailable = isBlocked && !canCheckout

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
                  disabled={isPast || unavailable || availabilityLoading || Boolean(availabilityError) || submitted}
                  onClick={() => selectDate(day)}
                  title={unavailable ? 'Booked — unavailable for check-in or overnight stay' : undefined}
                  aria-label={`${formatDate(date)}${unavailable ? ', booked' : ''}`}
                  className={[
                    'booking-date',
                    isPast ? 'past' : '',
                    unavailable ? 'booked' : '',
                    isStart || isEnd ? 'selected' : '',
                    inRange ? 'in-range' : ''
                  ].filter(Boolean).join(' ')}
                  style={unavailable ? {
                    background:'#f5d9dc',
                    color:'#8b1d2c',
                    textDecoration:'line-through',
                    cursor:'not-allowed',
                    opacity:0.85
                  } : undefined}
                  aria-pressed={Boolean(isStart || isEnd)}
                >
                  {day}
                </button>
              )
            })}
          </div>
          <p style={{fontSize:'12px',margin:'10px 0 0',color:'#8b1d2c'}}>
            Red crossed-out dates are booked.
          </p>
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

  {pricingLoading && (
    <p role="status">Loading current pricing...</p>
  )}

  {pricingError && (
    <p role="alert" style={{color: '#b00020'}}>
      {pricingError}
    </p>
  )}

  {calculationError && (
    <p role="alert" style={{color: '#b00020'}}>
      {calculationError}
    </p>
  )}

  {!pricingLoading && !pricingError && (
    <div style={{
      paddingBottom: '12px',
      marginBottom: '10px',
      borderBottom: '1px solid #cce3f5'
    }}>
      <h4 style={{margin: '0 0 10px'}}>
        Accommodation rates
      </h4>

      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        gap: '12px',
        marginBottom: '8px'
      }}>
        <span>1-2 guests</span>
        <strong>
          R{(pricingSettings.nightlyRate * 2).toLocaleString('en-ZA')} / night
        </strong>
      </div>

      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        gap: '12px'
      }}>
        <span>Each additional guest</span>
        <strong>
          + R{pricingSettings.nightlyRate.toLocaleString('en-ZA')} / night
        </strong>
      </div>

      <small style={{display: 'block', marginTop: '8px'}}>
        Seasonal rates may apply.
      </small>
    </div>
  )}

  <p>
    Number of guests:
    <strong> {guests}</strong>
  </p>

  <p>
    Number of nights:
    <strong> {nights}</strong>
  </p>

  {bookingPrice && (
    <>
      <h4>Nightly Price Breakdown</h4>

      {bookingPrice.breakdown.map((night) => (
        <div
          key={night.date}
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            gap: '10px',
            padding: '8px 0',
            borderBottom: '1px solid #ddd',
            fontSize: '13px'
          }}
        >
          <span>
            {night.date} — {night.season}
            <small style={{display: 'block', marginTop: '4px'}}>
              R{night.nightlyRate.toLocaleString('en-ZA')}
              {' × '}
              {night.chargeableGuests ?? night.guests}
              {' chargeable guests'}
            </small>
          </span>

          <strong>
            R{night.total.toLocaleString('en-ZA')}
          </strong>
        </div>
      ))}

      

      
    </>
  )}

  <div className="booking-total">
    <span>Estimated total</span>
    <strong>
      {bookingPrice
        ? `R ${total.toLocaleString('en-ZA')}`
        : '—'}
    </strong>
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


        {/* BOOKING REQUEST PREVIEW */}

        {preview && (
          <div
            role="status"
            style={{
              marginTop:'18px',
              padding:'18px',
              background:'#eef8ff',
              border:'1px solid #83bde8',
              borderRadius:'10px',
              color:'#082f6d'
            }}
          >
            <h3 style={{marginTop:0}}>
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

            <p style={{fontWeight:'bold'}}>
              Please review your booking details before submitting.
              Your reservation is not confirmed until the owners approve it.
            </p>

            <button
              type="button"
              className="booking-back"
              onClick={() => {
                resetPreview()
                document.getElementById('booking-name')?.focus()
              }}
              disabled={submitting}
            >
              Back to Booking Details
            </button>

            <button
              type="button"
              className="booking-submit"
              onClick={handleSubmitBooking}
              disabled={submitting || submitted || availabilityLoading || Boolean(availabilityError)}
            >
              {submitting ? 'Submitting...' : 'Submit Booking Request'}
            </button>
          </div>
        )}

        {/* SUBMISSION ERROR */}

        {error && preview && (
          <p role="alert" style={{color:'#b00020'}}>
            {error}
          </p>
        )}

        {/* SUCCESS MESSAGE */}

        {submitted && (
          <div
            role="status"
            style={{
              marginTop:'18px',
              padding:'18px',
              background:'#e8f6ee',
              border:'1px solid #85c9a0',
              borderRadius:'10px',
              color:'#175b35'
            }}
          >
            <h3>Booking Request Submitted!</h3>

            <p>
              Thank you! Your booking request has been received.
            </p>

            <p>
              Your request is pending approval from The Way Home.
              We will contact you to confirm availability.
            </p>

            <p>
              No booking has been confirmed yet.
            </p>
          </div>
        )}

{/* GO BACK BUTTON */}

<button
  type="button"
  className="booking-back"
  onClick={onClose}
  disabled={submitting}
>
  ← Go Back to Homepage
</button>

        {/* BOOKING DISCLAIMER */}

              <p className="booking-disclaimer">
        Prices are calculated using the current standard
        and seasonal rates. Availability and final pricing
        must be confirmed by the owners. Submitting a
        booking request does not guarantee a reservation.
        No automatic email or WhatsApp confirmation is sent.
      </p>
      </div>
    </div>
  )
}

export default BookingModal

