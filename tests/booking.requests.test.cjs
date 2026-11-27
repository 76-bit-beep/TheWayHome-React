
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
  deleteDoc,
  setDoc,
  serverTimestamp
} = require('firebase/firestore')

const fs = require('node:fs')
const {test} = require('node:test')

const projectId = 'demo-thewayhome'
const adminUid = 'qCMUIllRSgRmTucv7Tlqz5PJ3gl2'

const withTestPricing = (data) => {
  const start = new Date(data.checkIn + 'T00:00:00Z')
  const end = new Date(data.checkOut + 'T00:00:00Z')
  const nights = (end - start) / 86400000
  const chargeableGuests = Math.max(2, data.guests)
  const nightlyRate = 400
  const nightlyTotal = nightlyRate * chargeableGuests

  return {
    ...data,
    quotedTotal: nights * nightlyTotal,
    currency: 'ZAR',
    nights,
    minimumStay: 1,
    priceBreakdown: Array.from(
      {length: Math.max(0, nights)},
      (_, i) => ({
        date: new Date(
          start.getTime() + i * 86400000
        ).toISOString().slice(0, 10),
        nightlyRate,
        guests: data.guests,
        chargeableGuests,
        total: nightlyTotal,
        season: 'Standard rate'
      })
    )
  }
}

const requestData = (overrides = {}) => withTestPricing({
  guestName:'Test Customer',
  email:'customer@example.com',
  phone:'0123456789',
  guests:2,
  checkIn:'2027-03-10',
  checkOut:'2027-03-13',
  notes:'Test booking request',
  status:'pending',
  createdAt:serverTimestamp(),
  ...overrides
})

test('Customer booking request security',async (t) => {
  const env = await initializeTestEnvironment({
    projectId,
    firestore:{
      host:'127.0.0.1',
      port:8081,
      rules:fs.readFileSync('firestore.rules','utf8')
    }
  })

  try {
    // LOCAL EMULATOR ONLY
    await env.clearFirestore()

    const guestDb = env.unauthenticatedContext().firestore()
    const adminDb = env.authenticatedContext(adminUid).firestore()

    await t.test('Customers can submit pending requests',async () => {
      await assertSucceeds(
        addDoc(collection(guestDb,'bookingRequests'),requestData())
      )
    })

    await t.test('Customers cannot read private requests',async () => {
      await assertFails(
        getDoc(doc(guestDb,'bookingRequests','private-test'))
      )
    })

    await t.test('Administrator can read booking requests',async () => {
      await assertSucceeds(
        getDoc(doc(adminDb,'bookingRequests','private-test'))
      )
    })

    await t.test('Customers cannot create confirmed requests',async () => {
      await assertFails(
        addDoc(
          collection(guestDb,'bookingRequests'),
          requestData({status:'confirmed'})
        )
      )
    })

    await t.test('Customers cannot approve requests',async () => {
      await assertFails(
        updateDoc(
          doc(guestDb,'bookingRequests','private-test'),
          {status:'confirmed'}
        )
      )
    })

    await t.test('Customers cannot delete requests',async () => {
      await assertFails(
        deleteDoc(doc(guestDb,'bookingRequests','private-test'))
      )
    })

    await t.test('Customers cannot request over 30 nights',async () => {
      await assertFails(
        addDoc(
          collection(guestDb,'bookingRequests'),
          requestData({
            checkIn:'2027-03-01',
            checkOut:'2027-04-01'
          })
        )
      )
    })

    await t.test('Customers cannot overwrite existing requests',async () => {
      const requestRef = doc(guestDb,'bookingRequests','overwrite-test')

      await assertSucceeds(
        setDoc(requestRef,requestData())
      )

      await assertFails(
        setDoc(requestRef,requestData({guestName:'Changed Guest'}))
      )
    })
  } finally {
    await env.cleanup()
  }
})
