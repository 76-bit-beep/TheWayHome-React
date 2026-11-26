
import {
  collection,
  doc,
  getDocFromServer,
  getDocsFromServer,
  setDoc,
  addDoc,
  deleteDoc,
  updateDoc
} from 'firebase/firestore'

import { db } from '../firebase.js'

// DEFAULT PRICING

export const DEFAULT_PRICING = {
  nightlyRate: 400,
  minimumStay: 1,
  currency: 'ZAR'
}

// LOAD PRICING SETTINGS

export async function loadPricing() {
  const [settingsSnapshot, seasonsSnapshot] =
    await Promise.all([
      getDocFromServer(
        doc(db, 'pricingSettings', 'default')
      ),
      getDocsFromServer(
        collection(db, 'seasonalPricing')
      )
    ])

  const settings = settingsSnapshot.exists()
    ? settingsSnapshot.data()
    : { ...DEFAULT_PRICING }

  const seasons = seasonsSnapshot.docs.map(item => ({
    ...item.data(),
    id: item.id
  }))

  return { settings, seasons }
}

// SAVE DEFAULT PRICING

export async function saveDefaultPricing(settings) {
  await setDoc(
    doc(db, 'pricingSettings', 'default'),
    {
      nightlyRate: Number(settings.nightlyRate),
      minimumStay: Number(settings.minimumStay),
      currency: 'ZAR'
    }
  )
}

// ADD OR UPDATE SEASONAL PRICING

export async function saveSeasonalPricing(season) {
  const data = {
    name: season.name.trim(),
    startDate: season.startDate,
    endDate: season.endDate,
    nightlyRate: Number(season.nightlyRate),
    minimumStay: Number(season.minimumStay)
  }

  if (season.id) {
    await updateDoc(
      doc(db, 'seasonalPricing', season.id),
      data
    )
  } else {
    await addDoc(
      collection(db, 'seasonalPricing'),
      data
    )
  }
}

// DELETE SEASONAL PRICING

export async function deleteSeasonalPricing(id) {
  await deleteDoc(
    doc(db, 'seasonalPricing', id)
  )
}

// VALIDATE AND PARSE DATE

function parseDate(value) {
  if (
    typeof value !== 'string' ||
    !/^\d{4}-\d{2}-\d{2}$/.test(value)
  ) {
    throw new Error('Invalid booking date.')
  }

  const date = new Date(`${value}T00:00:00Z`)

  if (
    Number.isNaN(date.getTime()) ||
    date.toISOString().slice(0, 10) !== value
  ) {
    throw new Error('Invalid booking date.')
  }

  return date
}

// CALCULATE BOOKING PRICE

export function calculateBookingPrice(
  checkIn,
  checkOut,
  guests,
  settings = DEFAULT_PRICING,
  seasons = []
) {
  const start = parseDate(checkIn)
  const end = parseDate(checkOut)
  const guestCount = Number(guests)

  const nights = (end - start) / 86400000

  if (nights < 1 || nights > 30) {
    throw new Error('Bookings must be 1 to 30 nights.')
  }

  if (
    !Number.isInteger(guestCount) ||
    guestCount < 1 ||
    guestCount > 5
  ) {
    throw new Error('Bookings must have 1 to 5 guests.')
  }

  const breakdown = []
  let total = 0
  let minimumStay = 1

  const current = new Date(start)

  while (current < end) {
    const date = current.toISOString().slice(0, 10)

    const matchingSeasons = seasons.filter(
      season =>
        date >= season.startDate &&
        date <= season.endDate
    )

    // Shorter periods take priority over longer periods.
    // This allows individual dates to override seasons.

    matchingSeasons.sort((a, b) => {
      const durationA =
        parseDate(a.endDate) - parseDate(a.startDate)

      const durationB =
        parseDate(b.endDate) - parseDate(b.startDate)

      return durationA - durationB
    })

    if (
      matchingSeasons.length > 1 &&
      (
        parseDate(matchingSeasons[0].endDate) -
        parseDate(matchingSeasons[0].startDate)
      ) === (
        parseDate(matchingSeasons[1].endDate) -
        parseDate(matchingSeasons[1].startDate)
      )
    ) {
      throw new Error(`Conflicting pricing for ${date}.`)
    }

    const activePricing =
      matchingSeasons[0] || settings

    const nightlyRate = activePricing.nightlyRate
    const nightlyTotal = nightlyRate * guestCount

    minimumStay = Math.max(
      minimumStay,
      activePricing.minimumStay
    )

    total += nightlyTotal

    breakdown.push({
      date,
      nightlyRate,
      guests: guestCount,
      total: nightlyTotal,
      season: activePricing.name || 'Standard rate'
    })

    current.setUTCDate(current.getUTCDate() + 1)
  }

  return {
    nights,
    guests: guestCount,
    total,
    currency: 'ZAR',
    minimumStay,
    meetsMinimumStay: nights >= minimumStay,
    breakdown
  }
}
