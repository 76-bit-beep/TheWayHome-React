
import {
  collection,
  doc,
  runTransaction,
  serverTimestamp
} from 'firebase/firestore'

import {db} from '../firebase'

// =====================================================
// 1. GENERATE BOOKED NIGHTS
// =====================================================

// Generate occupied nights between check-in and checkout.
// Checkout day is excluded.
export const getBookedNights = (checkIn, checkOut) => {
  const datePattern = /^\d{4}-\d{2}-\d{2}$/

  if (
    typeof checkIn !== 'string' ||
    typeof checkOut !== 'string' ||
    !datePattern.test(checkIn) ||
    !datePattern.test(checkOut)
  ) {
    throw new Error('Invalid booking date format')
  }

  const current = new Date(`${checkIn}T00:00:00Z`)
  const end = new Date(`${checkOut}T00:00:00Z`)

  if (
    !Number.isFinite(current.getTime()) ||
    !Number.isFinite(end.getTime()) ||
    current.toISOString().slice(0, 10) !== checkIn ||
    end.toISOString().slice(0, 10) !== checkOut ||
    current >= end
  ) {
    throw new Error('Invalid booking dates')
  }

  const nights = []

  while (current < end) {
    nights.push(current.toISOString().slice(0, 10))
    current.setUTCDate(current.getUTCDate() + 1)
  }

  return nights
}

// =====================================================
// 2. CHECK NIGHT AVAILABILITY
// =====================================================

// Must be called inside a Firestore transaction.
// Existing availability documents cannot be overwritten.
export const checkNightsAvailable = async (transaction, nights) => {
  const nightRefs = nights.map((night) =>
    doc(db, 'publicAvailability', night)
  )

  const snapshots = []

  // All transaction reads must happen before writes.
  for (const nightRef of nightRefs) {
    snapshots.push(await transaction.get(nightRef))
  }

  for (let i = 0; i < snapshots.length; i += 1) {
    const snapshot = snapshots[i]

    if (!snapshot.exists()) continue

    const data = snapshot.data()

    if (data.status === 'confirmed') {
      throw new Error(
        `Date ${nights[i]} is already booked`
      )
    }

    if (data.status === 'pending') {
      throw new Error(
        `Date ${nights[i]} has an existing pending hold`
      )
    }

    throw new Error(
      `Date ${nights[i]} contains an unsupported availability record`
    )
  }

  return nightRefs
}

// =====================================================
// 3. CREATE CONFIRMED RESERVATION
// =====================================================

// Atomically create the private reservation and
// public availability documents.
export const createConfirmedReservation = async (reservation) => {
  const nights = getBookedNights(
    reservation.checkIn,
    reservation.checkOut
  )

  const bookingRef = doc(collection(db, 'bookings'))

  const bookingData = {
    guestName: reservation.guestName.trim(),
    email: (reservation.email || '').trim(),
    phone: (reservation.phone || '').trim(),
    guests: Number(reservation.guests),
    checkIn: reservation.checkIn,
    checkOut: reservation.checkOut,
    notes: (reservation.notes || '').trim(),
    status: 'confirmed',
    source: 'manual',
    createdAt: serverTimestamp()
  }

  // Validate reservation details.
  if (
    !bookingData.guestName ||
    bookingData.guestName.length > 120 ||
    bookingData.email.length > 254 ||
    bookingData.phone.length > 40 ||
    bookingData.notes.length > 2000 ||
    !Number.isInteger(bookingData.guests) ||
    bookingData.guests < 1 ||
    bookingData.guests > 5
  ) {
    throw new Error('Invalid reservation details')
  }

  await runTransaction(db, async (transaction) => {
    // Check all nights before writing anything.
    const nightRefs = await checkNightsAvailable(
      transaction,
      nights
    )

    // Create private booking.
    transaction.set(bookingRef, bookingData)

    // Create public availability documents.
    nightRefs.forEach((nightRef) => {
      transaction.set(nightRef, {
        bookingId: bookingRef.id,
        status: 'confirmed'
      })
    })
  })

  return bookingRef.id
}

// =====================================================
// 4. DELETE CONFIRMED RESERVATION
// =====================================================

// Atomically delete the private reservation and
// its matching public availability documents.
export const deleteConfirmedReservation = async (bookingId) => {
  if (
    typeof bookingId !== 'string' ||
    !bookingId.trim()
  ) {
    throw new Error('Invalid reservation ID')
  }

  const bookingRef = doc(db, 'bookings', bookingId)

  await runTransaction(db, async (transaction) => {
    // Read the private reservation.
    const bookingSnapshot = await transaction.get(bookingRef)

    if (!bookingSnapshot.exists()) {
      throw new Error('Reservation no longer exists')
    }

    const booking = bookingSnapshot.data()

    if (booking.status !== 'confirmed') {
      throw new Error(
        'Only confirmed reservations are supported'
      )
    }

    const nights = getBookedNights(
      booking.checkIn,
      booking.checkOut
    )

    const nightRefs = nights.map((night) =>
      doc(db, 'publicAvailability', night)
    )

    const nightSnapshots = []

    // Read every availability document before writing.
    for (const nightRef of nightRefs) {
      nightSnapshots.push(
        await transaction.get(nightRef)
      )
    }

    // Verify ownership of every existing blocked night.
    for (let i = 0; i < nightSnapshots.length; i += 1) {
      const snapshot = nightSnapshots[i]

      // Older bookings may not have public availability.
      if (!snapshot.exists()) continue

      const data = snapshot.data()

      if (
        data.bookingId !== bookingId ||
        data.status !== 'confirmed'
      ) {
        throw new Error(
          `Availability conflict on ${nights[i]}`
        )
      }
    }

    // Delete the private reservation.
    transaction.delete(bookingRef)

    // Delete only matching availability documents.
    nightSnapshots.forEach((snapshot, index) => {
      if (snapshot.exists()) {
        transaction.delete(nightRefs[index])
      }
    })
  })
}
