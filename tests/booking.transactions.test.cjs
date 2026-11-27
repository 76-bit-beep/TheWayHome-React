
const {
  initializeTestEnvironment
} = require('@firebase/rules-unit-testing')

const {
  doc,
  getDoc,
  runTransaction,
  serverTimestamp
} = require('firebase/firestore')

const fs = require('node:fs')
const {test} = require('node:test')
const assert = require('node:assert/strict')

const projectId = 'demo-thewayhome'
const adminUid = 'qCMUIllRSgRmTucv7Tlqz5PJ3gl2'

test('Booking transaction tests', async (t) => {
  const env = await initializeTestEnvironment({
    projectId,
    firestore:{
      host:'127.0.0.1',
      port:8081,
      rules:fs.readFileSync('firestore.rules','utf8')
    }
  })

  try {
    // Reset local emulator test data.
    await env.clearFirestore()

    const db = env.authenticatedContext(adminUid).firestore()

    const firstBookingId = 'transaction-test-booking'
    const secondBookingId = 'transaction-overlap-booking'
    const night = '2027-03-10'

    // =====================================================
    // TEST 1: CREATE CONFIRMED RESERVATION
    // =====================================================

    await t.test('Transaction creates a confirmed booking', async () => {
      await runTransaction(db,async (transaction) => {
        const nightRef = doc(db,'publicAvailability',night)
        const snapshot = await transaction.get(nightRef)

        assert.equal(snapshot.exists(),false)

        transaction.set(doc(db,'bookings',firstBookingId),{
          guestName:'First Test Guest',
          guests:2,
          checkIn:'2027-03-10',
          checkOut:'2027-03-11',
          status:'confirmed',
          source:'manual',
          createdAt:serverTimestamp()
        })

        transaction.set(nightRef,{
          bookingId:firstBookingId,
          status:'confirmed'
        })
      })

      const booking = await getDoc(
        doc(db,'bookings',firstBookingId)
      )

      const availability = await getDoc(
        doc(db,'publicAvailability',night)
      )

      assert.equal(booking.exists(),true)
      assert.equal(availability.exists(),true)
      assert.equal(availability.data().bookingId,firstBookingId)
    })

    // =====================================================
    // TEST 2: PREVENT OVERLAPPING RESERVATIONS
    // =====================================================

    await t.test('Overlapping reservation is rejected', async () => {
      await assert.rejects(
        runTransaction(db,async (transaction) => {
          const nightRef = doc(db,'publicAvailability',night)
          const snapshot = await transaction.get(nightRef)

          if (snapshot.exists()) {
            throw new Error('Date is already booked')
          }

          transaction.set(doc(db,'bookings',secondBookingId),{
            guestName:'Second Test Guest',
            guests:3,
            checkIn:'2027-03-10',
            checkOut:'2027-03-11',
            status:'confirmed',
            source:'manual',
            createdAt:serverTimestamp()
          })

          transaction.set(nightRef,{
            bookingId:secondBookingId,
            status:'confirmed'
          })
        }),
        /Date is already booked/
      )

      // Verify the original booking still owns the night.
      const availability = await getDoc(
        doc(db,'publicAvailability',night)
      )

      assert.equal(availability.exists(),true)
      assert.equal(availability.data().bookingId,firstBookingId)

      // Verify the rejected booking was not created.
      const rejectedBooking = await getDoc(
        doc(db,'bookings',secondBookingId)
      )

      assert.equal(rejectedBooking.exists(),false)
    })

    // =====================================================
    // TEST 3: DELETE CONFIRMED RESERVATION
    // =====================================================

    await t.test('Deleting a reservation releases its night', async () => {
      await runTransaction(db,async (transaction) => {
        const bookingRef = doc(db,'bookings',firstBookingId)
        const nightRef = doc(db,'publicAvailability',night)

        // Read both documents before writing.
        const booking = await transaction.get(bookingRef)
        const availability = await transaction.get(nightRef)

        assert.equal(booking.exists(),true)
        assert.equal(availability.exists(),true)
        assert.equal(availability.data().bookingId,firstBookingId)

        transaction.delete(bookingRef)
        transaction.delete(nightRef)
      })

      const booking = await getDoc(
        doc(db,'bookings',firstBookingId)
      )

      const availability = await getDoc(
        doc(db,'publicAvailability',night)
      )

      assert.equal(booking.exists(),false)
      assert.equal(availability.exists(),false)
    })

    // =====================================================
    // TEST 4: REBOOK RELEASED NIGHT
    // =====================================================

    await t.test('Released night can be booked again', async () => {
      await runTransaction(db,async (transaction) => {
        const nightRef = doc(db,'publicAvailability',night)
        const snapshot = await transaction.get(nightRef)

        assert.equal(snapshot.exists(),false)

        transaction.set(doc(db,'bookings',secondBookingId),{
          guestName:'New Test Guest',
          guests:2,
          checkIn:'2027-03-10',
          checkOut:'2027-03-11',
          status:'confirmed',
          source:'manual',
          createdAt:serverTimestamp()
        })

        transaction.set(nightRef,{
          bookingId:secondBookingId,
          status:'confirmed'
        })
      })

      const booking = await getDoc(
        doc(db,'bookings',secondBookingId)
      )

      const availability = await getDoc(
        doc(db,'publicAvailability',night)
      )

      assert.equal(booking.exists(),true)
      assert.equal(availability.exists(),true)
      assert.equal(availability.data().bookingId,secondBookingId)
    })

  } finally {
    await env.cleanup()
  }
})
