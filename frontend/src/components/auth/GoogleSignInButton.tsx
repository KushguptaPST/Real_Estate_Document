import { useEffect, useRef, useState } from 'react';
import { Loader2, AlertTriangle } from 'lucide-react';

const GSI_SRC = 'https://accounts.google.com/gsi/client';
const CLIENT_ID = import.meta.env['VITE_GOOGLE_CLIENT_ID'] || import.meta.env['GOOGLE_CLIENT_ID'];

interface GoogleSignInButtonProps {
  onCredential: (credential: string) => Promise<void>;
  onError?: (message: string) => void;
  disabled?: boolean;
  text?: 'continue_with' | 'signin_with' | 'signup_with';
}

export function GoogleSignInButton({
  onCredential,
  onError,
  disabled = false,
  text = 'continue_with',
}: GoogleSignInButtonProps) {
  const buttonRef = useRef<HTMLDivElement>(null);
  const onCredentialRef = useRef(onCredential);
  const onErrorRef = useRef(onError);
  onCredentialRef.current = onCredential;
  onErrorRef.current = onError;

  const [ready, setReady] = useState(false);
  const [signingIn, setSigningIn] = useState(false);
  const [configError, setConfigError] = useState<string | null>(null);

  useEffect(() => {
    if (!CLIENT_ID) return;
    let cancelled = false;

    const loadGoogleScript = (): Promise<void> => {
      if (window.google?.accounts.id) return Promise.resolve();
      return new Promise((resolve, reject) => {
        const existing = document.querySelector<HTMLScriptElement>(`script[src="${GSI_SRC}"]`);
        const script = existing ?? document.createElement('script');
        script.addEventListener('load', () => resolve());
        script.addEventListener('error', () => reject(new Error('Could not load Google Sign-In')));
        if (!existing) {
          script.src = GSI_SRC;
          script.async = true;
          document.head.appendChild(script);
        }
      });
    };

    loadGoogleScript()
      .then(() => {
        if (cancelled || !window.google) return;
        window.google.accounts.id.initialize({
          client_id: CLIENT_ID,
          callback: async ({ credential }) => {
            console.log('[GoogleSignInButton] Credential token received from Google Identity Services');
            setSigningIn(true);
            setConfigError(null);
            try {
              await onCredentialRef.current(credential);
            } catch (err) {
              const msg = err instanceof Error ? err.message : 'Google authentication failed';
              console.error('[GoogleSignInButton] onCredential failed:', msg);
              setConfigError(msg);
              onErrorRef.current?.(msg);
            } finally {
              if (!cancelled) setSigningIn(false);
            }
          },
          error_callback: (err: { type?: string }) => {
            console.warn('[GoogleSignInButton] Google Identity Services error callback received:', err);
            if (err?.type === 'popup_closed_by_user') return;
            if (err?.type === 'origin_mismatch') {
              const msg =
                'Google OAuth Notice: This domain (e.g. real-estate-document.vercel.app) must be added to Authorized JavaScript Origins in Google Cloud Console. Use Instant Demo Access or Email Login to sign in immediately.';
              setConfigError(msg);
              onErrorRef.current?.(msg);
            } else {
              const msg = `Google sign-in error: ${err?.type || 'unknown'}`;
              setConfigError(msg);
              onErrorRef.current?.(msg);
            }
          },
        });
        setReady(true);
      })
      .catch((err: Error) => {
        if (!cancelled) {
          setConfigError(err.message);
          onErrorRef.current?.(err.message);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!ready || signingIn || disabled || !buttonRef.current || !window.google || !CLIENT_ID) return;
    const container = buttonRef.current;

    const render = () => {
      if (!container || !window.google?.accounts?.id) return;
      const measured = container.clientWidth || container.parentElement?.clientWidth || 320;
      const targetWidth = Math.max(200, Math.min(380, Math.floor(measured)));
      container.innerHTML = '';
      window.google.accounts.id.renderButton(container, {
        theme: 'outline',
        size: 'large',
        text,
        shape: 'rectangular',
        width: targetWidth,
      });
    };

    render();

    if (typeof ResizeObserver === 'undefined') return;
    let lastWidth = Math.floor(container.clientWidth || 0);
    const observer = new ResizeObserver(() => {
      const nextWidth = Math.floor(container.clientWidth || 0);
      if (nextWidth > 0 && Math.abs(nextWidth - lastWidth) >= 12) {
        lastWidth = nextWidth;
        render();
      }
    });
    observer.observe(container);
    return () => observer.disconnect();
  }, [ready, signingIn, disabled, text]);

  if (!CLIENT_ID) {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900 flex items-start gap-2">
        <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600 mt-0.5" />
        <span>Google Sign-In is not configured (`VITE_GOOGLE_CLIENT_ID` missing).</span>
      </div>
    );
  }

  return (
    <div className="w-full space-y-2.5">
      <div className="flex min-h-[44px] w-full flex-col justify-center items-center overflow-hidden">
        {(signingIn || disabled) && (
          <div className="flex items-center justify-center gap-2 rounded-xl bg-zinc-50 border border-zinc-200 px-4 py-2 text-xs font-medium text-zinc-700 w-full">
            <Loader2 className="h-3.5 w-3.5 animate-spin text-zinc-900" />
            <span>Verifying Google account...</span>
          </div>
        )}
        <div
          ref={buttonRef}
          className={`flex w-full justify-center overflow-hidden ${signingIn || disabled ? 'hidden' : 'block'}`}
        />
      </div>
      {configError && (
        <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-2.5 text-xs text-red-900">
          <AlertTriangle className="h-4 w-4 shrink-0 text-red-600 mt-0.5" />
          <span>{configError}</span>
        </div>
      )}
    </div>
  );
}
