import './AdminDashboard.css'
import {useEffect, useMemo, useState} from 'react'
import {collection, doc, onSnapshot, updateDoc} from 'firebase/firestore'
import {
  acceptBookingRequest,
  deleteConfirmedReservation
} from '../utils/availabilityFirestore'
import {signOut} from 'firebase/auth'
import {auth, db} from '../firebase'
import ManualReservation from './ManualReservation.jsx'
import PricingManagement from './PricingManagement.jsx'
import {DEFAULT_PRICING, calculateBookingPrice} from '../utils/pricing.js'

const styles = {
  page: {
    maxWidth: '1100px',
    margin: '35px auto',
    padding: '20px',
    fontFamily: 'Arial, sans-serif',
    color: '#082f6d'
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: '20px',
    flexWrap: 'wrap',
    marginBottom: '25px'
  },
  card: {
    background: '#fff',
    border: '1px solid #b7ddf6',
    borderRadius: '14px',
    padding: '20px',
    marginBottom: '22px',
    boxShadow: '0 3px 10px #00589b12'
  },
  button: {
    background: '#082f6d',
    color: '#fff',
    border: 'none',
    borderRadius: '7px',
    padding: '10px 16px',
    cursor: 'pointer'
  },
  calendar: {
    display: 'grid',
    gridTemplateColumns: 'repeat(7,minmax(0,1fr))',
    gap: '5px'
  },
  day: {
    minHeight: '65px',
    padding: '8px 4px',
    borderRadius: '7px',
    border: '1px solid #d5e5ef',
    background: '#f2f8fc',
    color: '#082f6d',
    cursor: 'pointer'
  },
  notification: {
    padding: '16px',
    border: '1px solid #f1d18a',
    background: '#fffaf0',
    borderRadius: '10px',
    marginBottom: '12px'
  }
}

const parseDate = (value) => {
  if (typeof value !== 'string') return null

  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return null
  }

  const date = new Date(`${value}T12:00:00Z`)

  if (Number.isNaN(date.getTime())) return null

  return date.toISOString().slice(0, 10) === value
    ? date
    : null
}

const dateKey = (year, month, day) => {
  return [
    year,
    String(month + 1).padStart(2, '0'),
    String(day).padStart(2, '0')
  ].join('-')
}

const formatDate = (value) => {
  const date = parseDate(value)

  if (!date) return 'Not specified'

  return date.toLocaleDateString('en-ZA', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC'
  })
}

const overlapsDate = (booking, date) => {
  if (!parseDate(booking.checkIn) || !parseDate(booking.checkOut)) {
    return false
  }

  // Checkout day is not occupied.
  return booking.checkIn <= date && date < booking.checkOut
}

function BookingRow({booking, expanded, onToggle, children}) {
  const price = booking.agreedTotal ?? booking.quotedTotal
  const status = booking.status

  return (
    <article className="booking-item">
      <button
        type="button"
        className="booking-summary"
        onClick={onToggle}
        aria-expanded={expanded}
      >
        <span className="booking-name">
          {booking.guestName || 'Guest'}
        </span>

        <span>
          {formatDate(booking.checkIn)} - {formatDate(booking.checkOut)}
        </span>

        <span>
          {booking.guests ?? '-'} guests
        </span>

        <span className="booking-price">
          {Number.isInteger(price)
            ? `R ${price.toLocaleString('en-ZA')}`
            : 'No price'}
        </span>

        <span className={`booking-status ${status}`}>
          {status.charAt(0).toUpperCase() + status.slice(1)}
        </span>

        <span
          aria-hidden="true"
          className={`booking-chevron ${expanded ? 'expanded' : ''}`}
        >
          &#9662;
        </span>
      </button>

      {expanded && (
        <div className="booking-details">
          {children}
        </div>
      )}
    </article>
  )
}

