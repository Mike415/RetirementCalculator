/**
 * GitHub Gist Cloud Sync
 * ─────────────────────
 * Uses a GitHub Personal Access Token (PAT) with the "gist" scope to
 * read/write the retirement plan as a private GitHub Gist.
 *
 * Why PAT instead of OAuth Device Flow:
 *   GitHub's Device Flow endpoints block CORS from browser origins, so
 *   Device Flow cannot work in a static web app. A PAT is the simplest
 *   and most reliable alternative for a static site.
 *
 * Setup:
 *   1. Go to https://github.com/settings/tokens/new
 *   2. Give it a name (e.g. "Retirement Planner Sync")
 *   3. Check the "gist" scope
 *   4. Copy the generated token (starts with ghp_)
 *   5. Paste it into the Cloud Sync panel in the app
 */

const GIST_FILENAME = 'retirement-plan.json';
const GIST_DESCRIPTION = 'Retirement Planner — saved plan';
const TOKEN_KEY = 'gh_gist_token';
const GIST_ID_KEY = 'gh_gist_id';

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
