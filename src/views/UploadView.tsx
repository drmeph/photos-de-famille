import { useEffect } from 'preact/hooks';
import { AddPhotosButton } from '../components/AddPhotosButton';
import { clearFinishedUploads, isUploading, retryUpload, uploads, type UploadItem } from '../data';
import { t } from '../i18n';
import { href, linkClick, navigate } from '../router';
import { useStore } from '../lib/store';

export function UploadView() {
  const items = useStore(uploads);
  const busy = items.some((u) => u.status === 'waiting' || u.status === 'preparing' || u.status === 'uploading');

  useEffect(() => {
    document.body.classList.add('no-scroll');
    return () => document.body.classList.remove('no-scroll');
  }, []);

  const finish = () => {
    clearFinishedUploads();
    navigate(href.timeline(), true);
  };

  return (
    <div class="overlay" role="dialog" aria-modal="true" aria-label={t.uploadTitle}>
      <header class="topbar">
        <button type="button" class="btn" onClick={finish}>
          ← {t.backToAlbum}
        </button>
      </header>
      <main class="upload">
        <h1>{t.uploadTitle}</h1>
        {busy && <p class="notice">{t.keepPageOpen}</p>}
        <ul class="upload-list">
          {items.map((u) => (
            <UploadRow key={u.key} item={u} />
          ))}
        </ul>
        {!busy && items.length > 0 && (
          <>
            <p class="big-text">{t.allDone}</p>
            <button type="button" class="btn btn-primary btn-big" onClick={finish}>
              {t.backToAlbum}
            </button>
          </>
        )}
        <div class="upload-more">
          <AddPhotosButton label={items.length ? t.chooseMore : t.addPhotos} class={busy || items.length ? 'btn btn-big' : 'btn btn-primary btn-big'} />
        </div>
      </main>
    </div>
  );
}

function UploadRow({ item }: { item: UploadItem }) {
  const label = {
    waiting: '…',
    preparing: t.preparing,
    uploading: `${t.uploading} ${Math.round(item.progress * 100)} %`,
    done: t.uploaded,
    duplicate: t.duplicate,
    failed: t.failed,
  }[item.status];
  return (
    <li class={`upload-row status-${item.status}`}>
      <div class="upload-thumb">{item.preview ? <img src={item.preview} alt="" /> : <span aria-hidden="true">🖼</span>}</div>
      <div class="upload-info">
        <span class="upload-name">{item.file.name}</span>
        <span class="upload-status">{label}</span>
        {item.status === 'uploading' && <progress max={1} value={item.progress} />}
      </div>
      {(item.status === 'done' || item.status === 'duplicate') && item.id && (
        <a class="btn" href={href.photo(item.id)} onClick={linkClick}>
          {t.tagThis}
        </a>
      )}
      {item.status === 'failed' && (
        <button type="button" class="btn" onClick={() => retryUpload(item.key)}>
          {t.retry}
        </button>
      )}
    </li>
  );
}

// Warn before closing the tab in the middle of an upload.
window.addEventListener('beforeunload', (e) => {
  if (isUploading()) e.preventDefault();
});
