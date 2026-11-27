import {test} from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'

import {
  initializeTestEnvironment,
  assertSucceeds
} from '@firebase/rules-unit-testing'

import {
  collection,
  doc,
  addDoc,
  getDoc,
  setDoc,
  serverTimestamp
} from 'firebase/firestore'

import {
  acceptBookingRequest,
  createConfirmedReservation,
  deleteConfirmedReservation
} from '../src/utils/availabilityFirestore.js'

const projectId = 'demo-thewayhome'
const adminUid = 'qCMUIllRSgRmTucv7Tlqz5PJ3gl2'

const requestData = () => ({
  guestName: 'Pricing Test Guest',
  email: 'pricing-test@example.com',
  phone: '0123456789',
  guests: 2,
  checkIn: '2027-04-10',
  checkOut: '2027-04-11',
  notes: 'Isolated pricing test',
  status: 'pending',
  createdAt: serverTimestamp(),
  quotedTotal: 800,
  currency: 'ZAR',
  nights: 1,
  minimumStay: 1,
  priceBreakdown: [{
    date: '2027-04-10',
    nightlyRate: 400,
    guests: 2,
    chargeableGuests: 2,
    total: 800,
    season: 'Standard rate'
  }]
})

test('Booking pricing and negotiated discounts', async (t) => {
  const env = await initializeTestEnvironment({
    projectId,
    firestore: {
      host: '127.0.0.1',
      port: 8081,
      rules: readFileSync('firestore.rules', 'utf8')
    }
  })

  try {
    const adminDb =
      env.authenticatedContext(adminUid).firestore()

    const guestDb =
      env.unauthenticatedContext().firestore()

    const reset = async () => {
      await env.clearFirestore()

      await setDoc(
        doc(adminDb, 'pricingSettings', 'default'),
        {
          nightlyRate: 400,
          minimumStay: 1,
          currency: 'ZAR'
        }
      )
    }

    const submitRequest = async () => {
      await reset()

      return assertSucceeds(
        addDoc(
          collection(guestDb, 'bookingRequests'),
          requestData()
        )
      )
    }

    const verifyApproval = async (agreedTotal) => {
      const request = await submitRequest()

      const bookingId = await acceptBookingRequest(
        request.id, adminDb, agreedTotal
      )

      const booking = (
        await getDoc(doc(adminDb, 'bookings', bookingId))
      ).data()

      assert.equal(booking.originalQuotedTotal, 800)
      assert.equal(booking.agreedTotal, agreedTotal)
      assert.equal(booking.currency, 'ZAR')

      const original = (
        await getDoc(doc(adminDb, 'bookingRequests', request.id))
      ).data()

      assert.equal(original.quotedTotal, 800)
      assert.equal(original.status, 'accepted')

      await deleteConfirmedReservation(bookingId, adminDb)
    }

    await t.test('Cancellation completely deletes online reservation', async () => {
      const request = await submitRequest()

      const bookingId = await acceptBookingRequest(
        request.id, adminDb, 800
      )

      const bookingRef = doc(adminDb, 'bookings', bookingId)
      const requestRef = doc(adminDb, 'bookingRequests', request.id)
      const nightRef = doc(adminDb, 'publicAvailability', '2027-04-10')

      assert.equal((await getDoc(bookingRef)).exists(), true)
      assert.equal((await getDoc(requestRef)).exists(), true)
      assert.equal((await getDoc(nightRef)).exists(), true)

      await deleteConfirmedReservation(bookingId, adminDb)

      assert.equal((await getDoc(bookingRef)).exists(), false)
      assert.equal((await getDoc(requestRef)).exists(), false)
      assert.equal((await getDoc(nightRef)).exists(), false)
    })

    await t.test('Accepted request cannot be deleted independently', async () => {
      const request = await submitRequest()

      const bookingId = await acceptBookingRequest(
        request.id, adminDb, 800
      )

      const {deleteDoc} = await import('firebase/firestore')

      await assert.rejects(
        deleteDoc(doc(adminDb, 'bookingRequests', request.id)),
        {code: 'permission-denied'}
      )

      assert.equal(
        (await getDoc(doc(adminDb, 'bookingRequests', request.id))).exists(),
        true
      )

      await deleteConfirmedReservation(bookingId, adminDb)
    })

    await t.test('Administrator cannot independently delete pending request', async () => {
      const request = await submitRequest()
      const {deleteDoc} = await import('firebase/firestore')

      await assert.rejects(
        deleteDoc(doc(adminDb, 'bookingRequests', request.id)),
        {code: 'permission-denied'}
      )
    })


    await t.test('Thirty-night cancellation preserves unrelated reservation', async () => {
      await reset()

      const dates = Array.from({length: 30}, (_, i) =>
        `2027-04-${String(i + 1).padStart(2, '0')}`
      )

      const request = await addDoc(
        collection(guestDb, 'bookingRequests'),
        {
          ...requestData(),
          checkIn: '2027-04-01',
          checkOut: '2027-05-01',
          nights: 30,
          quotedTotal: 24000,
          priceBreakdown: dates.map(date => ({
            ...requestData().priceBreakdown[0],
            date
          }))
        }
      )

      const bookingId = await acceptBookingRequest(
        request.id, adminDb, 24000
      )

      const otherId = await createConfirmedReservation({
        guestName: 'Unrelated Reservation',
        guests: 2,
        checkIn: '2027-05-01',
        checkOut: '2027-05-02'
      }, adminDb)

      for (const date of dates) {
        const snapshot = await getDoc(
          doc(adminDb, 'publicAvailability', date)
        )
        assert.equal(snapshot.data().bookingId, bookingId)
      }

      await deleteConfirmedReservation(bookingId, adminDb)

      assert.equal(
        (await getDoc(doc(adminDb, 'bookings', bookingId))).exists(),
        false
      )

      assert.equal(
        (await getDoc(doc(adminDb, 'bookingRequests', request.id))).exists(),
        false
      )

      for (const date of dates) {
        assert.equal(
          (await getDoc(doc(adminDb, 'publicAvailability', date))).exists(),
          false
        )
      }

      assert.equal(
        (await getDoc(doc(adminDb, 'bookings', otherId))).exists(),
        true
      )

      assert.equal(
        (await getDoc(doc(adminDb, 'publicAvailability', '2027-05-01'))).data().bookingId,
        otherId
      )

      await deleteConfirmedReservation(otherId, adminDb)
    })


    await t.test('Standard booking price preserved', async () => {
      await verifyApproval(800)
    })

    await t.test('Administrator discount stored correctly', async () => {
      await verifyApproval(700)
    })

    await t.test('Administrator additional charge stored correctly', async () => {
      await verifyApproval(900)
    })

    await t.test('Negative agreed price rejected', async () => {
      const request = await submitRequest()

      await assert.rejects(
        acceptBookingRequest(request.id, adminDb, -100),
        /Invalid agreed booking price/
      )
    })

    await t.test('Fractional agreed price rejected', async () => {
      const request = await submitRequest()

      await assert.rejects(
        acceptBookingRequest(request.id, adminDb, 700.5),
        /Invalid agreed booking price/
      )
    })

    await t.test('Excessive agreed price rejected', async () => {
      const request = await submitRequest()

      await assert.rejects(
        acceptBookingRequest(request.id, adminDb, 15000001),
        /Invalid agreed booking price/
      )
    })

    await t.test('Complimentary online reservation preserves original price', async () => {
      await verifyApproval(0)
    })

    const complimentaryReservation = {
      guestName: 'Complimentary Test Guest',
      email: 'complimentary@example.com',
      phone: '0123456789',
      guests: 2,
      checkIn: '2027-04-10',
      checkOut: '2027-04-11',
      notes: 'Complimentary accommodation',
      originalQuotedTotal: 800,
      agreedTotal: 0,
      currency: 'ZAR'
    }

    await t.test('Complimentary manual reservation preserves original price', async () => {
      await reset()

      const bookingId = await createConfirmedReservation(
        complimentaryReservation, adminDb
      )

      const booking = (
        await getDoc(doc(adminDb, 'bookings', bookingId))
      ).data()

      assert.equal(booking.originalQuotedTotal, 800)
      assert.equal(booking.agreedTotal, 0)
      assert.equal(booking.currency, 'ZAR')

      await deleteConfirmedReservation(bookingId, adminDb)
    })

    await t.test('Negative manual reservation price rejected', async () => {
      await reset()

      await assert.rejects(
        createConfirmedReservation({
          ...complimentaryReservation,
          agreedTotal: -100
        }, adminDb)
      )
    })

    await t.test('Manual reservation preserves negotiated price', async () => {
      await reset()

      const bookingId = await createConfirmedReservation({
        guestName: 'Manual Pricing Test',
        email: 'manual@example.com',
        phone: '0123456789',
        guests: 2,
        checkIn: '2027-04-10',
        checkOut: '2027-04-13',
        notes: 'Negotiated discount',
        originalQuotedTotal: 2400,
        agreedTotal: 2000,
        currency: 'ZAR'
      }, adminDb)

      const booking = (
        await getDoc(doc(adminDb, 'bookings', bookingId))
      ).data()

      assert.equal(booking.originalQuotedTotal, 2400)
      assert.equal(booking.agreedTotal, 2000)
      assert.equal(booking.currency, 'ZAR')

      await deleteConfirmedReservation(bookingId, adminDb)
    })

  } finally {
    try {
      await env.clearFirestore()
    } finally {
      await env.cleanup()
    }
  }
})