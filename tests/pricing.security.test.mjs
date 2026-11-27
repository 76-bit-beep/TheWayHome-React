import {test} from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'

import {
  initializeTestEnvironment,
  assertSucceeds,
  assertFails
} from '@firebase/rules-unit-testing'

import {
  doc,
  setDoc,
  getDoc,
  deleteDoc
} from 'firebase/firestore'

import {
  verifyBookingPrice
} from '../src/utils/availabilityFirestore.js'

const projectId = 'demo-thewayhome'
const adminUid = 'qCMUIllRSgRmTucv7Tlqz5PJ3gl2'

const settings = {
  nightlyRate: 400,
  minimumStay: 1,
  currency: 'ZAR'
}

const request = {
  checkIn: '2027-04-10',
  checkOut: '2027-04-11',
  guests: 2,
  quotedTotal: 800,
  currency: 'ZAR'
}

test('Pricing security and verification', async (t) => {
  const env = await initializeTestEnvironment({
    projectId,
    firestore: {
      host: '127.0.0.1',
      port: 8081,
      rules: readFileSync('firestore.rules', 'utf8')
    }
  })

  try {
    await env.clearFirestore()

    const adminDb =
      env.authenticatedContext(adminUid).firestore()

    const guestDb =
      env.unauthenticatedContext().firestore()

    const unauthorizedDb =
      env.authenticatedContext('unauthorized-user').firestore()

    const pricingRef = database =>
      doc(database, 'pricingSettings', 'default')

    await t.test('Administrator can set standard rates', async () => {
      await assertSucceeds(
        setDoc(pricingRef(adminDb), settings)
      )
    })

    await t.test('Variable standard minimum stay rejected', async () => {
      await assertFails(
        setDoc(pricingRef(adminDb), {
          ...settings,
          minimumStay: 3
        })
      )

      const snapshot = await getDoc(pricingRef(adminDb))
      assert.equal(snapshot.data().minimumStay, 1)
    })

    await t.test('Variable seasonal minimum stay rejected', async () => {
      const ref = doc(
        adminDb, 'seasonalPricing', 'invalid-minimum'
      )

      await assertFails(
        setDoc(ref, {
          name: 'Invalid minimum stay',
          startDate: '2027-12-01',
          endDate: '2027-12-31',
          nightlyRate: 500,
          minimumStay: 3
        })
      )

      const snapshot = await getDoc(ref)
      assert.equal(snapshot.exists(), false)
    })

    await t.test('Customers can read standard rates', async () => {
      const snapshot = await assertSucceeds(
        getDoc(pricingRef(guestDb))
      )
      assert.equal(snapshot.data().nightlyRate, 400)
    })

    await t.test('Customers cannot change standard rates', async () => {
      await assertFails(
        setDoc(pricingRef(guestDb), {
          ...settings,
          nightlyRate: 1
        })
      )
    })

    await t.test('Unauthorized accounts cannot change rates', async () => {
      await assertFails(
        setDoc(pricingRef(unauthorizedDb), {
          ...settings,
          nightlyRate: 1
        })
      )
    })

    await t.test('Correct original booking price verified', async () => {
      const result = await verifyBookingPrice(request, adminDb)

      assert.equal(result.originalQuote, 800)
      assert.equal(result.currentTotal, 800)
      assert.equal(result.priceChanged, false)
    })

    await t.test('Manipulated booking price detected', async () => {
      const result = await verifyBookingPrice({
        ...request,
        quotedTotal: 1
      }, adminDb)

      assert.equal(result.currentTotal, 800)
      assert.equal(result.priceChanged, true)
      assert.equal(result.difference, 799)
    })

    await t.test('Unauthorized seasonal pricing changes rejected', async () => {
      const season = {
        name: 'Test season',
        startDate: '2027-04-01',
        endDate: '2027-04-30',
        nightlyRate: 500,
        minimumStay: 1
      }

      await assertSucceeds(
        setDoc(doc(adminDb, 'seasonalPricing', 'test-season'), season)
      )

      for (const database of [guestDb, unauthorizedDb]) {
        const ref = doc(database, 'seasonalPricing', 'test-season')

        await assertFails(
          setDoc(ref, {...season, nightlyRate: 1})
        )

        await assertFails(deleteDoc(ref))
      }

      await assertSucceeds(
        deleteDoc(doc(adminDb, 'seasonalPricing', 'test-season'))
      )
    })

    await t.test('Legitimate rate changes preserve original quote', async () => {
      await assertSucceeds(
        setDoc(pricingRef(adminDb), {
          ...settings,
          nightlyRate: 500
        })
      )

      const result = await verifyBookingPrice(request, adminDb)

      assert.equal(result.originalQuote, 800)
      assert.equal(result.currentTotal, 1000)
      assert.equal(result.priceChanged, true)
      assert.equal(result.difference, 200)
    })

  } finally {
    try {
      await env.clearFirestore()
    } finally {
      await env.cleanup()
    }
  }
})