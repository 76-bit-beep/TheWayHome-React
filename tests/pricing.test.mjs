import {test} from 'node:test'
import assert from 'node:assert/strict'

import {
  calculateBookingPrice
} from '../src/utils/pricing.js'

const settings = {
  nightlyRate: 400,
  minimumStay: 1,
  currency: 'ZAR'
}

const season = {
  name: 'Peak season',
  startDate: '2027-12-01',
  endDate: '2027-12-31',
  nightlyRate: 500,
  minimumStay: 1
}

const quote = (guests, nights = 1) =>
  calculateBookingPrice(
    '2027-04-10',
    `2027-04-${10 + nights}`,
    guests,
    settings
  )

test('One guest pays minimum two-person rate', () => {
  const result = quote(1)
  assert.equal(result.total, 800)
  assert.equal(result.guests, 1)
  assert.equal(result.breakdown[0].chargeableGuests, 2)
})

test('Two guests pay R800', () => {
  assert.equal(quote(2).total, 800)
})

test('Three guests pay R1200', () => {
  assert.equal(quote(3).total, 1200)
})

test('Four guests pay R1600', () => {
  assert.equal(quote(4).total, 1600)
})

test('Five guests pay R2000', () => {
  assert.equal(quote(5).total, 2000)
})

test('Three nights for two guests costs R2400', () => {
  const result = quote(2, 3)
  assert.equal(result.total, 2400)
  assert.equal(result.nights, 3)
})

test('Seasonal rate applies two-person minimum', () => {
  const result = calculateBookingPrice(
    '2027-12-10', '2027-12-11',
    1, settings, [season]
  )
  assert.equal(result.total, 1000)
})

test('Booking across standard and seasonal rates', () => {
  const result = calculateBookingPrice(
    '2027-11-30', '2027-12-02',
    2, settings, [season]
  )
  assert.equal(result.total, 1800)
  assert.equal(result.breakdown[0].total, 800)
  assert.equal(result.breakdown[1].total, 1000)
})

test('Individual date overrides longer season', () => {
  const special = {
    ...season,
    name: 'Christmas',
    startDate: '2027-12-25',
    endDate: '2027-12-25',
    nightlyRate: 600
  }

  const result = calculateBookingPrice(
    '2027-12-24', '2027-12-26',
    2, settings, [season, special]
  )
  assert.equal(result.total, 2200)
})

test('Conflicting equal-length seasons rejected', () => {
  assert.throws(() => calculateBookingPrice(
    '2027-12-10', '2027-12-11',
    2, settings, [
      season,
      {...season, name: 'Conflict', nightlyRate: 700}
    ]
  ), /Conflicting pricing/)
})

test('Single-night seasonal booking ignores historical minimum stay', () => {
  const result = calculateBookingPrice(
    '2027-12-10', '2027-12-11',
    2, settings, [{...season, minimumStay: 3}]
  )
  assert.equal(result.minimumStay, 1)
  assert.equal(result.meetsMinimumStay, true)
})

test('Multiple-night seasonal booking remains valid', () => {
  const result = calculateBookingPrice(
    '2027-12-10', '2027-12-13',
    2, settings, [{...season, minimumStay: 3}]
  )
  assert.equal(result.meetsMinimumStay, true)
  assert.equal(result.total, 3000)
})

test('Zero guests rejected', () => {
  assert.throws(() => quote(0), /1 to 5 guests/)
})

test('Six guests rejected', () => {
  assert.throws(() => quote(6), /1 to 5 guests/)
})

test('Fractional guest count rejected', () => {
  assert.throws(() => quote(2.5), /1 to 5 guests/)
})

test('Invalid calendar date rejected', () => {
  assert.throws(() => calculateBookingPrice(
    '2027-02-30', '2027-03-02', 2
  ), /Invalid booking date/)
})

test('Same-day checkout rejected', () => {
  assert.throws(() => calculateBookingPrice(
    '2027-04-10', '2027-04-10', 2
  ), /1 to 30 nights/)
})

test('Thirty-night booking accepted', () => {
  const result = calculateBookingPrice(
    '2027-04-01', '2027-05-01', 2
  )
  assert.equal(result.nights, 30)
  assert.equal(result.total, 24000)
})

test('Booking over thirty nights rejected', () => {
  assert.throws(() => calculateBookingPrice(
    '2027-05-01', '2027-06-01', 2
  ), /1 to 30 nights/)
})

test('Currency and nightly breakdown are correct', () => {
  const result = quote(2, 3)
  assert.equal(result.currency, 'ZAR')
  assert.equal(result.breakdown.length, 3)
  assert.equal(
    result.breakdown.reduce((sum, night) => sum + night.total, 0),
    result.total
  )
  assert.deepEqual(
    result.breakdown.map(night => night.date),
    ['2027-04-10', '2027-04-11', '2027-04-12']
  )
})
test('Historical standard minimum stay is ignored', () => {
  const result = calculateBookingPrice(
    '2027-04-10', '2027-04-11',
    2, {...settings, minimumStay: 7}
  )

  assert.equal(result.minimumStay, 1)
  assert.equal(result.meetsMinimumStay, true)
  assert.equal(result.nights, 1)
  assert.equal(result.total, 800)
})

test('Single-night Christmas reservation accepted', () => {
  const result = calculateBookingPrice(
    '2027-12-25', '2027-12-26',
    1, settings, [{...season, minimumStay: 7}]
  )

  assert.equal(result.minimumStay, 1)
  assert.equal(result.meetsMinimumStay, true)
  assert.equal(result.nights, 1)
  assert.equal(result.total, 1000)
})