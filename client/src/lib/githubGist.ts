/**
 * GitHub Gist Cloud Sync
 * ─────────────────────
 * Uses GitHub Device Flow OAuth (no server required) to authenticate,
 * then reads/writes the retirement plan as a private GitHub Gist.
 *
 * Device Flow:
 *   1. POST /login/device/code  → get device_code + user_code + verification_uri
 *   2. Show user_code to user, open verification_uri
 *   3. Poll /login/oauth/access_token until user approves
 *   4. Store access_token in localStorage
 *   5. Use token to read/write Gist via GitHub API
 */

const CLIENT_ID = 'Ov23lieK4mityKxMPPlN';
const GIST_FILENAME = 'retirement-plan.json';
const GIST_DESCRIPTION = 'Retirement Planner — saved plan';
const TOKEN_KEY = 'gh_gist_token';
const GIST_ID_KEY = 'gh_gist_id';

// ── Types ────────────────────────────────────────────────────────────────────

export interface DeviceCodeResponse {
  device_code: string;
  user_code: string;
  verification_uri: string;
  expires_in: number;
  interval: number;
}

export interface GistSyncState {
  status: 'idle' | 'pending_auth' | 'polling' | 'authenticated' | 'saving' | 'loading' | 'error';
  userCode?: string;
  verificationUri?: string;
  errorMessage?: string;
  username?: string;
  avatarUrl?: string;
  lastSynced?: string; // ISO timestamp
}

// ── Token storage ─────────────────────────────────────────────────────────────

export function getStoredToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setStoredToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearStoredToken(): void {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(GIST_ID_KEY);
}

export function getStoredGistId(): string | null {
  return localStorage.getItem(GIST_ID_KEY);
}

export function setStoredGistId(id: string): void {
  localStorage.setItem(GIST_ID_KEY, id);
}

// ── GitHub API helpers ────────────────────────────────────────────────────────

async function githubFetch(
  path: string,
  token: string,
  options: RequestInit = {}
): Promise<Response> {
  return fetch(`https://api.github.com${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'Content-Type': 'application/json',
      ...(options.headers ?? {}),
    },
  });
}

// ── Device Flow ───────────────────────────────────────────────────────────────

/**
 * Step 1: Request a device code from GitHub.
 * Returns the device_code (for polling), user_code (show to user),
 * verification_uri (send user to), and polling interval.
 */
export async function requestDeviceCode(): Promise<DeviceCodeResponse> {
  const res = await fetch('https://github.com/login/device/code', {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      client_id: CLIENT_ID,
      scope: 'gist',
    }),
  });

  if (!res.ok) {
    throw new Error(`Failed to request device code: ${res.status}`);
  }

  return res.json();
}

/**
 * Step 2: Poll GitHub until the user approves the device code.
 * Resolves with the access token when approved.
 * Rejects if expired or denied.
 */
export async function pollForToken(
  deviceCode: string,
  intervalSeconds: number,
  onPoll?: () => void
): Promise<string> {
  const pollInterval = Math.max(intervalSeconds, 5) * 1000;

  return new Promise((resolve, reject) => {
    const poll = async () => {
      onPoll?.();
      try {
        const res = await fetch('https://github.com/login/oauth/access_token', {
          method: 'POST',
          headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            client_id: CLIENT_ID,
            device_code: deviceCode,
            grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
          }),
        });

        const data = await res.json();

        if (data.access_token) {
          resolve(data.access_token);
          return;
        }

        switch (data.error) {
          case 'authorization_pending':
            // User hasn't approved yet — keep polling
            setTimeout(poll, pollInterval);
            break;
          case 'slow_down':
            // GitHub wants us to slow down
            setTimeout(poll, pollInterval + 5000);
            break;
          case 'expired_token':
            reject(new Error('The authorization code expired. Please try again.'));
            break;
          case 'access_denied':
            reject(new Error('Authorization was denied.'));
            break;
          default:
            reject(new Error(data.error_description ?? 'Unknown error during authorization.'));
        }
      } catch (err) {
        reject(err);
      }
    };

    setTimeout(poll, pollInterval);
  });
}

// ── User info ─────────────────────────────────────────────────────────────────

export async function getAuthenticatedUser(
  token: string
): Promise<{ login: string; avatar_url: string }> {
  const res = await githubFetch('/user', token);
  if (!res.ok) throw new Error('Failed to fetch GitHub user info');
  return res.json();
}

// ── Gist operations ───────────────────────────────────────────────────────────

/**
 * Find an existing retirement plan Gist by description and filename,
 * or return null if none exists.
 */
export async function findExistingGist(token: string): Promise<string | null> {
  // Check stored ID first (fast path)
  const storedId = getStoredGistId();
  if (storedId) {
    // Verify it still exists
    const res = await githubFetch(`/gists/${storedId}`, token);
    if (res.ok) return storedId;
    // Stored ID is stale — clear it and search
    localStorage.removeItem(GIST_ID_KEY);
  }

  // Search through user's gists for one with our filename
  let page = 1;
  while (true) {
    const res = await githubFetch(`/gists?per_page=100&page=${page}`, token);
    if (!res.ok) throw new Error('Failed to list gists');
    const gists: Array<{ id: string; description: string; files: Record<string, unknown> }> =
      await res.json();
    if (gists.length === 0) break;

    const match = gists.find(
      (g) => g.description === GIST_DESCRIPTION && GIST_FILENAME in g.files
    );
    if (match) {
      setStoredGistId(match.id);
      return match.id;
    }
    if (gists.length < 100) break;
    page++;
  }

  return null;
}

/**
 * Save the plan to a GitHub Gist.
 * Creates a new private Gist if one doesn't exist, otherwise updates it.
 */
export async function saveToGist(token: string, planData: unknown): Promise<string> {
  const content = JSON.stringify(planData, null, 2);
  const existingId = await findExistingGist(token);

  if (existingId) {
    // Update existing Gist
    const res = await githubFetch(`/gists/${existingId}`, token, {
      method: 'PATCH',
      body: JSON.stringify({
        description: GIST_DESCRIPTION,
        files: {
          [GIST_FILENAME]: { content },
        },
      }),
    });
    if (!res.ok) throw new Error(`Failed to update Gist: ${res.status}`);
    const data = await res.json();
    return data.id;
  } else {
    // Create new private Gist
    const res = await githubFetch('/gists', token, {
      method: 'POST',
      body: JSON.stringify({
        description: GIST_DESCRIPTION,
        public: false,
        files: {
          [GIST_FILENAME]: { content },
        },
      }),
    });
    if (!res.ok) throw new Error(`Failed to create Gist: ${res.status}`);
    const data = await res.json();
    setStoredGistId(data.id);
    return data.id;
  }
}

/**
 * Load the plan from the user's GitHub Gist.
 * Returns null if no Gist exists yet.
 */
export async function loadFromGist(token: string): Promise<unknown | null> {
  const gistId = await findExistingGist(token);
  if (!gistId) return null;

  const res = await githubFetch(`/gists/${gistId}`, token);
  if (!res.ok) throw new Error(`Failed to fetch Gist: ${res.status}`);

  const data = await res.json();
  const file = data.files?.[GIST_FILENAME];
  if (!file?.content) return null;

  return JSON.parse(file.content);
}
