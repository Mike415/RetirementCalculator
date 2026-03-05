/**
 * CloudSync Component
 * ───────────────────
 * Provides GitHub Gist cloud sync via Device Flow OAuth.
 * Renders as a collapsible panel in the Sidebar.
 *
 * Flow:
 *   1. User clicks "Connect GitHub"
 *   2. Device code requested → user_code shown + verification_uri opened
 *   3. Poll until user approves → token stored
 *   4. Save / Load buttons appear
 */

import { useState, useEffect, useCallback } from 'react';
import { Cloud, CloudDownload, CloudUpload, LogOut, Loader2, CheckCircle, AlertCircle, Github, Copy, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { usePlanner } from '@/contexts/PlannerContext';
import {
  requestDeviceCode,
  pollForToken,
  getAuthenticatedUser,
  saveToGist,
  loadFromGist,
  getStoredToken,
  setStoredToken,
  clearStoredToken,
} from '@/lib/githubGist';

interface UserInfo {
  login: string;
  avatar_url: string;
}

export default function CloudSync() {
  const { inputs, importFromObject } = usePlanner();

  const [token, setToken] = useState<string | null>(() => getStoredToken());
  const [user, setUser] = useState<UserInfo | null>(null);
  const [status, setStatus] = useState<
    'idle' | 'requesting' | 'polling' | 'saving' | 'loading' | 'error'
  >('idle');
  const [userCode, setUserCode] = useState<string>('');
  const [verificationUri, setVerificationUri] = useState<string>('');
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

  const startDeviceFlow = useCallback(async () => {
    setStatus('requesting');
    try {
      const deviceData = await requestDeviceCode();
      setUserCode(deviceData.user_code);
      setVerificationUri(deviceData.verification_uri);
      setStatus('polling');

      // Open the verification page
      window.open(deviceData.verification_uri, '_blank', 'noopener,noreferrer');

      // Poll for token
      const accessToken = await pollForToken(deviceData.device_code, deviceData.interval);
      setStoredToken(accessToken);
      setToken(accessToken);
      setStatus('idle');
      setUserCode('');
      setVerificationUri('');
      toast.success('Connected to GitHub successfully!');
    } catch (err: unknown) {
      setStatus('error');
      const message = err instanceof Error ? err.message : 'Authorization failed';
      toast.error(message);
      setTimeout(() => setStatus('idle'), 3000);
    }
  }, []);

  const handleSave = useCallback(async () => {
    if (!token) return;
    setStatus('saving');
    try {
      await saveToGist(token, inputs);
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
      const result = importFromObject(data);
      if (!result.ok) {
        setStatus('idle');
        toast.error(result.error ?? 'Failed to load plan.');
        return;
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

  const copyUserCode = useCallback(() => {
    navigator.clipboard.writeText(userCode);
    toast.success('Code copied!');
  }, [userCode]);

  const isBusy = status === 'saving' || status === 'loading' || status === 'requesting';

  return (
    <div className="border border-border rounded-lg overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setExpanded((e) => !e)}
        className="w-full flex items-center gap-2 px-3 py-2.5 bg-muted/50 hover:bg-muted transition-colors text-left"
      >
        <Cloud className="h-4 w-4 text-muted-foreground shrink-0" />
        <span className="text-xs font-medium text-foreground flex-1">Cloud Sync</span>
        {token && user && (
          <span className="text-xs text-emerald-600 font-medium">● Connected</span>
        )}
        {!token && (
          <span className="text-xs text-muted-foreground">GitHub Gist</span>
        )}
      </button>

      {/* Body */}
      {expanded && (
        <div className="px-3 py-3 space-y-3 bg-background">
          {/* Not connected */}
          {!token && status !== 'polling' && (
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground leading-relaxed">
                Save your plan to a private GitHub Gist — accessible from any device, no account required beyond GitHub.
              </p>
              <Button
                size="sm"
                className="w-full gap-2"
                onClick={startDeviceFlow}
                disabled={isBusy}
              >
                {status === 'requesting' ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Github className="h-3.5 w-3.5" />
                )}
                {status === 'requesting' ? 'Requesting…' : 'Connect GitHub'}
              </Button>
            </div>
          )}

          {/* Polling — show user code */}
          {status === 'polling' && (
            <div className="space-y-3">
              <div className="flex items-start gap-2 text-xs text-muted-foreground">
                <Loader2 className="h-3.5 w-3.5 animate-spin mt-0.5 shrink-0 text-primary" />
                <span>Waiting for you to authorize on GitHub…</span>
              </div>

              <div className="bg-muted rounded-md p-3 space-y-2">
                <p className="text-xs text-muted-foreground">Enter this code at GitHub:</p>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-lg font-bold tracking-widest text-foreground">
                    {userCode}
                  </span>
                  <button
                    onClick={copyUserCode}
                    className="text-muted-foreground hover:text-foreground transition-colors"
                    title="Copy code"
                  >
                    <Copy className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>

              <a
                href={verificationUri}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 text-xs text-primary hover:underline"
              >
                <ExternalLink className="h-3 w-3" />
                Open {verificationUri}
              </a>

              <Button
                size="sm"
                variant="outline"
                className="w-full"
                onClick={() => {
                  setStatus('idle');
                  setUserCode('');
                  setVerificationUri('');
                }}
              >
                Cancel
              </Button>
            </div>
          )}

          {/* Connected */}
          {token && user && status !== 'polling' && (
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
                  className="gap-1.5 text-xs"
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
                  className="gap-1.5 text-xs"
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
                Saved as a private Gist in your GitHub account. Only you can see it.
              </p>
            </div>
          )}

          {/* Error state */}
          {status === 'error' && (
            <div className="flex items-center gap-2 text-xs text-destructive">
              <AlertCircle className="h-3.5 w-3.5 shrink-0" />
              <span>Authorization failed. Please try again.</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
