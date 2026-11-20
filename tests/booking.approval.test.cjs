
const {
  initializeTestEnvironment,
  assertSucceeds,
  assertFails
} = require('@firebase/rules-unit-testing')

const {
  collection,
  doc,
  addDoc,
  getDoc,
  updateDoc,
  runTransaction,
  serverTimestamp
} = require('firebase/firestore')

const fs = require('node:fs')
const {test} = require('node:test')
const assert = require('node:assert/strict')

// =====================================================
// 1. TEST CONFIGURATION
// =====================================================

const projectId = 'thewayhome-f20bd'
const adminUid = 'qCMUIllRSgRmTucv7Tlqz5PJ3gl2'

// IMPORTANT:
// These tests use the isolated Firestore Emulator
// on port 8081, NOT the main emulator on port 8080.

const requestData = (overrides = {}) => ({
  guestName:'Approval Test Customer',
  email:'approval-test@example.com',
  phone:'0123456789',
  guests:2,
  checkIn:'2027-03-10',
  checkOut:'2027-03-13',
  notes:'Isolated approval test',
  status:'pending',
  createdAt:serverTimestamp(),
  ...overrides
})

// =====================================================
// 2. BOOKING APPROVAL TEST SUITE
// =====================================================

test('Customer booking approval workflow',async (t) => {
  const env = await initializeTestEnvironment({
    projectId,
    firestore:{
      host:'127.0.0.1',
      port:8081,
      rules:fs.readFileSync('firestore.rules','utf8')
    }
  })

  try {
    // Clears ONLY the isolated emulator on port 8081.
    await env.clearFirestore()

    const guestDb = env.unauthenticatedContext().firestore()

    const adminDb = env.authenticatedContext(
      adminUid
    ).firestore()

    // =====================================================
    // TEST 1: ADMINISTRATOR DECLINES A REQUEST
    // =====================================================

    await t.test(
      'Administrator can decline a pending request',
      async () => {
        const requestRef = await assertSucceeds(
          addDoc(
            collection(guestDb,'bookingRequests'),
            requestData()
          )
        )

        const adminRequestRef = doc(
          adminDb,
          'bookingRequests',
          requestRef.id
        )

        await assertSucceeds(
          updateDoc(adminRequestRef,{
            status:'declined'
          })
        )

        const declinedRequest = await getDoc(
          adminRequestRef
        )

        assert.equal(
          declinedRequest.data().status,
          'declined'
        )

        assert.equal(
          declinedRequest.data().bookingId,
          undefined
        )
      }
    )

    // =====================================================
    // TEST 2: CUSTOMERS CANNOT APPROVE REQUESTS
    // =====================================================

    await t.test(
      'Customers cannot accept their own requests',
      async () => {
        const requestRef = await assertSucceeds(
          addDoc(
            collection(guestDb,'bookingRequests'),
            requestData({
              checkIn:'2027-04-01',
              checkOut:'2027-04-03'
            })
          )
        )

        await assertFails(
          updateDoc(requestRef,{
            status:'accepted',
            bookingId:'unauthorized-booking'
          })
        )

        const adminRequestRef = doc(
          adminDb,
          'bookingRequests',
          requestRef.id
        )

        const savedRequest = await getDoc(
          adminRequestRef
        )

        assert.equal(
          savedRequest.data().status,
          'pending'
        )
      }
    )

    // =====================================================
    // TEST 3: ADMINISTRATOR ACCEPTS A REQUEST
    // =====================================================

    await t.test(
      'Administrator can atomically accept a request',
      async () => {
        const requestRef = await assertSucceeds(
          addDoc(
            collection(guestDb,'bookingRequests'),
            requestData({
              checkIn:'2027-05-10',
              checkOut:'2027-05-12'
            })
          )
        )

        const adminRequestRef = doc(
          adminDb,
          'bookingRequests',
          requestRef.id
        )

        const bookingRef = doc(
          collection(adminDb,'bookings')
        )

        const nightRefs = [
          doc(
            adminDb,
            'publicAvailability',
            '2027-05-10'
          ),
          doc(
            adminDb,
            'publicAvailability',
            '2027-05-11'
          )
        ]

        await assertSucceeds(
          runTransaction(
            adminDb,
            async (transaction) => {
              // Read customer request.
              const requestSnapshot =
                await transaction.get(adminRequestRef)

              assert.equal(
                requestSnapshot.exists(),
                true
              )

              const request = requestSnapshot.data()

              assert.equal(
                request.status,
                'pending'
              )

              // Read all availability documents
              // before performing any writes.
              for (const nightRef of nightRefs) {
                const snapshot =
                  await transaction.get(nightRef)

                assert.equal(
                  snapshot.exists(),
                  false
                )
              }

              // Create confirmed reservation.
              transaction.set(bookingRef,{
                guestName:request.guestName,
                email:request.email,
                phone:request.phone,
                guests:request.guests,
                checkIn:request.checkIn,
                checkOut:request.checkOut,
                notes:request.notes,
                status:'confirmed',
                source:'request',
                requestId:requestRef.id,
                createdAt:serverTimestamp()
              })

              // Block reserved nights.
              nightRefs.forEach((nightRef) => {
                transaction.set(nightRef,{
                  bookingId:bookingRef.id,
                  status:'confirmed'
                })
              })

              // Accept original customer request.
              transaction.update(adminRequestRef,{
                status:'accepted',
                bookingId:bookingRef.id
              })
            }
          )
        )

        // Verify confirmed booking.
        const booking = await getDoc(
          bookingRef
        )

        assert.equal(
          booking.exists(),
          true
        )

        assert.equal(
          booking.data().status,
          'confirmed'
        )

        assert.equal(
          booking.data().source,
          'request'
        )

        assert.equal(
          booking.data().requestId,
          requestRef.id
        )

        // Verify original request.
        const acceptedRequest = await getDoc(
          adminRequestRef
        )

        assert.equal(
          acceptedRequest.data().status,
          'accepted'
        )

        assert.equal(
          acceptedRequest.data().bookingId,
          bookingRef.id
        )

        // Verify both nights are blocked.
        for (const nightRef of nightRefs) {
          const availability = await getDoc(
            nightRef
          )

          assert.equal(
            availability.exists(),
            true
          )

          assert.equal(
            availability.data().status,
            'confirmed'
          )

          assert.equal(
            availability.data().bookingId,
            bookingRef.id
          )
        }
      }
    )

    // =====================================================
    // TEST 4: PREVENT OVERLAPPING BOOKINGS
    // =====================================================

    await t.test(
      'Overlapping booking requests cannot be accepted',
      async () => {
        const requestRef = await assertSucceeds(
          addDoc(
            collection(guestDb,'bookingRequests'),
            requestData({
              checkIn:'2027-05-11',
              checkOut:'2027-05-13'
            })
          )
        )

        const adminRequestRef = doc(
          adminDb,
          'bookingRequests',
          requestRef.id
        )

        const conflictingNightRef = doc(
          adminDb,
          'publicAvailability',
          '2027-05-11'
        )

        const overlappingBookingRef = doc(
          collection(adminDb,'bookings')
        )

        await assert.rejects(
          runTransaction(
            adminDb,
            async (transaction) => {
              const requestSnapshot =
                await transaction.get(adminRequestRef)

              const nightSnapshot =
                await transaction.get(conflictingNightRef)

              if (nightSnapshot.exists()) {
                throw new Error(
                  'Date is already booked'
                )
              }

              const request = requestSnapshot.data()

              transaction.set(overlappingBookingRef,{
                guestName:request.guestName,
                email:request.email,
                phone:request.phone,
                guests:request.guests,
                checkIn:request.checkIn,
                checkOut:request.checkOut,
                notes:request.notes,
                status:'confirmed',
                source:'request',
                requestId:requestRef.id,
                createdAt:serverTimestamp()
              })

              transaction.set(conflictingNightRef,{
                bookingId:overlappingBookingRef.id,
                status:'confirmed'
              })

              transaction.update(adminRequestRef,{
                status:'accepted',
                bookingId:overlappingBookingRef.id
              })
            }
          ),
          /Date is already booked/
        )

        // Verify request remains pending.
        const savedRequest = await getDoc(
          adminRequestRef
        )

        assert.equal(
          savedRequest.data().status,
          'pending'
        )

        // Verify overlapping booking was not created.
        const overlappingBooking = await getDoc(
          overlappingBookingRef
        )

        assert.equal(
          overlappingBooking.exists(),
          false
        )
      }
    )

    // =====================================================
    // TEST 5: DECLINED REQUEST CANNOT BE REAPPROVED
    // =====================================================

    await t.test(
      'Declined requests cannot be processed again',
      async () => {
        const requestRef = await assertSucceeds(
          addDoc(
            collection(guestDb,'bookingRequests'),
            requestData({
              checkIn:'2027-06-01',
              checkOut:'2027-06-03'
            })
          )
        )

        const adminRequestRef = doc(
          adminDb,
          'bookingRequests',
          requestRef.id
        )

        await assertSucceeds(
          updateDoc(adminRequestRef,{
            status:'declined'
          })
        )

        await assertFails(
          updateDoc(adminRequestRef,{
            status:'pending'
          })
        )

        const savedRequest = await getDoc(
          adminRequestRef
        )

        assert.equal(
          savedRequest.data().status,
          'declined'
        )
      }
    )

  } finally {
    await env.cleanup()
  }
})
