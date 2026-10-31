import { useEffect, useState } from 'preact/hooks';

// A computer with a mouse or trackpad as its main pointer, where dragging photos in from a
// folder makes sense. Phones and tablets keep the native photo picker.
const DESKTOP = '(hover: hover) and (pointer: fine)';

export const isDesktop = () => window.matchMedia(DESKTOP).matches;

export function useIsDesktop(): boolean {
  const [desktop, setDesktop] = useState(isDesktop);
  useEffect(() => {
    const query = window.matchMedia(DESKTOP);
    const onChange = () => setDesktop(query.matches);
    query.addEventListener('change', onChange);
    return () => query.removeEventListener('change', onChange);
  }, []);
  return desktop;
}