function PriceAdjustment({original, agreed, basis}) {
  if (
    !Number.isInteger(original) ||
    original <= 0 ||
    agreed === null ||
    agreed === undefined ||
    String(agreed).trim() === ''
  ) return null

  const finalPrice = Number(agreed)

  if (
    !Number.isInteger(finalPrice) ||
    finalPrice < 0 ||
    finalPrice > 15000000
  ) return null

  const difference = original - finalPrice
  const percentage = Math.abs(difference / original * 100)

  if (difference === 0) return null

  return (
    <div style={{
      background: difference > 0 ? '#edf8ef' : '#fff4e5',
      borderRadius: '8px',
      padding: '12px',
      marginTop: '12px',
      marginBottom: '12px',
      color: difference > 0 ? '#176534' : '#925400'
    }}>
      <strong>
        {difference > 0
          ? 'Negotiated discount: R '
          : 'Additional charge: R '}
        {Math.abs(difference).toLocaleString('en-ZA')}
        {' ('}
        {percentage.toLocaleString('en-ZA', {
          maximumFractionDigits: 2
        })}
        {'%)'}
      </strong>

      {basis && (
        <p style={{fontSize: '12px', marginBottom: 0}}>
          Compared with {basis}: R {original.toLocaleString('en-ZA')}
        </p>
      )}
    </div>
  )
}

