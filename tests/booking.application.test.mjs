
import {test} from 'node:test'
import assert from 'node:assert/strict'

import {initializeApp,deleteApp} from 'firebase/app'

import {
  getAuth,
  connectAuthEmulator,
  signInWithEmailAndPassword
} from 'firebase/auth'

import {
  getFirestore,
  connectFirestoreEmulator,
  doc,
  getDoc
} from 'firebase/firestore'

import {
  createConfirmedReservation,
  deleteConfirmedReservation
} from '../src/utils/availabilityFirestore.js'

// =====================================================
// LOCAL FIREBASE EMULATOR CONFIGURATION
// =====================================================

const projectId = 'thewayhome-f20bd'
const adminUid = 'qCMUIllRSgRmTucv7Tlqz5PJ3gl2'

const app = initializeApp({
  projectId,
  apiKey:'test-api-key',
  appId:'booking-application-test'
},'booking-application-test')

const auth = getAuth(app)

connectAuthEmulator(
  auth,
  'http://127.0.0.1:9099',
  {disableWarnings:true}
)

const db = getFirestore(app)

connectFirestoreEmulator(
  db,
  '127.0.0.1',
  8080
)

// =====================================================
// TEST RESERVATION DATA
// =====================================================

const reservation = {
  guestName:'Application Test Guest',
  email:'test@example.com',
  phone:'0123456789',
  guests:2,
  checkIn:'2027-04-10',
  checkOut:'2027-04-12',
  notes:'Local emulator test'
}

// =====================================================
// HELPER: VERIFY DATES ARE AVAILABLE
// =====================================================

const verifyDatesReleased = async () => {
  const firstNight = await getDoc(
    doc(db,'publicAvailability','2027-04-10')
  )

  const secondNight = await getDoc(
    doc(db,'publicAvailability','2027-04-11')
  )

  assert.equal(firstNight.exists(),false)
  assert.equal(secondNight.exists(),false)
}

// =====================================================
// APPLICATION BOOKING TESTS
// =====================================================

test('Application booking transactions',async (t) => {
  let bookingId
  let replacementBookingId

  try {
    // =====================================================
    // AUTHENTICATE LOCAL ADMINISTRATOR
    // =====================================================

    const credential = await signInWithEmailAndPassword(
      auth,
      'booking-admin-local@example.com',
      'LocalTestPassword123!'
    )

    assert.equal(credential.user.uid,adminUid)

    console.log(
      'Local administrator authenticated:',
      credential.user.uid
    )

    // =====================================================
    // TEST 1: CREATE CONFIRMED RESERVATION
    // =====================================================

    await t.test('Application creates confirmed reservation',async () => {
      bookingId = await createConfirmedReservation(
        reservation,
        db
      )

      assert.ok(bookingId)

      const booking = await getDoc(
        doc(db,'bookings',bookingId)
      )

      const firstNight = await getDoc(
        doc(db,'publicAvailability','2027-04-10')
      )

      const secondNight = await getDoc(
        doc(db,'publicAvailability','2027-04-11')
      )

      assert.equal(booking.exists(),true)
      assert.equal(booking.data().status,'confirmed')
      assert.equal(firstNight.data().bookingId,bookingId)
      assert.equal(secondNight.data().bookingId,bookingId)
    })

    // =====================================================
    // TEST 2: PREVENT OVERLAPPING BOOKINGS
    // =====================================================

    await t.test('Application rejects overlapping reservation',async () => {
      assert.ok(bookingId)

      await assert.rejects(
        createConfirmedReservation({
          ...reservation,
          guestName:'Overlapping Test Guest',
          checkIn:'2027-04-11',
          checkOut:'2027-04-13'
        },db),
        /already booked/i
      )

      const unoccupiedNight = await getDoc(
        doc(db,'publicAvailability','2027-04-12')
      )

      assert.equal(unoccupiedNight.exists(),false)
    })

    // =====================================================
    // TEST 3: MAXIMUM BOOKING DURATION
    // =====================================================

    await t.test('Application rejects stays over 30 nights',async () => {
      await assert.rejects(
        createConfirmedReservation({
          ...reservation,
          checkIn:'2027-05-01',
          checkOut:'2027-06-01'
        },db),
        /Maximum booking duration is 30 nights/i
      )
    })

    // =====================================================
    // TEST 4: DELETE CONFIRMED RESERVATION
    // =====================================================

    await t.test('Application deletes confirmed reservation',async () => {
      assert.ok(bookingId)

      await deleteConfirmedReservation(bookingId,db)

      const booking = await getDoc(
        doc(db,'bookings',bookingId)
      )

      assert.equal(booking.exists(),false)

      await verifyDatesReleased()

      bookingId = undefined
    })

    // =====================================================
    // TEST 5: REBOOK RELEASED DATES
    // =====================================================

    await t.test('Application can rebook released dates',async () => {
      replacementBookingId = await createConfirmedReservation({
        ...reservation,
        guestName:'Replacement Test Guest'
      },db)

      assert.ok(replacementBookingId)
      assert.notEqual(replacementBookingId,bookingId)

      const booking = await getDoc(
        doc(db,'bookings',replacementBookingId)
      )

      const firstNight = await getDoc(
        doc(db,'publicAvailability','2027-04-10')
      )

      const secondNight = await getDoc(
        doc(db,'publicAvailability','2027-04-11')
      )

      assert.equal(booking.exists(),true)
      assert.equal(firstNight.data().bookingId,replacementBookingId)
      assert.equal(secondNight.data().bookingId,replacementBookingId)
    })

  } finally {
    // =====================================================
    // AUTOMATIC CLEANUP
    // =====================================================

    try {
      if (replacementBookingId) {
        await deleteConfirmedReservation(
          replacementBookingId,
          db
        )

        console.log('Replacement test reservation removed')
      }

      if (bookingId) {
        await deleteConfirmedReservation(
          bookingId,
          db
        )

        console.log('Original test reservation removed')
      }

      if (auth.currentUser) {
        await verifyDatesReleased()
        console.log('Test dates released successfully')
      }

    } finally {
      await deleteApp(app)
    }
  }
})
