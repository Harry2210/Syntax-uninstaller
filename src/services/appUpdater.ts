export const CURRENT_APP_VERSION = '1.1.0';

export interface AppUpdateManifest {
  version: string;
  name?: string;
  release_date?: string;
  download_url?: string;
  changelog?: string[] | string;
  mandatory?: boolean;
}

/**
 * Hardcoded official integrated update manifest endpoint.
 * Users cannot tamper with, add, or remove this URL.
 */
export const OFFICIAL_GIST_UPDATE_URL =
  'https://gist.githubusercontent.com/Harry2210/f127c53e4ef0d3f30fc841cbf51856be/raw/syntax-version.json';

export function compareVersions(v1: string, v2: string): number {
  const clean1 = v1.replace(/^v/i, '').trim();
  const clean2 = v2.replace(/^v/i, '').trim();
  const p1 = clean1.split('.').map((n) => parseInt(n, 10) || 0);
  const p2 = clean2.split('.').map((n) => parseInt(n, 10) || 0);
  for (let i = 0; i < Math.max(p1.length, p2.length); i++) {
    const num1 = p1[i] ?? 0;
    const num2 = p2[i] ?? 0;
    if (num1 > num2) return 1;
    if (num1 < num2) return -1;
  }
  return 0;
}

export async function checkAppUpdate(): Promise<{
  hasUpdate: boolean;
  manifest?: AppUpdateManifest;
  error?: string;
}> {
  try {
    // Add cache buster query parameter so GitHub CDN always delivers the latest live manifest
    const fetchUrl = `${OFFICIAL_GIST_UPDATE_URL}?_t=${Date.now()}`;

    const res = await fetch(fetchUrl, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
      },
    });

    if (!res.ok) {
      return { hasUpdate: false, error: `HTTP ${res.status}: ${res.statusText}` };
    }

    const data: AppUpdateManifest = await res.json();
    if (!data || !data.version) {
      return { hasUpdate: false, error: 'Invalid manifest format: missing "version" field' };
    }

    const hasUpdate = compareVersions(data.version, CURRENT_APP_VERSION) > 0;
    return { hasUpdate, manifest: data };
  } catch (err: any) {
    return { hasUpdate: false, error: err?.message || String(err) };
  }
}
