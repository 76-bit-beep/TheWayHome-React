
import {useEffect, useMemo, useState} from 'react'
import {collection, deleteDoc, doc, onSnapshot} from 'firebase/firestore'
import {signOut} from 'firebase/auth'
import {auth, db} from '../firebase'
import ManualReservation from './ManualReservation.jsx'

const HOLD_HOURS = 48

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

const getHoldExpiry = (booking) => {
  if (booking.holdExpiresAt?.toDate) {
    return booking.holdExpiresAt.toDate()
  }

  if (typeof booking.holdExpiresAt === 'string') {
    const date = new Date(booking.holdExpiresAt)

    if (!Number.isNaN(date.getTime())) {
      return date
    }
  }

  // Do not invent an expiry when none was saved.
  return null
}

const getBookingState = (booking, now) => {
  if (booking.status === 'confirmed') {
    return 'confirmed'
  }

  if (booking.status !== 'pending') {
    return 'inactive'
  }

  const expiry = getHoldExpiry(booking)

  if (!expiry || expiry.getTime() <= now) {
    return 'inactive'
  }

  return 'pending'
}

const overlapsDate = (booking, date) => {
  if (!parseDate(booking.checkIn) || !parseDate(booking.checkOut)) {
    return false
  }

  // Checkout day is not occupied.
  return booking.checkIn <= date && date < booking.checkOut
}

function AdminDashboard() {
  const [bookings, setBookings] = useState([])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [monthOffset, setMonthOffset] = useState(0)
  const [selectedDate, setSelectedDate] = useState(null)
  const [deletingId, setDeletingId] = useState(null)
  const [showManualReservation, setShowManualReservation] = useState(false)
  const [now, setNow] = useState(Date.now())

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

  // Refresh hold expiry calculations every minute.
  useEffect(() => {
    const timer = setInterval(() => {
      setNow(Date.now())
    }, 60000)

    return () => clearInterval(timer)
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
    return bookings.filter((booking) => {
      return getBookingState(booking, now) !== 'inactive'
    })
  }, [bookings, now])

  const pendingBookings = useMemo(() => {
    return activeBookings
      .filter((booking) => getBookingState(booking, now) === 'pending')
      .sort((a, b) => {
        const first = a.createdAt?.toMillis?.() || 0
        const second = b.createdAt?.toMillis?.() || 0

        return second - first
      })
  }, [activeBookings, now])

  const getBookingsForDate = (date) => {
    return activeBookings.filter((booking) => {
      return overlapsDate(booking, date)
    })
  }

  const selectedBookings = selectedDate
    ? getBookingsForDate(selectedDate)
    : []

const handleDeleteReservation = async (booking) => {
  const confirmed = window.confirm(
    `Permanently delete the reservation for ${booking.guestName || 'Guest'}?\n\n` +
    `Arrival: ${formatDate(booking.checkIn)}\n` +
    `Departure: ${formatDate(booking.checkOut)}\n\n` +
    'This action cannot be undone.'
  )

  if (!confirmed) return

  setDeletingId(booking.id)
  setError('')

  try {
    await deleteDoc(doc(db, 'bookings', booking.id))
  } catch (err) {
    console.error('Failed to delete reservation:', err)
    setError('Unable to delete reservation. Check Firebase permissions.')
  } finally {
    setDeletingId(null)
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

  {showManualReservation && (
    <div style={{marginTop: '20px'}}>
      <ManualReservation
        bookings={bookings}
        onSaved={() => setShowManualReservation(false)}
        onCancel={() => setShowManualReservation(false)}
      />
    </div>
  )}
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

      {error && (
        <p role="alert" style={{color: '#b00020'}}>
          {error}
        </p>
      )}

      <section style={styles.card}>
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
              return getBookingState(booking, now) === 'confirmed'
            })

            const pending = reservations.some((booking) => {
              return getBookingState(booking, now) === 'pending'
            })

            const background = confirmed
              ? '#c9f0d3'
              : pending
                ? '#ffe4a8'
                : '#f2f8fc'

            return (
              <button
                key={date}
                type="button"
                onClick={() => setSelectedDate(date)}
                aria-pressed={selectedDate === date}
                aria-label={`${formatDate(date)}, ${
                  confirmed
                    ? 'confirmed reservation'
                    : pending
                      ? 'pending reservation'
                      : 'no reservation'
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
          <span>🟢 Confirmed</span>
          <span>🟠 Pending (48-hour hold)</span>
          <span>⚪ No reservation</span>
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
              <p>No active reservations for this date.</p>
            ) : (
              selectedBookings.map((booking) => (
                <div key={booking.id}>
                  <strong>
                    {booking.guestName || 'Guest'}
                  </strong>

                  <p>
                    {formatDate(booking.checkIn)}
                    {' – '}
                    {formatDate(booking.checkOut)}
                  </p>

                  <p>
                    Status: {getBookingState(booking, now)}
                  </p>
                </div>
              ))
            )}
          </div>
        )}
      </section>

      <section style={styles.card}>
        <h2>
          New Booking Requests
          {' '}
          ({pendingBookings.length})
        </h2>

        {loading && <p>Loading reservations...</p>}

        {!loading && !error && pendingBookings.length === 0 && (
          <p>No new booking requests at the moment.</p>
        )}

        {pendingBookings.map((booking) => {
          const expiry = getHoldExpiry(booking)

          return (
            <article
              key={booking.id}
              style={styles.notification}
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

              <p>
                <strong>Hold expires:</strong>{' '}
                {expiry
                  ? expiry.toLocaleString('en-ZA', {
                      dateStyle: 'medium',
                      timeStyle: 'short'
                    })
                  : 'Not recorded'}
              </p>

              <p style={{fontSize: '13px',color: '#785400'}}>
                Awaiting owner approval.
              </p>
            </article>
          )
        })}
      </section>

      <section style={styles.card}>
        <h2>Confirmed Reservations</h2>

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
            <article
              key={booking.id}
              style={{
                padding: '12px',
                borderBottom: '1px solid #d5e5ef'
              }}
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
                    ? 'Deleting...'
                    : 'Delete Reservation'}
                </button>

            </article>
          ))}
      </section>

      <p style={{
        fontSize: '12px',
        color: '#617386',
        textAlign: 'center'
      }}>
        Pending holds expire after 48 hours when a valid
        hold expiry has been recorded by the booking backend.
      </p>
    </main>
  )
}

export default AdminDashboard
