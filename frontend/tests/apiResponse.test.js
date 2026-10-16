import test from 'node:test';
import assert from 'node:assert/strict';
import { readApiResponse } from '../src/services/apiResponse.js';

test('preserves structured deployment configuration errors', async () => {
  const body = { code: 'deployment_not_configured', detail: 'SECRET_KEY must be configured' };
  assert.deepEqual(await readApiResponse(new Response(JSON.stringify(body), { status: 503 })), body);
});
test('Vercel startup failure is actionable, not an invalid-password error', async () => {
  await assert.rejects(readApiResponse(new Response('A server error has occurred\nFUNCTION_INVOCATION_FAILED', { status: 500 })),
    (error) => error.status === 500 && error.message.includes('failed to start'));
});
test('SPA HTML cannot silently count as successful login/API data', async () => {
  await assert.rejects(readApiResponse(new Response('<html>Portal</html>', { status: 200 })), /\/api routes/);
});
test('raw upstream errors do not leak credentials/HTML into user messages', async () => {
  await assert.rejects(readApiResponse(new Response('private password=hidden-secret', { status: 502 })),
    (error) => error.message.includes('HTTP 502') && !error.message.includes('hidden-secret'));
});
test('normal JSON and empty 204 responses remain supported', async () => {
  assert.deepEqual(await readApiResponse(new Response('{"success":true}')), { success: true });
  assert.deepEqual(await readApiResponse(new Response(null, { status: 204 })), {});
});
