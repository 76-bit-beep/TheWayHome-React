
const {
  initializeTestEnvironment,
  assertSucceeds,
  assertFails
} = require('@firebase/rules-unit-testing')

const {
  doc,
  getDoc,
  setDoc,
  deleteDoc,
  writeBatch,
  serverTimestamp
} = require('firebase/firestore')

const fs = require('node:fs')
const {test} = require('node:test')
const assert = require('node:assert/strict')

const projectId = 'thewayhome-f20bd'
const adminUid = 'qCMUIllRSgRmTucv7Tlqz5PJ3gl2'

// =====================================================
// BOOKING TEST DATA HELPER
// =====================================================

const bookingData = (checkIn,checkOut) => ({
  guestName:'Security Test Guest',
  guests:2,
  checkIn,
  checkOut,
  status:'confirmed',
  source:'manual',
  createdAt:serverTimestamp()
})

// =====================================================
// FIRESTORE SECURITY TESTS
// =====================================================

test('Firestore booking security',async (t) => {
  const env = await initializeTestEnvironment({
    projectId,
    firestore:{
      host:'127.0.0.1',
      port:8080,
      rules:fs.readFileSync('firestore.rules','utf8')
    }
  })

  try {
    // LOCAL EMULATOR ONLY
    await env.clearFirestore()

    const guestDb = env.unauthenticatedContext().firestore()
    const adminDb = env.authenticatedContext(adminUid).firestore()

    // =====================================================
    // TEST 1: PRIVATE BOOKING ACCESS
    // =====================================================

    await t.test('Guests cannot read private bookings',async () => {
      await assertFails(
        getDoc(doc(guestDb,'bookings','test-booking'))
      )
    })

    // =====================================================
    // TEST 2: PUBLIC AVAILABILITY ACCESS
    // =====================================================

    await t.test('Guests can read public availability',async () => {
      await assertSucceeds(
        getDoc(doc(guestDb,'publicAvailability','2026-12-10'))
      )
    })

    // =====================================================
    // TEST 3: GUEST CANNOT BLOCK DATES
    // =====================================================

    await t.test('Guests cannot block dates',async () => {
      await assertFails(
        setDoc(
          doc(guestDb,'publicAvailability','2026-12-10'),
          {
            bookingId:'fake-booking',
            status:'confirmed'
          }
        )
      )
    })

    // =====================================================
    // TEST 4: ADMIN CANNOT BLOCK WITHOUT BOOKING
    // =====================================================

    await t.test('Admin cannot block dates without a matching booking',async () => {
      await assertFails(
        setDoc(
          doc(adminDb,'publicAvailability','2026-12-11'),
          {
            bookingId:'test-booking',
            status:'confirmed'
          }
        )
      )
    })

    // =====================================================
    // TEST 5: VALID BOOKING WITH BLOCKED DATE
    // =====================================================

    await t.test('Admin can create a booking with matching blocked date',async () => {
      const bookingId = 'valid-test-booking'
      const batch = writeBatch(adminDb)

      batch.set(
        doc(adminDb,'bookings',bookingId),
        bookingData('2026-12-15','2026-12-16')
      )

      batch.set(
        doc(adminDb,'publicAvailability','2026-12-15'),
        {
          bookingId,
          status:'confirmed'
        }
      )

      await assertSucceeds(batch.commit())

      const bookingSnapshot = await assertSucceeds(
        getDoc(doc(adminDb,'bookings',bookingId))
      )

      assert.equal(bookingSnapshot.exists(),true)

      const availabilitySnapshot = await assertSucceeds(
        getDoc(doc(guestDb,'publicAvailability','2026-12-15'))
      )

      assert.equal(availabilitySnapshot.exists(),true)
      assert.equal(availabilitySnapshot.data().bookingId,bookingId)
    })

    // =====================================================
    // TEST 6: OVERLAPPING BOOKINGS
    // =====================================================

    await t.test('Overlapping reservation cannot overwrite a booked night',async () => {
      const existingBookingId = 'overlap-original-booking'
      const conflictingBookingId = 'overlap-second-booking'
      const occupiedNight = '2027-02-10'

      const firstBatch = writeBatch(adminDb)

      firstBatch.set(
        doc(adminDb,'bookings',existingBookingId),
        bookingData('2027-02-10','2027-02-11')
      )

      firstBatch.set(
        doc(adminDb,'publicAvailability',occupiedNight),
        {
          bookingId:existingBookingId,
          status:'confirmed'
        }
      )

      await assertSucceeds(firstBatch.commit())

      const secondBatch = writeBatch(adminDb)

      secondBatch.set(
        doc(adminDb,'bookings',conflictingBookingId),
        bookingData('2027-02-10','2027-02-11')
      )

      secondBatch.set(
        doc(adminDb,'publicAvailability',occupiedNight),
        {
          bookingId:conflictingBookingId,
          status:'confirmed'
        }
      )

      await assertFails(secondBatch.commit())

      const availabilitySnapshot = await assertSucceeds(
        getDoc(doc(adminDb,'publicAvailability',occupiedNight))
      )

      assert.equal(availabilitySnapshot.exists(),true)
      assert.equal(
        availabilitySnapshot.data().bookingId,
        existingBookingId
      )

      const rejectedBookingSnapshot = await assertSucceeds(
        getDoc(doc(adminDb,'bookings',conflictingBookingId))
      )

      assert.equal(rejectedBookingSnapshot.exists(),false)
    })

    // =====================================================
    // TEST 7: REJECT BOOKINGS LONGER THAN 30 NIGHTS
    // =====================================================

    await t.test('Admin cannot create bookings over 30 nights',async () => {
      await assertFails(
        setDoc(
          doc(adminDb,'bookings','overlong-test-booking'),
          bookingData('2027-05-01','2027-06-01')
        )
      )
    })

    // =====================================================
    // TEST 8: PREVENT ORPHANED AVAILABILITY
    // =====================================================

    await t.test('Admin cannot delete booking without releasing dates',async () => {
      const bookingId = 'orphan-protection-booking'
      const occupiedNight = '2027-07-10'

      const batch = writeBatch(adminDb)

      batch.set(
        doc(adminDb,'bookings',bookingId),
        bookingData('2027-07-10','2027-07-11')
      )

      batch.set(
        doc(adminDb,'publicAvailability',occupiedNight),
        {
          bookingId,
          status:'confirmed'
        }
      )

      await assertSucceeds(batch.commit())

      await assertFails(
        deleteDoc(doc(adminDb,'bookings',bookingId))
      )

      const bookingSnapshot = await assertSucceeds(
        getDoc(doc(adminDb,'bookings',bookingId))
      )

      assert.equal(bookingSnapshot.exists(),true)
    })

    // =====================================================
    // TEST 9: PREVENT INDEPENDENT DATE RELEASE
    // =====================================================

    await t.test('Admin cannot release dates while booking remains',async () => {
      const bookingId = 'early-release-protection-booking'
      const occupiedNight = '2027-08-10'

      const batch = writeBatch(adminDb)

      batch.set(
        doc(adminDb,'bookings',bookingId),
        bookingData('2027-08-10','2027-08-11')
      )

      batch.set(
        doc(adminDb,'publicAvailability',occupiedNight),
        {
          bookingId,
          status:'confirmed'
        }
      )

      await assertSucceeds(batch.commit())

      await assertFails(
        deleteDoc(
          doc(adminDb,'publicAvailability',occupiedNight)
        )
      )

      const availabilitySnapshot = await assertSucceeds(
        getDoc(doc(adminDb,'publicAvailability',occupiedNight))
      )

      assert.equal(availabilitySnapshot.exists(),true)
      assert.equal(availabilitySnapshot.data().bookingId,bookingId)
    })

  } finally {
    await env.cleanup()
  }
})
