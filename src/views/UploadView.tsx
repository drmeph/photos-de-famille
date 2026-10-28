import { useEffect } from 'preact/hooks';
import { AddPhotosButton } from '../components/AddPhotosButton';
import { Icon } from '../components/Icon';
import { clearFinishedUploads, isUploading, retryUpload, uploads, type UploadItem } from '../data';
import { t } from '../i18n';
import { useStore } from '../lib/store';
import { href, linkClick, navigate } from '../router';

export function UploadView() {
  const items = useStore(uploads);
  const busy = items.some((u) => u.status === 'waiting' || u.status === 'preparing' || u.status === 'uploading');
  const done = items.filter((u) => u.status === 'done' || u.status === 'duplicate').length;

  useEffect(() => {
    document.body.classList.add('no-scroll');
    return () => document.body.classList.remove('no-scroll');
  }, []);

  const finish = () => {
    clearFinishedUploads();
    navigate(href.timeline(), true);
  };

  return (
    <div class="modal-layer">
      <div class="backdrop" onClick={finish} />
      <div class="modal" role="dialog" aria-modal="true" aria-labelledby="upload-title">
        <header class="modal-header">
          <h1 id="upload-title">{t.uploadTitle}</h1>
          <button type="button" class="btn btn-icon btn-ghost" aria-label={t.close} onClick={finish}>
            <Icon name="close" />
          </button>
        </header>

        <div class="modal-body">
          {items.length > 0 && (
            <div class="upload-summary">
              <progress max={items.length} value={done} />
              <span>
                {done} / {items.length}
              </span>
            </div>
          )}
          {busy && <p class="muted">{t.uploadHint}</p>}
          <ul class="upload-list">
            {items.map((u) => (
              <UploadRow key={u.key} item={u} />
            ))}
          </ul>
        </div>

        <footer class="modal-footer">
          {!busy && items.length > 0 && (
            <button type="button" class="btn btn-primary btn-block" onClick={finish}>
              <Icon name="check" />
              <span>
                {t.allDone} {t.backToAlbum}
              </span>
            </button>
          )}
          <AddPhotosButton
            label={items.length ? t.chooseMore : t.addPhotos}
            class={busy || items.length ? 'btn btn-ghost btn-block' : 'btn btn-primary btn-block'}
          />
        </footer>
      </div>
    </div>
  );
}

function UploadRow({ item }: { item: UploadItem }) {
  const label = {
    waiting: t.preparing,
    preparing: t.preparing,
    uploading: `${t.uploading} ${Math.round(item.progress * 100)} %`,
    done: t.uploaded,
    duplicate: t.duplicate,
    failed: t.failed,
  }[item.status];
  return (
    <li class={`upload-row is-${item.status}`}>
      <div class="upload-thumb">
        {item.preview ? <img src={item.preview} alt="" /> : <Icon name="image" />}
        {(item.status === 'done' || item.status === 'duplicate') && (
          <span class="upload-check">
            <Icon name="check" size={16} />
          </span>
        )}
      </div>
      <div class="upload-info">
        <span class="upload-status">{label}</span>
        {item.status === 'uploading' || item.status === 'preparing' ? (
          <progress max={1} value={item.status === 'uploading' ? item.progress : undefined} />
        ) : (
          <span class="upload-name">{item.file.name}</span>
        )}
      </div>
      {(item.status === 'done' || item.status === 'duplicate') && item.id && (
        <a class="btn btn-ghost btn-small" href={href.photo(item.id)} onClick={linkClick}>
          <Icon name="users" size={18} />
          <span>{t.tagThis}</span>
        </a>
      )}
      {item.status === 'failed' && (
        <button type="button" class="btn btn-ghost btn-small" onClick={() => retryUpload(item.key)}>
          <Icon name="retry" size={18} />
          <span>{t.retry}</span>
        </button>
      )}
    </li>
  );
}

// Warn before closing the tab in the middle of an upload.
window.addEventListener('beforeunload', (e) => {
  if (isUploading()) e.preventDefault();
});
