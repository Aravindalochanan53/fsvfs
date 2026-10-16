export async function readApiResponse(response) {
  const text = await response.text();
  if (response.status === 204 && !text) return {};
  try {
    const data = JSON.parse(text);
    if (data !== null && typeof data === 'object') return data;
  } catch { /* Never treat an HTML error/SPA page as API success. */ }

  let message;
  if (text.includes('FUNCTION_INVOCATION_FAILED')) {
    message = 'The Vercel backend failed to start. Check backend Runtime Logs and production environment settings; this is not an invalid-password error.';
  } else if (response.ok) {
    message = 'The API returned a page or invalid response instead of JSON. Check that /api routes to the backend service in Vercel.';
  } else {
    message = `The backend returned an unreadable response (HTTP ${response.status}). Check deployment Runtime Logs and backend configuration.`;
  }
  const error = new Error(message);
  error.status = response.status;
  throw error;
}
