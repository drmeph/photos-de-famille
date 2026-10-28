import { useEffect, useRef } from 'preact/hooks';
import { t } from '../i18n';
import type { YearGroup } from '../lib/filter';

interface Props {
  years: YearGroup[];
  active: string | null;
  variant: 'strip' | 'rail'; // strip: horizontal, under the header (phones, tablets); rail: sidebar list (desktop)
}

export function scrollToYear(year: string) {
  document.getElementById(`year-${year}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

/** Jump-to-year buttons; the year currently on screen is highlighted. */
export function YearNav({ years, active, variant }: Props) {
  const list = useRef<HTMLDivElement>(null);

  // Keep the highlighted year in view by scrolling only this list (never the page,
  // which may be in the middle of a smooth jump to a year).
  useEffect(() => {
    const box = variant === 'strip' ? list.current : (list.current?.closest('.year-rail') as HTMLElement | null);
    const chip = list.current?.querySelector<HTMLElement>('[aria-current="true"]');
    if (!box || !chip) return;
    const b = box.getBoundingClientRect();
    const c = chip.getBoundingClientRect();
    if (variant === 'strip') {
      box.scrollTo({ left: box.scrollLeft + c.left - b.left - b.width / 2 + c.width / 2, behavior: 'smooth' });
    } else if (c.top < b.top + 60 || c.bottom > b.bottom - 20) {
      box.scrollTo({ top: box.scrollTop + c.top - b.top - b.height / 3, behavior: 'smooth' });
    }
  }, [active, variant]);

  if (years.length < 2) return null;
  return (
    <nav class={`year-nav year-${variant}`} aria-label={t.jumpToYear}>
      {variant === 'rail' && <h2 class="side-title">{t.years}</h2>}
      <div class="year-list" ref={list}>
        {years.map((y) => (
          <button
            key={y.year}
            type="button"
            class="year-btn"
            aria-current={y.year === active ? 'true' : undefined}
            onClick={() => scrollToYear(y.year)}
          >
            <span>{y.year}</span>
            {variant === 'rail' && <span class="year-btn-count">{y.photos.length}</span>}
          </button>
        ))}
      </div>
    </nav>
  );
}

/** Which year section is under the top part of the screen. */
export function useActiveYear(years: YearGroup[], setActive: (y: string) => void) {
  useEffect(() => {
    if (years.length) setActive(years[0].year); // until the observer reports, the top of the page
    const visible = new Set<string>();
    const observer = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          const year = (e.target as HTMLElement).dataset.year!;
          if (e.isIntersecting) visible.add(year);
          else visible.delete(year);
        }
        const first = years.find((y) => visible.has(y.year)); // years are newest first, like the page
        if (first) setActive(first.year);
      },
      { rootMargin: '-25% 0px -65% 0px' }, // a band near the top of the screen
    );
    document.querySelectorAll('.year-section').forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [years]);
}
