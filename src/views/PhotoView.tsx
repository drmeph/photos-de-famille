import { useEffect, useRef, useState } from 'preact/hooks';
import type { Person, PhotoMeta, TimelineEntry, UpdatePhotoRequest } from '../../shared/types';
import { api, imageUrl } from '../api';
import { Icon } from '../components/Icon';
import { PersonChips } from '../components/PersonChips';
import { addPerson, patchTimeline, type LoadState } from '../data';
import { albumTitle, formatDate, locale, t, yearsAgo } from '../i18n';
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

  const position = pos >= 0 ? t.photoPosition(pos + 1, list.length) : '';

  return (
    <div class="viewer" ref={scroller} role="dialog" aria-modal="true" aria-label={albumTitle}>
      <div class="stage" onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
        {/* The blurred thumbnail (already cached from the timeline) fills the stage with the photo's colors. */}
        <img src={imageUrl(id, 'thumb')} alt="" class="stage-glow" aria-hidden="true" />
        <img key={id} src={imageUrl(id, 'display')} alt="" class="stage-photo" />

        <div class="stage-bar">
          <button type="button" class="btn btn-glass" onClick={goBack}>
            <Icon name="back" />
            <span>{t.back}</span>
          </button>
          <span class="stage-position">{position}</span>
          <span class="save-status" role="status">
            {saving > 0 ? t.saving : saveError ? t.errorGeneric : ''}
          </span>
        </div>
        {prevId && (
          <button type="button" class="stage-arrow stage-prev" aria-label={t.previous} onClick={() => go(prevId)}>
            <Icon name="left" size={30} />
          </button>
        )}
        {nextId && (
          <button type="button" class="stage-arrow stage-next" aria-label={t.next} onClick={() => go(nextId)}>
            <Icon name="right" size={30} />
          </button>
        )}
      </div>

      <div class="details">
        {state.status === 'loading' && <div class="details-loading" aria-label={t.loading} />}
        {state.status === 'error' && <p class="error">{t.errorGeneric}</p>}
        {state.status === 'ready' && (
          <Details meta={state.data} people={people} onToggle={togglePerson} onAddPerson={createAndTag} onUpdate={update} />
        )}
      </div>
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
  const [editingCaption, setEditingCaption] = useState(false);
  useEffect(() => setCaption(meta.caption), [meta.id, meta.caption]);
  useEffect(() => setDate(meta.takenAt.slice(0, 10)), [meta.id, meta.takenAt]);
  useEffect(() => {
    setEditingDate(false);
    setEditingCaption(false);
  }, [meta.id]);

  const dateNote = { exif: t.dateFromCamera, upload: t.dateFromUpload, manual: t.dateManual }[meta.dateSource];
  const ago = yearsAgo(meta.takenAt);

  const saveDate = (e: Event) => {
    e.preventDefault();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return;
    const takenAt = `${date}T${meta.takenAt.slice(11)}`;
    onUpdate({ takenAt }, (m) => ({ ...m, takenAt, dateSource: 'manual' }));
    setEditingDate(false);
  };

  const saveCaption = (e: Event) => {
    e.preventDefault();
    onUpdate({ caption }, (m) => ({ ...m, caption: caption.trim() }));
    setEditingCaption(false);
  };

  return (
    <>
      <section class="detail-block">
        {!editingDate ? (
          <>
            <p class="photo-date">{formatDate(meta.takenAt)}</p>
            <p class="muted">
              {ago && <strong class="ago">{ago}</strong>}
              {ago && ' · '}
              {dateNote}
            </p>
            <button type="button" class="btn btn-ghost btn-small" onClick={() => setEditingDate(true)}>
              <Icon name="pencil" size={18} />
              <span>{t.changeDate}</span>
            </button>
          </>
        ) : (
          <form class="stack" onSubmit={saveDate}>
            <label class="field">
              <span class="field-label">{t.date}</span>
              <input type="date" class="input" value={date} max="2100-12-31" onInput={(e) => setDate(e.currentTarget.value)} required />
            </label>
            <div class="row">
              <button type="submit" class="btn btn-primary">
                {t.save}
              </button>
              <button type="button" class="btn btn-ghost" onClick={() => setEditingDate(false)}>
                {t.cancel}
              </button>
            </div>
          </form>
        )}
      </section>

      <section class="detail-block">
        {!editingCaption ? (
          meta.caption ? (
            <button type="button" class="caption" onClick={() => setEditingCaption(true)}>
              <span>{meta.caption}</span>
              <Icon name="pencil" size={18} />
            </button>
          ) : (
            <button type="button" class="btn btn-ghost btn-small" onClick={() => setEditingCaption(true)}>
              <Icon name="plus" size={18} />
              <span>{t.addCaption}</span>
            </button>
          )
        ) : (
          <form class="stack" onSubmit={saveCaption}>
            <label class="field">
              <span class="field-label">{t.caption}</span>
              <textarea
                class="input"
                rows={3}
                maxLength={2000}
                value={caption}
                placeholder={t.captionPlaceholder}
                autoFocus
                onInput={(e) => setCaption(e.currentTarget.value)}
              />
            </label>
            <div class="row">
              <button type="submit" class="btn btn-primary">
                {t.save}
              </button>
              <button
                type="button"
                class="btn btn-ghost"
                onClick={() => {
                  setCaption(meta.caption);
                  setEditingCaption(false);
                }}
              >
                {t.cancel}
              </button>
            </div>
          </form>
        )}
      </section>

      <section class="detail-block">
        <h2 class="side-title">
          <Icon name="users" size={20} />
          {t.onThisPhoto}
        </h2>
        {meta.people.length === 0 && <p class="muted">{t.tapToTag}</p>}
        <PersonChips people={people} selected={meta.people} onToggle={onToggle} onAdd={onAddPerson} />
      </section>

      <footer class="detail-footer">
        <p class="muted">{t.addedBy(meta.uploadedBy, new Date(meta.uploadedAt).toLocaleDateString(locale))}</p>
        <a class="btn btn-ghost btn-small" href={`${imageUrl(meta.id, 'original')}?download=1`}>
          <Icon name="download" size={18} />
          <span>{t.downloadOriginal}</span>
        </a>
      </footer>
    </>
  );
}
