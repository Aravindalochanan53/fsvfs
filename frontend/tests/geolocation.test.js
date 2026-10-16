import test from 'node:test';
import assert from 'node:assert/strict';
import { requestFreshPosition } from '../src/services/geolocation.js';

const fix = (overrides = {}) => ({ timestamp: Date.now(), coords: { latitude: 11.2742, longitude: 77.607, accuracy: 12 }, ...overrides });
test('returns actual coordinates and accuracy without rounding', async () => {
  const position = fix(); position.coords.accuracy = 12.45;
  const result = await requestFreshPosition({ getCurrentPosition: (ok) => ok(position) });
  assert.equal(result.accuracy, 12.45);
  assert.equal(result.lat, 11.2742);
});
test('permission denial has actionable feedback and no retry', async () => {
  let calls = 0;
  await assert.rejects(requestFreshPosition({ getCurrentPosition: (_, fail) => { calls++; fail({ code: 1 }); } }), /permission denied/i);
  assert.equal(calls, 1);
});
test('falls back to OS provider without inventing accuracy', async () => {
  let calls = 0;
  const result = await requestFreshPosition({ getCurrentPosition: (ok, fail, options) => {
    calls++;
    assert.equal(options.maximumAge, 0);
    if (options.enableHighAccuracy) fail({ code: 3 }); else ok(fix());
  } });
  assert.equal(calls, 2); assert.equal(result.accuracy, 12);
});
test('rejects stale fixes', async () => {
  await assert.rejects(requestFreshPosition({ getCurrentPosition: (ok) => ok(fix({ timestamp: Date.now() - 120000 })) }), /stale/);
});
test('rejects invalid GPS coordinates', async () => {
  await assert.rejects(requestFreshPosition({ getCurrentPosition: (ok) => ok(fix({ coords: { latitude: NaN, longitude: 77, accuracy: 10 } })) }), /invalid/);
});
test('unsupported location service is handled clearly', async () => {
  await assert.rejects(requestFreshPosition(null), /does not support/);
});
