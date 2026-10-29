import { createContext, useContext, useEffect, useState } from 'react';
import AuthGate from './AuthGate.jsx';

const AuthContext = createContext(null);
export const useAuth = () => useContext(AuthContext);

export default function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [checking, setChecking] = useState(true);
  useEffect(() => {
    fetch('/api/auth/me').then((response) => response.ok ? response.json() : null).then((result) => setUser(result?.user || null)).catch(() => setUser(null)).finally(() => setChecking(false));
  }, []);
  async function login(email, password, name) {
    const response = await fetch(name ? '/api/auth/register' : '/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(name ? { name, email, password } : { email, password }) });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'Could not sign in.');
    setUser(result.user);
  }
  async function googleLogin(credential) {
    const response = await fetch('/api/auth/google', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ credential }) });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'Could not sign in with Google.');
    setUser(result.user);
  }
  async function logout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    setUser(null);
  }
  async function updateUser(values, endpoint = '/api/auth/profile') {
    const response = await fetch(endpoint, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(values) });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'Could not save changes.');
    if (result.user) setUser(result.user);
  }
  return <AuthContext.Provider value={{ user, login, googleLogin, logout, updateUser }}><AuthGate checking={checking} user={user} login={login} googleLogin={googleLogin}>{children}</AuthGate></AuthContext.Provider>;
}
