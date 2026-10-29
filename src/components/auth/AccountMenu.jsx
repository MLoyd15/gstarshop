import { useState } from 'react';
import { useAuth } from './AuthProvider.jsx';

export default function AccountMenu() {
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const initials = (user?.name || user?.email || 'U').split(/[\s@]/).filter(Boolean).slice(0, 2).map((part) => part[0].toUpperCase()).join('');
  return <div className="account-menu"><button type="button" className="top-avatar" aria-label="Open account menu" aria-expanded={open} onClick={() => setOpen((value) => !value)}>{initials}</button>{open && <div className="account-popover"><strong>{user?.name}</strong><span>{user?.email}</span><button type="button" onClick={() => { setOpen(false); logout(); }}>Sign out</button></div>}</div>;
}
