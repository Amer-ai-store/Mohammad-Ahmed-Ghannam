// JAWAFFASVR control panel: no credentials are stored in the public repository.
export async function checkServerHealth(baseUrl) {
  const url = new URL('/health', baseUrl);
  if (url.protocol !== 'https:') throw new Error('HTTPS required');
  const response = await fetch(url, { credentials: 'include', cache: 'no-store' });
  if (!response.ok) throw new Error('Health check failed: ' + response.status);
  return response.json();
}
