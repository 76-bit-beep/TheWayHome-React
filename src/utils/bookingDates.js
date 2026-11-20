
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
    current.toISOString().slice(0,10) !== checkIn ||
    end.toISOString().slice(0,10) !== checkOut ||
    current >= end
  ) {
    throw new Error('Invalid booking dates')
  }

  const stayNights = Math.round(
    (end.getTime() - current.getTime()) / 86400000
  )

  if (stayNights > 30) {
    throw new Error('Maximum booking duration is 30 nights')
  }

  const nights = []

  while (current < end) {
    nights.push(current.toISOString().slice(0,10))
    current.setUTCDate(current.getUTCDate() + 1)
  }

  return nights
}
