import { useState } from 'preact/hooks';
import type { PhotoMeta } from '../../shared/types';
import { COMMENT_MAX, NAME_MAX } from '../../shared/types';
import { api } from '../api';
import { me as meStore, setMyName } from '../data';
import { t, timeAgo } from '../i18n';
import { useStore } from '../lib/store';
import { Icon } from './Icon';
import { Avatar } from './PersonChips';

interface Props {
  meta: PhotoMeta;
  /** The photo page's save queue: runs the request after any pending saves, then shows the result. */
  save: (send: () => Promise<PhotoMeta>) => Promise<boolean>;
}

/** Comments on one photo, oldest first, with a box to add one. */
export function Comments({ meta, save }: Props) {
  const me = useStore(meStore);
  const comments = meta.comments ?? [];

  const remove = (commentId: string) => {
    if (confirm(t.confirmDeleteComment)) void save(() => api.deleteComment(meta.id, commentId));
  };

  return (
    <section class="detail-block comments" aria-labelledby="comments-title">
      <h2 class="side-title" id="comments-title">
        <Icon name="message" size={20} />
        {t.comments}
        {comments.length > 0 && <span class="count-badge">{comments.length}</span>}
      </h2>

      {comments.length === 0 && <p class="muted">{t.noComments}</p>}
      <ul class="comment-list">
        {comments.map((c) => (
          <li key={c.id} class="comment">
            <Avatar name={c.name} />
            <div class="comment-body">
              <p class="comment-meta">
                <strong>{c.name}</strong>
                <time dateTime={c.at} title={new Date(c.at).toLocaleString()}>
                  {timeAgo(c.at)}
                </time>
              </p>
              <p class="comment-text">{c.text}</p>
              {me && c.by === me.user && (
                <button type="button" class="link-btn is-quiet" onClick={() => remove(c.id)}>
                  <Icon name="trash" size={16} />
                  {t.deleteComment}
                </button>
              )}
            </div>
          </li>
        ))}
      </ul>

      <Composer key={meta.id} name={me?.name ?? null} send={(text) => save(() => api.addComment(meta.id, text))} />
    </section>
  );
}

/** The comment box. The first time, it also asks for the name shown with comments. */
function Composer({ name, send }: { name: string | null; send: (text: string) => Promise<boolean> }) {
  const [text, setText] = useState('');
  const [nameInput, setNameInput] = useState(name ?? '');
  const [editingName, setEditingName] = useState(false);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const askName = !name || editingName;

  const submit = async (e: Event) => {
    e.preventDefault();
    const trimmed = text.trim();
    if (!trimmed || busy || (askName && !nameInput.trim())) return;
    setBusy(true);
    setFailed(false);
    try {
      if (askName && nameInput.trim() !== name) await setMyName(nameInput.trim());
      if (await send(trimmed)) {
        setText('');
        setEditingName(false);
      } else setFailed(true);
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  };

  return (
    <form class="composer" onSubmit={submit}>
      {askName ? (
        <label class="field">
          <span class="field-label">{t.yourName}</span>
          <input
            class="input"
            type="text"
            value={nameInput}
            maxLength={NAME_MAX}
            autoComplete="given-name"
            autoCapitalize="words"
            required
            onInput={(e) => setNameInput(e.currentTarget.value)}
          />
          <span class="muted field-hint">{t.yourNameHint}</span>
        </label>
      ) : (
        <p class="muted commenting-as">
          {t.commentingAs(name!)}
          {' · '}
          <button type="button" class="link-btn" onClick={() => setEditingName(true)}>
            {t.changeName}
          </button>
        </p>
      )}
      <textarea
        class="input"
        rows={2}
        maxLength={COMMENT_MAX}
        value={text}
        placeholder={t.writeComment}
        aria-label={t.writeComment}
        onInput={(e) => setText(e.currentTarget.value)}
      />
      {failed && <p class="error">{t.errorGeneric}</p>}
      <button type="submit" class="btn btn-primary" disabled={busy || !text.trim() || (askName && !nameInput.trim())}>
        <Icon name="message" size={20} />
        <span>{busy ? t.publishing : t.publish}</span>
      </button>
    </form>
  );
}
