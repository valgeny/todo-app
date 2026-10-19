import { GoogleAuth } from 'google-auth-library';

/**
 * Cloud Run → Cloud Run: attach an ID token when LANGGRAPH_URL is not local.
 * Local `langgraph dev` needs no auth.
 */
export async function langGraphHeaders(
  deploymentUrl: string
): Promise<Record<string, string>> {
  let host: string;
  try {
    host = new URL(deploymentUrl).hostname;
  } catch {
    return {};
  }
  if (host === 'localhost' || host === '127.0.0.1') {
    return {};
  }

  const auth = new GoogleAuth();
  const client = await auth.getIdTokenClient(deploymentUrl);
  const headers = await client.getRequestHeaders();
  const out: Record<string, string> = {};
  const maybeHeaders = headers as unknown as Headers;
  if (typeof maybeHeaders.forEach === 'function') {
    maybeHeaders.forEach((value, key) => {
      out[key] = value;
    });
    return out;
  }
  for (const [key, value] of Object.entries(headers as unknown as Record<string, unknown>)) {
    if (typeof value === 'string') out[key] = value;
  }
  return out;
}
