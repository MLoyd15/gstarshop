import { useEffect, useRef } from 'react';

const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;

export default function GoogleSignInButton({ onCredential, onError }) {
  const buttonRef = useRef(null);
  const callbacksRef = useRef({ onCredential, onError });
  callbacksRef.current = { onCredential, onError };
  useEffect(() => {
    if (!clientId || !buttonRef.current) return undefined;
    let active = true;
    function renderButton() {
      if (!active || !window.google?.accounts?.id || !buttonRef.current) return;
      window.google.accounts.id.initialize({
        client_id: clientId,
        callback: ({ credential }) => credential ? callbacksRef.current.onCredential(credential) : callbacksRef.current.onError('Google did not return a sign-in credential.'),
        ux_mode: 'popup',
        auto_select: false
      });
      window.google.accounts.id.renderButton(buttonRef.current, { theme: 'outline', size: 'large', shape: 'rectangular', text: 'continue_with', width: Math.floor(buttonRef.current.clientWidth) });
    }
    if (window.google?.accounts?.id) renderButton();
    else {
      let script = document.querySelector('script[data-google-identity]');
      if (!script) {
        script = document.createElement('script');
        script.src = 'https://accounts.google.com/gsi/client'; script.async = true; script.defer = true; script.dataset.googleIdentity = 'true';
        document.head.appendChild(script);
      }
      script.addEventListener('load', renderButton);
      const onScriptError = () => callbacksRef.current.onError('Could not load Google sign-in. Check your connection and try again.');
      script.addEventListener('error', onScriptError);
      return () => { active = false; script.removeEventListener('load', renderButton); script.removeEventListener('error', onScriptError); };
    }
    return () => { active = false; };
  }, []);

  if (!clientId) return <p className="google-setup-hint">Google sign-in is available after adding your Google OAuth client ID to `.env`.</p>;
  return <div className="google-signin" ref={buttonRef} aria-label="Continue with Google" />;
}
