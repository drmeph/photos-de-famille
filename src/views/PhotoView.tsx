import { useEffect, useRef, useState } from 'preact/hooks';
import type { Person, PhotoMeta, TimelineEntry, UpdatePhotoRequest } from '../../shared/types';
import { api, imageUrl } from '../api';
import { PersonChips } from '../components/PersonChips';
import { addPerson, patchTimeline, type LoadState } from '../data';
import { albumTitle, formatDate, locale, t } from '../i18n';
import { goBack, href, navigate } from '../router';

interface Props {
  id: string;
  list: TimelineEntry[]; // the photos currently shown in the timeline, for previous/next
  people: Person[];
}

export function PhotoView({ id, list, people }: Props) {
  const [state, setState] = useState<LoadState<PhotoMeta>>({ status: 'loading' });
  const [saving, setSaving] = useState(0);
  const [saveError, setSaveError] = useState(false);
  const queue = useRef<Promise<unknown>>(Promise.resolve());
  const scroller = useRef<HTMLDivElement>(null);

  const pos = list.findIndex((e) => e.id === id);
  const prevId = pos > 0 ? list[pos - 1].id : null;
  const nextId = pos >= 0 && pos < list.length - 1 ? list[pos + 1].id : null;
  const go = (target: string | null) => target && navigate(href.photo(target), true);

  useEffect(() => {
    let cancelled = false;
    setState({ status: 'loading' });
    setSaveError(false);
    scroller.current?.scrollTo(0, 0);
    api.photo(id).then(
      (data) => !cancelled && setState({ status: 'ready', data }),
      () => !cancelled && setState({ status: 'error' }),
    );
    // Warm the cache so swiping to the neighbours feels instant.
    for (const n of [prevId, nextId]) if (n) new Image().src = imageUrl(n, 'display');
    return () => {
      cancelled = true;
    };
  }, [id]);

  // Keyboard (computers) and swipe (phones) navigation.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).closest('input, textarea, select')) return;
      if (e.key === 'ArrowLeft') go(prevId);
      if (e.key === 'ArrowRight') go(nextId);
      if (e.key === 'Escape') goBack();
    };
    document.addEventListener('keydown', onKey);
    document.body.classList.add('no-scroll');
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.classList.remove('no-scroll');
    };
  }, [prevId, nextId]);

  const touchStart = useRef<{ x: number; y: number } | null>(null);
  const onTouchStart = (e: TouchEvent) => (touchStart.current = { x: e.touches[0].clientX, y: e.touches[0].clientY });
  const onTouchEnd = (e: TouchEvent) => {
    const start = touchStart.current;
    touchStart.current = null;
    if (!start) return;
    const dx = e.changedTouches[0].clientX - start.x;
    const dy = e.changedTouches[0].clientY - start.y;
    if (Math.abs(dx) > 70 && Math.abs(dx) > 2 * Math.abs(dy)) go(dx > 0 ? prevId : nextId);
  };

  // Latest state, for callbacks that run after an await.
  const current = useRef(state);
  current.current = state;
  const pending = useRef(0);

  /** Apply a change locally right away, then save. Saves run one after another so
   *  quick taps reach the server in order; the server's answer is shown once all are done. */
  const update = (change: UpdatePhotoRequest, local: (m: PhotoMeta) => PhotoMeta) => {
    const s = current.current;
    if (s.status !== 'ready') return;
    setState({ status: 'ready', data: local(s.data) });
    pending.current++;
    setSaving(pending.current);
    setSaveError(false);
    const run = queue.current.then(() => api.updatePhoto(id, change));
    queue.current = run.catch(() => undefined);
    const done = (meta: PhotoMeta | null) => {
      pending.current--;
      setSaving(pending.current);
      if (meta) patchTimeline(meta);
      if (pending.current > 0) return;
      const fresh = meta ? Promise.resolve(meta) : api.photo(id); // on error, show what is really saved
      fresh.then(
        (data) => setState((prev) => (prev.status === 'ready' && prev.data.id === data.id ? { status: 'ready', data } : prev)),
        () => undefined,
      );
    };
    run.then(done, () => {
      setSaveError(true);
      done(null);
    });
  };

  const togglePerson = (personId: string) => {
    const s = current.current;
    if (s.status !== 'ready') return;
    const on = s.data.people.includes(personId);
    update(on ? { removePeople: [personId] } : { addPeople: [personId] }, (m) => ({
      ...m,
      people: on ? m.people.filter((p) => p !== personId) : [...m.people, personId],
    }));
  };

  const createAndTag = async (name: string) => {
    const person = await addPerson(name);
    const s = current.current;
    if (s.status === 'ready' && !s.data.people.includes(person.id)) togglePerson(person.id);
  };

  return (
    <div class="overlay" ref={scroller} role="dialog" aria-modal="true" aria-label={albumTitle}>
      <header class="topbar">
        <button type="button" class="btn" onClick={goBack}>
          ← {t.back}
        </button>
        <span class="save-status" role="status">
          {saving > 0 ? t.saving : saveError ? `⚠ ${t.errorGeneric}` : ''}
        </span>
      </header>

      <div class="photo-stage" onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
        <img key={id} src={imageUrl(id, 'display')} alt="" class="photo-full" />
      </div>

      <nav class="prevnext">
        <button type="button" class="btn" disabled={!prevId} onClick={() => go(prevId)}>
          ← {t.previous}
        </button>
        <button type="button" class="btn" disabled={!nextId} onClick={() => go(nextId)}>
          {t.next} →
        </button>
      </nav>

      {state.status === 'loading' && <p class="muted">{t.loading}</p>}
      {state.status === 'error' && <p class="error">{t.errorGeneric}</p>}
      {state.status === 'ready' && (
        <Details meta={state.data} people={people} onToggle={togglePerson} onAddPerson={createAndTag} onUpdate={update} />
      )}
    </div>
  );
}