function AdminDashboard() {
  const [expandedBooking, setExpandedBooking] = useState(null)
  const [bookingFilter, setBookingFilter] = useState('all')

  const toggleBooking = (id) => {
    setExpandedBooking(current => current === id ? null : id)
  }

  const [bookings, setBookings] = useState([])
  const [bookingRequests, setBookingRequests] = useState([])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [requestsLoading, setRequestsLoading] = useState(true)
  const [requestsError, setRequestsError] = useState('')
  const [monthOffset, setMonthOffset] = useState(0)
  const [showCalendar, setShowCalendar] = useState(false)
  const [showPricing, setShowPricing] = useState(false)
  const [selectedDate, setSelectedDate] = useState(null)
  const [deletingId, setDeletingId] = useState(null)
  const [processingRequestId, setProcessingRequestId] = useState(null)
  const [requestActionError, setRequestActionError] = useState('')
  const [currentSettings, setCurrentSettings] = useState(null)
  const [currentSeasons, setCurrentSeasons] = useState(null)
  const [pricingErrors, setPricingErrors] = useState({})
  const [agreedPrices, setAgreedPrices] = useState({})
  const [showManualReservation, setShowManualReservation] = useState(false)

  useEffect(() => {
    const unsubscribe = onSnapshot(
      collection(db, 'bookings'),
      (snapshot) => {
        const records = snapshot.docs.map((document) => ({
          ...document.data(),
          id: document.id
        }))

        setBookings(records)
        setLoading(false)
        setError('')
      },
      () => {
        setError('Unable to load reservations from Firebase.')
        setLoading(false)
      }
    )

    return () => unsubscribe()
  }, [])

  // Customer requests are private and readable only by the administrator.
  useEffect(() => {
    const unsubscribe = onSnapshot(
      collection(db, 'bookingRequests'),
      (snapshot) => {
        const records = snapshot.docs.map((document) => ({
          ...document.data(),
          id:document.id
        }))

        setBookingRequests(records)
        setRequestsLoading(false)
        setRequestsError('')
      },
      (err) => {
        console.error('Unable to load booking requests:', err)
        setRequestsError('Unable to load booking requests from Firebase.')
        setRequestsLoading(false)
      }
    )

    return () => unsubscribe()
  }, [])

  const currentMonth = useMemo(() => {
    const today = new Date()

    return new Date(
      today.getFullYear(),
      today.getMonth() + monthOffset,
      1
    )
  }, [monthOffset])

  const year = currentMonth.getFullYear()
  const month = currentMonth.getMonth()

  const monthLabel = currentMonth.toLocaleDateString('en-ZA', {
    month: 'long',
    year: 'numeric'
  })

  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const blankDays = (currentMonth.getDay() + 6) % 7

  const activeBookings = useMemo(() => {
    return bookings.filter((booking) => booking.status === 'confirmed')
  }, [bookings])

  const pendingBookings = useMemo(() => {
    return bookingRequests
      .filter((booking) => booking.status === 'pending')
      .sort((a, b) => {
        const first = a.createdAt?.toMillis?.() || 0
        const second = b.createdAt?.toMillis?.() || 0

        return second - first
      })
  }, [bookingRequests])

  // Subscribe once to pricing, not once per booking.
  useEffect(() => {
    const setPricingError = (key, message) => {
      setPricingErrors(current => ({...current, [key]: message}))
    }
    const stopSettings = onSnapshot(
      doc(db, 'pricingSettings', 'default'),
      {includeMetadataChanges: true},
      snapshot => {
        setCurrentSettings(snapshot.metadata.fromCache ? null :
          snapshot.exists() ? snapshot.data() : DEFAULT_PRICING)
        setPricingError('settings', '')
      },
      () => {
        setCurrentSettings(null)
        setPricingError('settings', 'Current standard pricing unavailable.')
      }
    )
    const stopSeasons = onSnapshot(
      collection(db, 'seasonalPricing'),
      {includeMetadataChanges: true},
      snapshot => {
        setCurrentSeasons(snapshot.metadata.fromCache ? null :
          snapshot.docs.map(item => ({...item.data(), id: item.id})))
        setPricingError('seasons', '')
      },
      () => {
        setCurrentSeasons(null)
        setPricingError('seasons', 'Current seasonal pricing unavailable.')
      }
    )
    return () => { stopSettings(); stopSeasons() }
  }, [])

  const verifiedPrices = useMemo(() => {
    if (!currentSettings || !currentSeasons) return {}
    return Object.fromEntries(pendingBookings.map(booking => {
      try {
        const price = calculateBookingPrice(booking.checkIn, booking.checkOut,
          booking.guests, currentSettings, currentSeasons)
        const originalQuote = Number.isInteger(booking.quotedTotal) &&
          booking.quotedTotal > 0 && booking.currency === 'ZAR'
          ? booking.quotedTotal : null
        return [booking.id, {...price, currentTotal: price.total, originalQuote,
          priceChanged: originalQuote !== price.total,
          difference: originalQuote === null ? null : price.total - originalQuote}]
      } catch (err) {
        return [booking.id, {error: err.message}]
      }
    }))
  }, [pendingBookings, currentSettings, currentSeasons])

  const getBookingsForDate = (date) => {
    return [...activeBookings, ...pendingBookings].filter((booking) => {
      return overlapsDate(booking, date)
    })
  }

  const selectedBookings = selectedDate
    ? getBookingsForDate(selectedDate)
    : []

const handleDeleteReservation = async (booking) => {
  const confirmed = window.confirm(
    `Cancel the reservation for ${booking.guestName || 'Guest'}?\n\n` +
    `Arrival: ${formatDate(booking.checkIn)}\n` +
    `Departure: ${formatDate(booking.checkOut)}\n\n` +
    'This will permanently remove the reservation and release its reserved dates. This action cannot be undone.'
  )

  if (!confirmed) return

  setDeletingId(booking.id)
  setError('')

  try {
    await deleteConfirmedReservation(booking.id)
  } catch (err) {
    console.error('Failed to delete reservation:', err)
    setError('Unable to cancel reservation. Check Firebase permissions.')
  } finally {
    setDeletingId(null)
  }
}

  const handleRequestAction = async (booking, action) => {
    if (processingRequestId || booking.status !== 'pending') return

    const isAccept = action === 'accept'
    const prompt = isAccept
      ? `Accept the booking request for ${booking.guestName || 'Guest'}?\n\n` +
        `Arrival: ${formatDate(booking.checkIn)}\n` +
        `Departure: ${formatDate(booking.checkOut)}\n\n` +
        'This will confirm the reservation and block its dates.'
      : `Decline the booking request for ${booking.guestName || 'Guest'}?\n\n` +
        'The requested dates will remain available.'

    if (!window.confirm(prompt)) return

    setProcessingRequestId(booking.id)
    setRequestActionError('')

    try {
      if (isAccept) {
  const rawPrice =
    agreedPrices[booking.id] ??
    booking.quotedTotal ??
    ''

  const agreedTotal =
    String(rawPrice).trim() === ''
      ? null
      : Number(rawPrice)

  if (
    agreedTotal !== null &&
    (
      !Number.isInteger(agreedTotal) ||
      agreedTotal < 0 ||
      agreedTotal > 15000000
    )
  ) {
    setRequestActionError(
      'Please enter a valid agreed booking price.'
    )
    return
  }

  await acceptBookingRequest(
    booking.id,
    db,
    agreedTotal
  )
} else {
        await updateDoc(doc(db, 'bookingRequests', booking.id), {
          status:'declined'
        })
      }
    } catch (err) {
      console.error(`Unable to ${action} booking request:`, err)
      setRequestActionError(
        isAccept
          ? 'Unable to confirm approval. The dates may already be booked or Firebase may have rejected the operation. Refresh and check the request status before trying again.'
          : 'Unable to decline this request. Please check Firebase permissions and try again.'
      )
    } finally {
      setProcessingRequestId(null)
    }
  }

  const handleSignOut = async () => {
    try {
      await signOut(auth)
    } catch {
      setError('Unable to sign out. Please try again.')
    }
  }

  return (
    <main style={styles.page}>
      <header style={styles.header}>
        <section style={styles.card}>
  <button
    type="button"
    style={styles.button}
    onClick={() => setShowManualReservation((current) => !current)}
  >
    {showManualReservation
      ? 'Close Manual Reservation'
      : '+ Add Manual Reservation'}
  </button>

  
</section>
        <div>
          <h1 style={{marginBottom: '5px'}}>
            The Way Home
          </h1>

          <h2 style={{marginTop: 0}}>
            Booking Administration
          </h2>
        </div>

        <button
          type="button"
          onClick={handleSignOut}
          style={styles.button}
        >
          Sign Out
        </button>
      </header>

      {showManualReservation && (
    <div style={{marginTop: '20px'}}>
      <ManualReservation
        bookings={bookings}
        onSaved={() => setShowManualReservation(false)}
        onCancel={() => setShowManualReservation(false)}
      />
    </div>
  )}

      {error && (
        <p role="alert" style={{color: '#b00020'}}>
          {error}
        </p>
      )}

      <section style={styles.card}>
        <button
          type="button"
          aria-expanded={showCalendar}
          aria-controls="admin-availability-calendar"
          onClick={() => setShowCalendar(current => !current)}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            width: '100%',
            padding: '12px 4px',
            border: 'none',
            background: 'transparent',
            color: '#082f6d',
            fontSize: '18px',
            fontWeight: 'bold',
            cursor: 'pointer',
            textAlign: 'left'
          }}
        >
          <span>Availability Calendar</span>
          <span aria-hidden="true">
            {showCalendar ? '\u25B2' : '\u25BC'}
          </span>
        </button>

        <div
          id="admin-availability-calendar"
          hidden={!showCalendar}
          style={{paddingTop: '12px'}}
        >
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: '10px'
        }}>
          <button
            type="button"
            aria-label="Previous month"
            onClick={() => {
              setMonthOffset((current) => current - 1)
              setSelectedDate(null)
            }}
            style={styles.button}
          >
            &#8249;
          </button>

          <h3>{monthLabel}</h3>

          <button
            type="button"
            aria-label="Next month"
            onClick={() => {
              setMonthOffset((current) => current + 1)
              setSelectedDate(null)
            }}
            style={styles.button}
          >
            &#8250;
          </button>
        </div>

        <div style={styles.calendar}>
          {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day) => (
            <div
              key={day}
              style={{
                textAlign: 'center',
                padding: '12px 0',
                fontWeight: 'bold'
              }}
            >
              {day}
            </div>
          ))}

          {Array.from({length: blankDays}, (_, index) => (
            <div key={`blank-${index}`} />
          ))}

          {Array.from({length: daysInMonth}, (_, index) => {
            const day = index + 1
            const date = dateKey(year, month, day)
            const reservations = getBookingsForDate(date)

            const confirmed = reservations.some((booking) => {
              return booking.status === 'confirmed'
            })

            const pending = reservations.some(booking => booking.status === 'pending')
            const unknown = loading || requestsLoading || Boolean(error || requestsError)
            const background = confirmed ? '#fecaca' : pending ? '#fde68a' : unknown ? '#e5e7eb' : '#f2f8fc'
            const dayStatus = confirmed && pending ? 'confirmed reservation and pending request' : confirmed ? 'confirmed reservation' : pending ? 'pending request' : unknown ? 'availability unknown' : 'no reservation'

            return (
              <button
                key={date}
                type="button"
                onClick={() => setSelectedDate(date)}
                aria-pressed={selectedDate === date}
                aria-label={`${formatDate(date)}, ${
                  dayStatus
                }`}
                style={{
                  ...styles.day,
                  background,
                  border: selectedDate === date
                    ? '2px solid #082f6d'
                    : styles.day.border,
                  fontWeight: confirmed || pending
                    ? 'bold'
                    : 'normal'
                }}
              >
                {day}
                {confirmed && pending && <span style={{display:'block', fontSize:'11px'}}>+ Pending</span>}
              </button>
            )
          })}
        </div>

        <div style={{
          display: 'flex',
          gap: '20px',
          flexWrap: 'wrap',
          marginTop: '20px',
          fontSize: '14px'
        }}>
          {[
            ['#fecaca', 'Confirmed'],
            ['#fde68a', 'Pending'],
            ['#f2f8fc', 'No reservation'],
            ['#e5e7eb', 'Unknown']
          ].map(([color, label]) => (
            <span key={label} style={{display:'inline-flex', alignItems:'center', gap:'6px'}}>
              <span aria-hidden="true" style={{width:'14px', height:'14px', background:color, border:'1px solid #b7c8d5', borderRadius:'3px'}} />
              {label}
            </span>
          ))}
        </div>

        {selectedDate && (
          <div style={{
            marginTop: '20px',
            padding: '15px',
            background: '#eef7fd',
            borderRadius: '8px'
          }}>
            <h3>{formatDate(selectedDate)}</h3>

            {selectedBookings.length === 0 ? (
              <p>{loading || requestsLoading || error || requestsError ? 'Calendar data is not fully available.' : 'No reservations or pending requests for this date.'}</p>
            ) : (
              selectedBookings.map((booking) => (
                <div key={`${booking.status}-${booking.id}`}>
                  <strong>
                    {booking.guestName || 'Guest'}
                  </strong>

                  <p>
                    {formatDate(booking.checkIn)}
                    {' – '}
                    {formatDate(booking.checkOut)}
                  </p>

                  <p>
                    Status: {booking.status === 'confirmed' ? 'Confirmed' : 'Pending approval'}
                  </p>
                </div>
              ))
            )}
          </div>
        )}
      </div>
      </section>

      <section style={styles.card}>
  <h2>Booking Management</h2>

  <div className="booking-toolbar">
    {[
      ['all', 'All', pendingBookings.length + activeBookings.length],
      ['pending', 'Pending', pendingBookings.length],
      ['confirmed', 'Confirmed', activeBookings.length]
    ].map(([value, label, count]) => (
      <button
        key={value}
        type="button"
        className={`booking-filter ${bookingFilter === value ? 'active' : ''}`}
        aria-pressed={bookingFilter === value}
        onClick={() => {
          setBookingFilter(value)
          setExpandedBooking(null)
        }}
      >
        {label} ({count})
      </button>
    ))}
  </div>
