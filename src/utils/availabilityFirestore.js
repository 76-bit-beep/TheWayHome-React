
import {
  collection,
  doc,
  runTransaction,
  serverTimestamp
} from 'firebase/firestore'

import {db} from '../firebase.js'
import {getBookedNights} from './bookingDates.js'
import {
  loadPricing,
  calculateBookingPrice
} from './pricing.js'

// =====================================================
// 1. CHECK NIGHT AVAILABILITY
// =====================================================

// Must be called inside a Firestore transaction.
// Existing availability documents cannot be overwritten.
// An optional database allows isolated emulator testing.
export const checkNightsAvailable = async (
  transaction,
  nights,
  database = db
) => {
  const nightRefs = nights.map((night) =>
    doc(database, 'publicAvailability', night)
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
// 2. CREATE CONFIRMED RESERVATION
// =====================================================

// Atomically create the private reservation and
// public availability documents.
//
// The optional database parameter supports emulator tests.
// Normal application calls continue using the default db.
export const createConfirmedReservation = async (
  reservation,
  database = db
) => {
  // Validate dates and enforce the 30-night maximum.
  const nights = getBookedNights(
    reservation.checkIn,
    reservation.checkOut
  )

  const bookingRef = doc(collection(database, 'bookings'))

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

  await runTransaction(database, async (transaction) => {
    // Check all nights before writing anything.
    const nightRefs = await checkNightsAvailable(
      transaction,
      nights,
      database
    )

    // Create private booking.
    transaction.set(bookingRef, bookingData)

    // Create public availability documents.
    nightRefs.forEach((nightRef) => {
      transaction.set(nightRef, {
        bookingId:bookingRef.id,
        status:'confirmed'
      })
    })
  })

  return bookingRef.id
}

// =====================================================
// 3. DELETE CONFIRMED RESERVATION
// =====================================================

// Atomically delete the private reservation and
// its matching public availability documents.
//
// The optional database parameter supports emulator tests.
export const deleteConfirmedReservation = async (
  bookingId,
  database = db
) => {
  if (
    typeof bookingId !== 'string' ||
    !bookingId.trim()
  ) {
    throw new Error('Invalid reservation ID')
  }

  const bookingRef = doc(database, 'bookings', bookingId)

  await runTransaction(database, async (transaction) => {
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
      doc(database, 'publicAvailability', night)
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

// =====================================================
// VERIFY CUSTOMER BOOKING PRICE
// =====================================================

export const verifyBookingPrice = async (request) => {
  const {settings, seasons} = await loadPricing()

  const calculatedPrice = calculateBookingPrice(
    request.checkIn,
    request.checkOut,
    request.guests,
    settings,
    seasons
  )

  const originalQuote =
    Number.isInteger(request.quotedTotal) &&
    request.quotedTotal > 0 &&
    request.currency === 'ZAR'
      ? request.quotedTotal
      : null

  return {
    originalQuote,
    currentTotal: calculatedPrice.total,
    currency: calculatedPrice.currency,
    nights: calculatedPrice.nights,
    minimumStay: calculatedPrice.minimumStay,
    meetsMinimumStay: calculatedPrice.meetsMinimumStay,
    breakdown: calculatedPrice.breakdown,

    priceChanged:
      originalQuote !== calculatedPrice.total,

    difference:
      originalQuote === null
        ? null
        : calculatedPrice.total - originalQuote
  }
}
// =====================================================
// 4. ACCEPT CUSTOMER BOOKING REQUEST
// =====================================================

export const acceptBookingRequest = async (
  requestId,
  database = db,
  agreedTotal = null
) => {
  if (typeof requestId !== 'string' || !requestId.trim()) {
    throw new Error('Invalid booking request ID')
  }

  // Validate the optional owner-agreed price.
  if (
    agreedTotal !== null &&
    (
      !Number.isInteger(agreedTotal) ||
      agreedTotal < 0 ||
      agreedTotal > 15000000
    )
  ) {
    throw new Error('Invalid agreed booking price')
  }

  const requestRef = doc(database, 'bookingRequests', requestId)
  const bookingRef = doc(collection(database, 'bookings'))

  await runTransaction(database, async (transaction) => {
    const requestSnapshot = await transaction.get(requestRef)

    if (!requestSnapshot.exists()) {
      throw new Error('Booking request no longer exists')
    }

    const request = requestSnapshot.data()

    if (request.status !== 'pending') {
      throw new Error('This request has already been processed')
    }

    const nights = getBookedNights(
      request.checkIn,
      request.checkOut
    )

    const nightRefs = await checkNightsAvailable(
      transaction,
      nights,
      database
    )

    // All reads are complete. Begin atomic writes.
    transaction.set(bookingRef, {
      guestName: request.guestName,
      email: request.email,
      phone: request.phone,
      guests: request.guests,
      checkIn: request.checkIn,
      checkOut: request.checkOut,
      notes: request.notes,
      status: 'confirmed',
      source: 'request',
      requestId: requestId,

      // Preserve original quote and owner-agreed price.
      ...(agreedTotal !== null ? {
        originalQuotedTotal: request.quotedTotal ?? null,
        agreedTotal: agreedTotal,
        currency: 'ZAR'
      } : {}),

      createdAt: serverTimestamp()
    })

    // Block every night included in the reservation.
    nightRefs.forEach((nightRef) => {
      transaction.set(nightRef, {
        bookingId: bookingRef.id,
        status: 'confirmed'
      })
    })

    // Mark the original customer request as accepted.
    transaction.update(requestRef, {
      status: 'accepted',
      bookingId: bookingRef.id
    })
  })

  return bookingRef.id
}