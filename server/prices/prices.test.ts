// node --test server/prices/prices.test.ts
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { keyOf, listingOf, nextDay, nextHours, pointOf, signed } from './prices.ts'
import cron from './cron.ts'

test('a kind of an item is its number and its bonus lists', () => {
  assert.equal(keyOf({ id: 2589 }), '2589')
  assert.equal(keyOf({ id: 6567, bonus_lists: [12718] }), '6567:12718')
  assert.equal(keyOf({ id: 9806, bonus_lists: [12745, 7] }), '9806:12745.7')
})

test('the listing adds up what is on sale at one price, each price per unit, bids alone left out', () => {
  const listing = listingOf([
    { item: { id: 1 }, quantity: 20, buyout: 2000 }, // 100 each
    { item: { id: 1 }, quantity: 5, unit_price: 100 },
    { item: { id: 1 }, quantity: 1, buyout: 90 },
    { item: { id: 1 }, quantity: 3 }, // a bid, no buyout
    { item: { id: 1, bonus_lists: [12718] }, quantity: 1, buyout: 5000 },
  ])
  assert.deepEqual(listing, { '1': [[90, 1], [100, 25]], '1:12718': [[5000, 1]] })
})

test('typical is the price of the middle unit', () => {
  assert.deepEqual(pointOf([[10, 1], [20, 1], [30, 1]]), [10, 20, 3])
  assert.deepEqual(pointOf([[10, 1], [500, 9]]), [10, 500, 10])
  assert.deepEqual(pointOf([[10, 5], [500, 5]]), [10, 10, 10])
})

test('the hours keep the last 24 snapshots and a gap where a key was not on sale', () => {
  let h = nextHours(null, 'h0', { a: [[5, 1]] })
  h = nextHours(h, 'h1', { b: [[7, 2]] })
  assert.deepEqual(h, { hours: ['h0', 'h1'], keys: { a: [[5, 5, 1], null], b: [null, [7, 7, 2]] } })
  assert.equal(nextHours(h, 'h1', { b: [[7, 2]] }).hours.length, 2, 'the same snapshot twice is one hour')
  for (let i = 2; i < 30; i++) h = nextHours(h, `h${i}`, { b: [[i, 1]] })
  assert.equal(h.hours.length, 24)
  assert.equal(h.hours[0], 'h6')
  assert.equal(h.keys.a, undefined, 'a key seen in none of the 24 is gone')
  assert.deepEqual(h.keys.b.at(-1), [29, 29, 1])
})

test('the day keeps the lowest, the mean typical and count, and starts again on a new day', () => {
  let d = nextDay(null, '2026-11-21', 't1', { a: [[10, 4]] })
  d = nextDay(d, '2026-11-21', 't2', { a: [[6, 1], [20, 1]] })
  assert.deepEqual(d.keys.a, [6, 8, 3, 2])
  assert.equal(nextDay(d, '2026-11-21', 't2', { a: [[1, 1]] }), d, 'a snapshot already counted changes nothing')
  assert.deepEqual(nextDay(d, '2026-11-22', 't3', { a: [[9, 1]] }).keys, { a: [9, 9, 1, 1] })
})

test('the signature is the one of AWS Signature Version 4 (the GET example of the S3 documentation)', () => {
  const h = signed({
    method: 'GET', url: 'https://examplebucket.s3.amazonaws.com/test.txt', headers: { range: 'bytes=0-9' },
    id: 'AKIAIOSFODNN7EXAMPLE', secret: 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY', region: 'us-east-1', now: new Date('2013-05-24T00:00:00Z'),
  })
  assert.equal(h.authorization, 'AWS4-HMAC-SHA256 Credential=AKIAIOSFODNN7EXAMPLE/20130524/us-east-1/s3/aws4_request, SignedHeaders=host;range;x-amz-content-sha256;x-amz-date, Signature=f0e8bdb87c964420e857bd35b5d6ed310bd44f0170aba48dd91039c6036bdb41')
})

test('every hour the cron asks GitHub to run the Action of the prices, and without its token asks nothing', async () => {
  const real = globalThis.fetch
  const asked: Request[] = []
  globalThis.fetch = async (url, init) => (asked.push(new Request(url as string, init)), new Response(null, { status: 204 }))
  try {
    await cron.scheduled(null, { ACTIONS_TOKEN: 'actions' })
    assert.equal(asked.length, 1)
    assert.equal(asked[0]!.url, 'https://api.github.com/repos/catubba/twinmap-forever/actions/workflows/prices.yml/dispatches')
    assert.equal(asked[0]!.method, 'POST')
    assert.equal(asked[0]!.headers.get('authorization'), 'Bearer actions')
    assert.deepEqual(await asked[0]!.json(), { ref: 'main' })
    await cron.scheduled(null, {})
    assert.equal(asked.length, 1)
  } finally {
    globalThis.fetch = real
  }
})