interface DetailsProps {
  meta: PhotoMeta;
  people: Person[];
  onToggle: (id: string) => void;
  onAddPerson: (name: string) => Promise<void>;
  onUpdate: (change: UpdatePhotoRequest, local: (m: PhotoMeta) => PhotoMeta) => void;
}

function Details({ meta, people, onToggle, onAddPerson, onUpdate }: DetailsProps) {
  const [editingDate, setEditingDate] = useState(false);
  const [date, setDate] = useState(meta.takenAt.slice(0, 10));
  const [caption, setCaption] = useState(meta.caption);
  useEffect(() => setCaption(meta.caption), [meta.id, meta.caption]);
  useEffect(() => setDate(meta.takenAt.slice(0, 10)), [meta.id, meta.takenAt]);

  const tagged = meta.people.map((id) => people.find((p) => p.id === id)?.name ?? id);
  const dateNote = { exif: t.dateFromCamera, upload: t.dateFromUpload, manual: t.dateManual }[meta.dateSource];

  const saveDate = (e: Event) => {
    e.preventDefault();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return;
    const takenAt = `${date}T${meta.takenAt.slice(11)}`;
    onUpdate({ takenAt }, (m) => ({ ...m, takenAt, dateSource: 'manual' }));
    setEditingDate(false);
  };

  return (
    <div class="details">
      {meta.caption && <p class="caption-text">{meta.caption}</p>}

      <section class="panel">
        <h2>{t.whoIsInPhoto}</h2>
        <p class={tagged.length ? 'tagged-names' : 'muted'}>{tagged.length ? tagged.join(', ') : t.nobodyTagged}</p>
        <PersonChips people={people} selected={meta.people} onToggle={onToggle} onAdd={onAddPerson} />
      </section>

      <section class="panel">
        <h2>{t.date}</h2>
        {!editingDate ? (
          <>
            <p class="big-text">{formatDate(meta.takenAt)}</p>
            <p class="muted">({dateNote})</p>
            <button type="button" class="btn" onClick={() => setEditingDate(true)}>
              {t.changeDate}
            </button>
          </>
        ) : (
          <form class="inline-form" onSubmit={saveDate}>
            <input type="date" value={date} max="2100-12-31" onInput={(e) => setDate(e.currentTarget.value)} required aria-label={t.date} />
            <button type="submit" class="btn btn-primary">
              {t.save}
            </button>
            <button type="button" class="btn" onClick={() => setEditingDate(false)}>
              {t.cancel}
            </button>
          </form>
        )}
      </section>

      <section class="panel">
        <h2>{t.caption}</h2>
        <textarea
          rows={2}
          maxLength={2000}
          value={caption}
          placeholder={t.captionPlaceholder}
          aria-label={t.caption}
          onInput={(e) => setCaption(e.currentTarget.value)}
        />
        {caption.trim() !== meta.caption && (
          <button type="button" class="btn btn-primary" onClick={() => onUpdate({ caption }, (m) => ({ ...m, caption: caption.trim() }))}>
            {t.save}
          </button>
        )}
      </section>

      <p class="muted">
        {t.addedBy(meta.uploadedBy, new Date(meta.uploadedAt).toLocaleDateString(locale))}
        {' · '}
        <a href={`${imageUrl(meta.id, 'original')}?download=1`}>{t.downloadOriginal}</a>
      </p>
    </div>
  );
}
