/**
 * CloudSync Component
 * ───────────────────
 * Provides GitHub Gist cloud sync using a Personal Access Token (PAT).
 *
 * Why PAT instead of Device Flow OAuth:
 *   GitHub's Device Flow endpoints (github.com/login/device/code and
 *   github.com/login/oauth/access_token) block cross-origin requests from
 *   browsers, so Device Flow cannot work in a static web app.
 *   A PAT with the "gist" scope is the simplest, most reliable alternative.
 *
 * What gets synced:
 *   - Main plan inputs (retirement-planner-v1)
 *   - Saved scenarios (retirement-planner-scenarios-v1)
 *
 * Flow:
 *   1. User creates a GitHub PAT with "gist" scope at github.com/settings/tokens
 *   2. User pastes the token into the input field
 *   3. Token is validated by fetching /user, then stored in localStorage
 *   4. Save / Load buttons appear
 */

import { useState, useEffect, useCallback } from 'react';
import {
  Cloud, CloudDownload, CloudUpload, LogOut, Loader2,
  AlertCircle, ExternalLink, KeyRound, Eye, EyeOff,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { usePlanner } from '@/contexts/PlannerContext';
import {
  getAuthenticatedUser,
  saveToGist,
  loadFromGist,
  getStoredToken,
  setStoredToken,
  clearStoredToken,
} from '@/lib/githubGist';

// The same key used by Scenarios.tsx
const SCENARIOS_KEY = 'retirement-planner-scenarios-v1';

interface UserInfo {
  login: string;
  avatar_url: string;
}

export default function CloudSync() {
  const { inputs, importFromObject } = usePlanner();

  const [token, setToken] = useState<string | null>(() => getStoredToken());
  const [user, setUser] = useState<UserInfo | null>(null);
  const [status, setStatus] = useState<
    'idle' | 'connecting' | 'saving' | 'loading' | 'error'
  >('idle');
  const [patInput, setPatInput] = useState('');
  const [showPat, setShowPat] = useState(false);
  const [lastSynced, setLastSynced] = useState<string | null>(
    () => localStorage.getItem('gh_gist_last_synced')
  );
  const [expanded, setExpanded] = useState(false);

  // Load user info when token is available
  useEffect(() => {
    if (!token) {
      setUser(null);
      return;
    }
    getAuthenticatedUser(token)
      .then(setUser)
      .catch(() => {
        // Token is invalid or expired
        clearStoredToken();
        setToken(null);
        setUser(null);
      });
  }, [token]);

  const handleConnect = useCallback(async () => {
    const pat = patInput.trim();
    if (!pat) {
      toast.error('Please enter a Personal Access Token.');
      return;
    }
    setStatus('connecting');
    try {
      const userInfo = await getAuthenticatedUser(pat);
      setStoredToken(pat);
      setToken(pat);
      setUser(userInfo);
      setPatInput('');
      setStatus('idle');
      toast.success(`Connected as @${userInfo.login}`);
    } catch {
      setStatus('idle');
      toast.error('Invalid token or missing "gist" scope. Please check your PAT.');
    }
  }, [patInput]);

  const handleSave = useCallback(async () => {
    if (!token) return;
    setStatus('saving');
    try {
      // Read scenarios directly from localStorage so we don't need to thread
      // them through PlannerContext
      let scenarios: unknown = [];
      try {
        const raw = localStorage.getItem(SCENARIOS_KEY);
        if (raw) scenarios = JSON.parse(raw);
      } catch { /* ignore */ }

      const payload = {
        _version: 2,
        _exported: new Date().toISOString(),
        inputs,
        scenarios,
      };

      await saveToGist(token, payload);
      const now = new Date().toLocaleString();
      setLastSynced(now);
      localStorage.setItem('gh_gist_last_synced', now);
      setStatus('idle');
      toast.success('Plan saved to GitHub Gist!');
    } catch (err: unknown) {
      setStatus('idle');
      const message = err instanceof Error ? err.message : 'Save failed';
      toast.error(message);
    }
  }, [token, inputs]);

  const handleLoad = useCallback(async () => {
    if (!token) return;
    setStatus('loading');
    try {
      const data = await loadFromGist(token);
      if (!data) {
        setStatus('idle');
        toast.info('No saved plan found in your GitHub Gists.');
        return;
      }

      // Load main inputs
      const result = importFromObject(data);
      if (!result.ok) {
        setStatus('idle');
        toast.error(result.error ?? 'Failed to load plan.');
        return;
      }

      // Load scenarios if present in the payload
      const payload = data as Record<string, unknown>;
      if (Array.isArray(payload.scenarios)) {
        try {
          localStorage.setItem(SCENARIOS_KEY, JSON.stringify(payload.scenarios));
          // Force the Scenarios page to re-read by dispatching a storage event
          window.dispatchEvent(
            new StorageEvent('storage', {
              key: SCENARIOS_KEY,
              newValue: JSON.stringify(payload.scenarios),
              storageArea: localStorage,
            })
          );
        } catch { /* ignore */ }
      }

      const now = new Date().toLocaleString();
      setLastSynced(now);
      localStorage.setItem('gh_gist_last_synced', now);
      setStatus('idle');
      toast.success('Plan loaded from GitHub Gist!');
    } catch (err: unknown) {
      setStatus('idle');
      const message = err instanceof Error ? err.message : 'Load failed';
      toast.error(message);
    }
  }, [token, importFromObject]);

  const handleSignOut = useCallback(() => {
    clearStoredToken();
    setToken(null);
    setUser(null);
    setLastSynced(null);
    localStorage.removeItem('gh_gist_last_synced');
    toast.success('Signed out of GitHub.');
  }, []);

  const isBusy = status === 'saving' || status === 'loading' || status === 'connecting';

  return (
    <div className="border border-border rounded-lg overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setExpanded((e) => !e)}
        className="w-full flex items-center gap-2 px-3 py-2.5 bg-muted/50 hover:bg-muted transition-colors text-left"
      >
        <Cloud className="h-4 w-4 text-muted-foreground shrink-0" />
        <span className="text-xs font-medium text-foreground flex-1">Cloud Sync</span>
        {token && user ? (
          <span className="text-xs text-emerald-600 font-medium">● Connected</span>
        ) : (
          <span className="text-xs text-muted-foreground">GitHub Gist</span>
        )}
      </button>

      {/* Body */}
      {expanded && (
        <div className="px-3 py-3 space-y-3 bg-background">

          {/* Not connected */}
          {!token && (
            <div className="space-y-3">
              <p className="text-xs text-muted-foreground leading-relaxed">
                Save your plan to a private GitHub Gist. Create a{' '}
                <a
                  href="https://github.com/settings/tokens/new?scopes=gist&description=Retirement+Planner+Sync"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline inline-flex items-center gap-0.5"
                >
                  Personal Access Token
                  <ExternalLink className="h-2.5 w-2.5" />
                </a>
                {' '}with the <code className="bg-muted px-1 rounded text-xs">gist</code> scope.
              </p>

              <div className="space-y-2">
                <div className="relative">
                  <Input
                    type={showPat ? 'text' : 'password'}
                    placeholder="ghp_xxxxxxxxxxxx"
                    value={patInput}
                    onChange={(e) => setPatInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleConnect()}
                    className="text-xs pr-8 font-mono"
                    disabled={isBusy}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPat((v) => !v)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                    tabIndex={-1}
                  >
                    {showPat ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                  </button>
                </div>

                <Button
                  size="sm"
                  className="w-full gap-2"
                  onClick={handleConnect}
                  disabled={isBusy || !patInput.trim()}
                >
                  {status === 'connecting' ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <KeyRound className="h-3.5 w-3.5" />
                  )}
                  {status === 'connecting' ? 'Connecting…' : 'Connect'}
                </Button>
              </div>
            </div>
          )}

          {/* Connected */}
          {token && user && (
            <div className="space-y-3">
              {/* User info */}
              <div className="flex items-center gap-2">
                <img
                  src={user.avatar_url}
                  alt={user.login}
                  className="h-6 w-6 rounded-full"
                />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-foreground truncate">@{user.login}</p>
                  {lastSynced && (
                    <p className="text-xs text-muted-foreground truncate">
                      Last synced {lastSynced}
                    </p>
                  )}
                </div>
                <button
                  onClick={handleSignOut}
                  className="text-muted-foreground hover:text-destructive transition-colors"
                  title="Sign out"
                >
                  <LogOut className="h-3.5 w-3.5" />
                </button>
              </div>

              {/* Save / Load */}
              <div className="grid grid-cols-2 gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-1.5 text-xs bg-muted text-foreground border-border hover:bg-muted/80"
                  onClick={handleSave}
                  disabled={isBusy}
                >
                  {status === 'saving' ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <CloudUpload className="h-3.5 w-3.5" />
                  )}
                  {status === 'saving' ? 'Saving…' : 'Save'}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-1.5 text-xs bg-muted text-foreground border-border hover:bg-muted/80"
                  onClick={handleLoad}
                  disabled={isBusy}
                >
                  {status === 'loading' ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <CloudDownload className="h-3.5 w-3.5" />
                  )}
                  {status === 'loading' ? 'Loading…' : 'Load'}
                </Button>
              </div>

              <p className="text-xs text-muted-foreground leading-relaxed">
                Syncs your plan inputs and all saved scenarios.
              </p>
            </div>
          )}

          {/* Error state */}
          {status === 'error' && (
            <div className="flex items-center gap-2 text-xs text-destructive">
              <AlertCircle className="h-3.5 w-3.5 shrink-0" />
              <span>Connection failed. Please try again.</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