</section>

<section style={{
  ...styles.card,
  display: bookingFilter === 'confirmed' ? 'none' : undefined
}}>
  <h2>New Booking Requests
          {' '}
          ({pendingBookings.length})
        </h2>

        {requestActionError && (
          <p role="alert" style={{color:'#b00020'}}>
            {requestActionError}
          </p>
        )}

        {requestsLoading && <p>Loading booking requests...</p>}

        {requestsError && (
          <p role="alert" style={{color:'#b00020'}}>{requestsError}</p>
        )}

        {!requestsLoading && !requestsError && pendingBookings.length === 0 && (
          <p>No new booking requests at the moment.</p>
        )}

        {pendingBookings.map((booking) => {
          return (
            <BookingRow
  key={`pending-${booking.id}`}
  booking={booking}
  expanded={expandedBooking === `pending-${booking.id}`}
  onToggle={() => toggleBooking(`pending-${booking.id}`)}
>
              <h3 style={{marginTop: 0}}>
                {booking.guestName || 'Guest'}
              </h3>

              <p>
                <strong>Arrival:</strong>{' '}
                {formatDate(booking.checkIn)}
              </p>

              <p>
                <strong>Departure:</strong>{' '}
                {formatDate(booking.checkOut)}
              </p>

              <p>
                <strong>Guests:</strong>{' '}
                {booking.guests ?? 'Not specified'}
              </p>

              <p>
                <strong>Email:</strong>{' '}
                {booking.email || 'Not provided'}
              </p>

              <p>
                <strong>Telephone:</strong>{' '}
                {booking.phone || 'Not provided'}
              </p>

              <p>
                <strong>Status:</strong> Pending approval
              </p>

              {booking.notes && (
                <p>
                  <strong>Special requests:</strong>{' '}
                  {booking.notes}
                </p>
              )}

{/* BOOKING PRICE DETAILS */}

<div style={{
  background: '#eef7fd',
  border: '1px solid #b7ddf6',
  borderRadius: '8px',
  padding: '15px',
  marginTop: '15px'
}}>
  <h4 style={{marginTop: 0}}>
    Booking Price Details
  </h4>

  {Number.isInteger(booking.quotedTotal) &&
   booking.quotedTotal > 0 ? (
    <>
      <p>
        <strong>Number of nights:</strong>{' '}
        {booking.nights}
      </p>

      <p>
        <strong>Minimum stay:</strong>{' '}
        {booking.minimumStay} night(s)
      </p>

      {Array.isArray(booking.priceBreakdown) && (
        <div>
          {booking.priceBreakdown.map((night, index) => (
            <div
              key={index}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                gap: '10px',
                padding: '8px 0',
                borderBottom: '1px solid #d5e5ef',
                fontSize: '13px'
              }}
            >
              <span>
                {formatDate(night?.date)} —{' '}
                {typeof night?.season === 'string'
                  ? night.season
                  : 'Unknown rate'}
              </span>

              <strong>
                {Number.isFinite(night?.total)
                  ? `R ${night.total.toLocaleString('en-ZA')}`
                  : 'Invalid amount'}
              </strong>
            </div>
          ))}
        </div>
      )}

      <h3 style={{color: '#176534'}}>
        Quoted total: R{' '}
        {booking.quotedTotal.toLocaleString('en-ZA')}
      </h3>

      <p style={{fontSize: '12px', color: '#785400'}}>
        Original customer quote at the time of submission.
      </p>
    </>
  ) : (
    <p style={{color: '#785400'}}>
      No valid quoted price is stored for this request.
      The owner may enter an agreed price.
    </p>
  )}
</div>

{/* INDEPENDENT PRICE VERIFICATION */}

{verifiedPrices[booking.id] && !verifiedPrices[booking.id].error ? (
  <div style={{
    background: '#f4f8f5',
    border: '1px solid #b7d8c0',
    borderRadius: '8px',
    padding: '15px',
    marginTop: '15px'
  }}>
    <h4 style={{marginTop: 0}}>
      Current Pricing
    </h4>

    <p>
      <strong>Current total:</strong>{' '}
      R {verifiedPrices[booking.id].currentTotal.toLocaleString('en-ZA')}
    </p>

    <p>
      <strong>Current minimum stay:</strong>{' '}
      {verifiedPrices[booking.id].minimumStay} night(s)
    </p>

    {verifiedPrices[booking.id].originalQuote === null ? (
      <p style={{color: '#785400'}}>
        No original quote is available.
        Review the calculated price before approval.
      </p>
    ) : verifiedPrices[booking.id].priceChanged ? (
      <div style={{color: '#b00020'}}>
        <strong>Warning: Pricing has changed.</strong>

        <p>
          Price difference: R{' '}
          {verifiedPrices[booking.id].difference.toLocaleString('en-ZA')}
        </p>

        <p>
          Review the new price with the customer
          before accepting this reservation.
        </p>
      </div>
    ) : (
      <p style={{color: '#176534'}}>
        Current total matches the customer quote.
      </p>
    )}

    {verifiedPrices[booking.id].meetsMinimumStay ? (
      <p style={{color: '#176534'}}>
        Minimum stay requirement satisfied.
      </p>
    ) : (
      <p style={{color: '#b00020'}}>
        Minimum stay requirement not satisfied.
        The owner may make an exception.
      </p>
    )}
  </div>
) : (
  <p style={{color: '#785400'}}>
    {verifiedPrices[booking.id]?.error || pricingErrors.settings ||
      pricingErrors.seasons || 'Waiting for current pricing from Firebase...'}
    {' '}Owner approval remains available.
  </p>
)}
{/* OWNER AGREED PRICE */}

<div style={{
  background: '#ffffff',
  border: '1px solid #b7ddf6',
  borderRadius: '8px',
  padding: '15px',
  marginTop: '15px'
}}>
  <label
    htmlFor={`agreed-price-${booking.id}`}
    style={{
      display: 'block',
      fontWeight: 'bold',
      marginBottom: '10px'
    }}
  >
    Final Agreed Price (ZAR)
  </label>

  <input
    id={`agreed-price-${booking.id}`}
    type="number"
    min="0"
    max="15000000"
    step="1"
    value={
      agreedPrices[booking.id] ??
      booking.quotedTotal ??
      ''
    }
    onChange={(event) => {
      setAgreedPrices((current) => ({
        ...current,
        [booking.id]: event.target.value
      }))
    }}
    disabled={processingRequestId !== null}
    placeholder="Enter agreed price"
    style={{
      width: '100%',
      maxWidth: '250px',
      padding: '10px',
      border: '1px solid #b7ddf6',
      borderRadius: '6px',
      fontSize: '18px',
      boxSizing: 'border-box'
    }}
  />

  <PriceAdjustment
    original={
      Number.isInteger(booking.quotedTotal) &&
      booking.quotedTotal > 0 &&
      booking.currency === 'ZAR'
        ? booking.quotedTotal
        : verifiedPrices[booking.id]?.currentTotal
    }
    agreed={
      agreedPrices[booking.id] ??
      booking.quotedTotal ??
      ''
    }
    basis={
      Number.isInteger(booking.quotedTotal) &&
      booking.quotedTotal > 0 &&
      booking.currency === 'ZAR'
        ? 'original customer quote'
        : 'current calculated price'
    }
  />

  <p style={{
    fontSize: '12px',
    color: '#617386',
    marginBottom: 0
  }}>
    The owner may adjust the final price independently
    of seasonal rates and minimum stay requirements.
  </p>
</div>

              <p style={{fontSize: '13px',color: '#785400'}}>
                Awaiting owner approval.
              </p>

              <div style={{display:'flex',gap:'10px',flexWrap:'wrap',marginTop:'14px'}}>
                <button
                  type="button"
                  onClick={() => handleRequestAction(booking, 'accept')}
                  disabled={processingRequestId !== null}
                  style={{
                    ...styles.button,
                    background:'#176534',
                    opacity:processingRequestId !== null ? 0.6 : 1,
                    cursor:processingRequestId !== null ? 'wait' : 'pointer'
                  }}
                >
                  {processingRequestId === booking.id ? 'Processing...' : 'Accept'}
                </button>
                <button
                  type="button"
                  onClick={() => handleRequestAction(booking, 'decline')}
                  disabled={processingRequestId !== null}
                  style={{
                    ...styles.button,
                    background:'#b00020',
                    opacity:processingRequestId !== null ? 0.6 : 1,
                    cursor:processingRequestId !== null ? 'wait' : 'pointer'
                  }}
                >
                  Decline
                </button>
              </div>
            </BookingRow>
          )
        })}
      </section>

      <section style={{
  ...styles.card,
  display: bookingFilter === 'pending' ? 'none' : undefined
}}>
  <h2>Confirmed Reservations ({activeBookings.length})</h2>

        {loading && <p>Loading reservations...</p>}

        {!loading && !error && !activeBookings.some(
          (booking) => booking.status === 'confirmed'
        ) && (
          <p>No confirmed reservations yet.</p>
        )}

        {activeBookings
          .filter((booking) => booking.status === 'confirmed')
          .sort((a, b) => (
            (a.checkIn || '').localeCompare(b.checkIn || '')
          ))
          .map((booking) => (
            <BookingRow
  key={`confirmed-${booking.id}`}
  booking={booking}
  expanded={expandedBooking === `confirmed-${booking.id}`}
  onToggle={() => toggleBooking(`confirmed-${booking.id}`)}
>
              <strong>
                {booking.guestName || 'Guest'}
              </strong>

              <p>
                {formatDate(booking.checkIn)}
                {' – '}
                {formatDate(booking.checkOut)}
              </p>

              <p>
                Guests: {booking.guests ?? 'Not specified'}
              </p>
<div className="booking-details-grid">
  <p>
    <strong>Email:</strong>{' '}
    {booking.email || 'Not provided'}
  </p>

  <p>
    <strong>Telephone:</strong>{' '}
    {booking.phone || 'Not provided'}
  </p>

  <p>
    <strong>Source:</strong>{' '}
    {booking.source === 'manual'
      ? 'Manual reservation'
      : booking.source === 'request'
        ? 'Website request'
        : 'Not specified'}
  </p>

  <p>
    <strong>Special requests:</strong>{' '}
    {booking.notes || 'None'}
  </p>
</div>

{/* CONFIRMED RESERVATION PRICE */}

<div style={{
  background: '#eef7fd',
  borderRadius: '8px',
  padding: '12px',
  marginTop: '10px',
  marginBottom: '10px'
}}>
  {Number.isInteger(booking.originalQuotedTotal) && (
    <p>
      <strong>Original quoted price:</strong>{' '}
      R {booking.originalQuotedTotal.toLocaleString('en-ZA')}
    </p>
  )}

  <PriceAdjustment
    original={booking.originalQuotedTotal}
    agreed={booking.agreedTotal}
  />

  {Number.isInteger(booking.agreedTotal) ? (
    <h3 style={{
      color: '#176534',
      margin: '8px 0'
    }}>
      Agreed price: R{' '}
      {booking.agreedTotal.toLocaleString('en-ZA')}
    </h3>
  ) : (
    <p style={{color: '#617386'}}>
      No agreed price recorded.
    </p>
  )}
</div>
                <button
                type="button"
                onClick={() => handleDeleteReservation(booking)}
                disabled={deletingId === booking.id}
                style={{
                    background: '#b00020',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '7px',
                    padding: '9px 14px',
                    cursor: deletingId === booking.id ? 'wait' : 'pointer',
                    marginTop: '8px'
                }}
                >
                {deletingId === booking.id
                    ? 'Cancelling...'
                    : 'Cancel Booking'}
                </button>

            </BookingRow>
          ))}
      </section>

      <p style={{
        fontSize: '12px',
        color: '#617386',
        textAlign: 'center'
      }}>
        Pending requests appear in amber and do not block dates. Confirmed reservations appear in red and block occupied nights. Red takes priority when both overlap.
      </p>
      <section style={styles.card}>
        <button
          type="button"
          aria-expanded={showPricing}
          aria-controls="admin-pricing-management"
          onClick={() => setShowPricing(current => !current)}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            width: '100%',
            padding: '12px 4px',
            border: 'none',
            background: 'transparent',
            color: '#082f6d',
            fontSize: '18px',
            fontWeight: 'bold',
            cursor: 'pointer',
            textAlign: 'left'
          }}
        >
          <span>Pricing Management</span>
          <span aria-hidden="true">
            {showPricing ? '\u25B2' : '\u25BC'}
          </span>
        </button>

        <div
          id="admin-pricing-management"
          hidden={!showPricing}
          style={{paddingTop: '12px'}}
        >
          <PricingManagement />
        </div>
      </section>

      <section style={{...styles.card, textAlign:'center', borderColor:'#c6cdb4', color:'#455438'}}>
        <img
          src={`${import.meta.env.BASE_URL}images/figtree/figtree-banner.png`}
          alt="Figtree Craft Stall — handcrafted items, gifts and local treats"
          loading="lazy"
          style={{display:'block', width:'100%', maxWidth:'1000px', height:'auto', margin:'0 auto', borderRadius:'8px'}}
        />
        <h3 style={{marginBottom:'8px'}}>Figtree Craft Stall — Coming Soon</h3>
        <p style={{marginBottom:0}}>A dedicated area for managing the Figtree Craft Stall will be available here in the future.</p>
      </section>

    </main>
  )
}

export default AdminDashboard




