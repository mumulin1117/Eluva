import test from 'node:test'
import assert from 'node:assert/strict'
import { ageOn, validPassword, validEmail, matchLocale, verifyCode, textLength } from '../src/domain/validation.js'

test('birthday is a full-date 18+ boundary; impossible and future dates rejected', () => {
  const day = new Date(2026, 9, 17)
  assert.equal(ageOn('2008-10-17', day), 18)
  assert.equal(ageOn('2008-10-18', day), 17)
  assert.equal(ageOn('2008-02-29', new Date(2026, 1, 28)), 17)
  assert.equal(ageOn('2008-02-29', new Date(2026, 2, 1)), 18)
  for (const value of ['2027-01-01','2008-02-30','2007-02-29','2000-00-10','']) assert.equal(ageOn(value, day), null)
})
test('confirmed password and email rules; Gmail allowed, no hidden case/special-character requirement', () => {
  assert.equal(validPassword('abcdefgh'), false)
  assert.equal(validPassword('abc1234'), false)
  assert.equal(validPassword('abcdefgh1'), true)
  assert.equal(validPassword('12345678'), true)
  assert.equal(validEmail(' Eluva@Gmail.com '), true)
  for (const value of ['a@','a@@b.com','a b@c.com','a@b..com']) assert.equal(validEmail(value), false)
})
test('only fixed code is accepted and locale follows preferred list with saved override', () => {
  assert.equal(verifyCode('567567'), true)
  for (const code of ['000000','482176','56756','5675678','']) assert.throws(() => verifyCode(code), { code: 'INVALID_VERIFICATION_CODE' })
  assert.equal(matchLocale(['de-DE','fr-CA','en-US']), 'fr')
  assert.equal(matchLocale(['fr-CA'], 'en'), 'en')
  assert.equal(matchLocale(['zh-CN']), 'en')
  assert.equal(textLength('e\u0301'), 1)
})
