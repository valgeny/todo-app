/**
 * Auth headers for server-side calls to the LangGraph Agent Server.
 * Local `langgraph dev` needs none. Cloud Run → Cloud Run needs an ID token
 * whose audience is the Agent Server URL (copilot SA has roles/run.invoker).
 */

async function idTokenFromMetadata(audience: string): Promise<string | null> {
  try {
    const url =
      'http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/identity' +
      `?audience=${encodeURIComponent(audience)}`;
    const res = await fetch(url, {
      headers: { 'Metadata-Flavor': 'Google' },
      signal: AbortSignal.timeout(5_000)
    });
    if (!res.ok) return null;
    const token = (await res.text()).trim();
    return token || null;
  } catch {
    return null;
  }
}

async function idTokenFromGoogleAuth(audience: string): Promise<string | null> {
  try {
    const { GoogleAuth } = await import('google-auth-library');
    const client = await new GoogleAuth().getIdTokenClient(audience);
    const headers = await client.getRequestHeaders(audience);
    const maybeHeaders = headers as unknown as Headers;
    if (typeof maybeHeaders.get === 'function') {
      const value = maybeHeaders.get('authorization') ?? maybeHeaders.get('Authorization');
      if (value?.toLowerCase().startsWith('bearer ')) {
        return value.slice(7).trim() || null;
      }
    }
    if (typeof maybeHeaders.forEach === 'function') {
      let token: string | null = null;
      maybeHeaders.forEach((value, key) => {
        if (key.toLowerCase() === 'authorization' && value.toLowerCase().startsWith('bearer ')) {
          token = value.slice(7).trim() || null;
        }
      });
      return token;
    }
    const rec = headers as unknown as Record<string, string>;
    const value = rec.Authorization ?? rec.authorization;
    if (value?.toLowerCase().startsWith('bearer ')) {
      return value.slice(7).trim() || null;
    }
    return null;
  } catch {
    return null;
  }
}

export async function langGraphHeaders(deploymentUrl: string): Promise<Record<string, string>> {
  let host: string;
  try {
    host = new URL(deploymentUrl).hostname;
  } catch {
    return {};
  }
  if (host === 'localhost' || host === '127.0.0.1') {
    return {};
  }

  // Prefer the metadata server on Cloud Run — audience is always the service URL.
  // google-auth with user ADC mints a Google user ID token (wrong aud) which Cloud
  // Run rejects with 401 for the copilot service account path.
  const token =
    (await idTokenFromMetadata(deploymentUrl)) ?? (await idTokenFromGoogleAuth(deploymentUrl));
  if (!token) {
    throw new Error(
      `Could not mint ID token for LANGGRAPH_URL=${deploymentUrl}. ` +
        'On Cloud Run, the copilot SA must reach the metadata server; locally use ADC with ' +
        'roles/run.invoker or point LANGGRAPH_URL at localhost.'
    );
  }
  return { authorization: `Bearer ${token}` };
}
