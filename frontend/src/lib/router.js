import { useEffect, useState } from 'react';

const normalizePath = (path) => {
  const clean = String(path || '/')
    .split('?')[0]
    .split('#')[0]
    .replace(/\/+$/, '');
  return clean || '/';
};

export const navigate = (to, { replace = false } = {}) => {
  if (typeof window === 'undefined') return;
  const next = normalizePath(to);
  if (normalizePath(window.location.pathname) === next) return;
  window.history[replace ? 'replaceState' : 'pushState']({}, '', next);
  window.dispatchEvent(new Event('popstate'));
};

export const usePathname = () => {
  const [pathname, setPathname] = useState(() => (
    typeof window === 'undefined' ? '/' : normalizePath(window.location.pathname)
  ));

  useEffect(() => {
    const sync = () => setPathname(normalizePath(window.location.pathname));
    window.addEventListener('popstate', sync);
    return () => window.removeEventListener('popstate', sync);
  }, []);

  return pathname;
};
