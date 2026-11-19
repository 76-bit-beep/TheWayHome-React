
export const getBookingState = (booking, now = Date.now()) => {
  if (booking.status === 'confirmed') {
    return 'confirmed'
  }

  if (booking.status !== 'pending') {
    return 'inactive'
  }

  const expiry = booking.holdExpiresAt?.toDate
    ? booking.holdExpiresAt.toDate()
    : typeof booking.holdExpiresAt === 'string'
      ? new Date(booking.holdExpiresAt)
      : null

  if (!expiry || !Number.isFinite(expiry.getTime())) {
    return 'inactive'
  }

  return expiry.getTime() > now ? 'pending' : 'inactive'
}

export const datesOverlap = (startA, endA, startB, endB) => {
  return startA < endB && endA > startB
}

export const isNightBlocked = (bookings, date, now = Date.now()) => {
  return bookings.some((booking) => {
    if (getBookingState(booking, now) === 'inactive') {
      return false
    }

    if (!booking.checkIn || !booking.checkOut) {
      return false
    }

    return booking.checkIn <= date && date < booking.checkOut
  })
}

export const isStayBlocked = (
  bookings,
  checkIn,
  checkOut,
  now = Date.now()
) => {
  if (!checkIn || !checkOut || checkIn >= checkOut) {
    return true
  }

  return bookings.some((booking) => {
    if (getBookingState(booking, now) === 'inactive') {
      return false
    }

    if (!booking.checkIn || !booking.checkOut) {
      return false
    }

    return datesOverlap(
      checkIn,
      checkOut,
      booking.checkIn,
      booking.checkOut
    )
  })
}
