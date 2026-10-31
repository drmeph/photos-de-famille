import { useEffect, useState } from 'preact/hooks';
import { AddPhotosButton } from '../components/AddPhotosButton';
import { Icon } from '../components/Icon';
import { clearFinishedUploads, enqueueUploads, isUploading, retryUpload, uploads, type UploadItem } from '../data';
import { t } from '../i18n';
import { useIsDesktop } from '../lib/device';
import { useStore } from '../lib/store';
import { href, linkClick, navigate } from '../router';

export function UploadView() {
  const items = useStore(uploads);
  const busy = items.some((u) => u.status === 'waiting' || u.status === 'preparing' || u.status === 'uploading');
  const done = items.filter((u) => u.status === 'done' || u.status === 'duplicate').length;
  const desktop = useIsDesktop();
  const dragging = useFileDrop(desktop);

  const finish = () => {
    clearFinishedUploads();
    navigate(href.timeline(), true);
  };

  useEffect(() => {
    document.body.classList.add('no-scroll');
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && finish();
    document.addEventListener('keydown', onKey);
    return () => {
      document.body.classList.remove('no-scroll');
      document.removeEventListener('keydown', onKey);
    };
  }, []);

  return (
    <div class="modal-layer">
      <div class="backdrop" onClick={finish} />
      <div class={dragging ? 'modal is-dragging' : 'modal'} role="dialog" aria-modal="true" aria-labelledby="upload-title">
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
          {desktop && <DropZone compact={items.length > 0} active={dragging} />}
        </div>

        {(!desktop || (!busy && items.length > 0)) && (
          <footer class="modal-footer">
            {!busy && items.length > 0 && (
              <button type="button" class="btn btn-primary btn-block" onClick={finish}>
                <Icon name="check" />
                <span>
                  {t.allDone} {t.backToAlbum}
                </span>
              </button>
            )}
            {/* On desktop the drop zone has its own "Choose photos" button. */}
            {!desktop && (
              <AddPhotosButton
                label={items.length ? t.chooseMore : t.addPhotos}
                class={busy || items.length ? 'btn btn-ghost btn-block' : 'btn btn-primary btn-block'}
              />
            )}
          </footer>
        )}
      </div>
    </div>
  );
}

/**
 * While the window is open on desktop, photos dragged from a folder can be dropped anywhere
 * on the screen (not just on the zone), so a slightly-off drop doesn't make the browser open
 * the image instead. Returns whether files are being dragged over the page.
 */
function useFileDrop(enabled: boolean): boolean {
  const [dragging, setDragging] = useState(false);
  useEffect(() => {
    if (!enabled) return;
    let depth = 0; // dragenter/dragleave also fire when moving between child elements
    const hasFiles = (e: DragEvent) => e.dataTransfer?.types.includes('Files') ?? false;
    const onEnter = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      e.preventDefault();
      depth++;
      setDragging(true);
    };
    const onOver = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      e.preventDefault(); // allows dropping
      e.dataTransfer!.dropEffect = 'copy';
    };
    const onLeave = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      depth = Math.max(0, depth - 1);
      if (depth === 0) setDragging(false);
    };
    const onDrop = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      e.preventDefault();
      depth = 0;
      setDragging(false);
      if (e.dataTransfer!.files.length) enqueueUploads(e.dataTransfer!.files);
    };
    window.addEventListener('dragenter', onEnter);
    window.addEventListener('dragover', onOver);
    window.addEventListener('dragleave', onLeave);
    window.addEventListener('drop', onDrop);
    return () => {
      window.removeEventListener('dragenter', onEnter);
      window.removeEventListener('dragover', onOver);
      window.removeEventListener('dragleave', onLeave);
      window.removeEventListener('drop', onDrop);
    };
  }, [enabled]);
  return dragging;
}

/** The invitation to drag photos in (desktop only), with a regular file chooser as backup. */
function DropZone({ compact, active }: { compact: boolean; active: boolean }) {
  const title = active ? t.dropRelease : compact ? t.dropMore : t.dropTitle;
  return (
    <div class={`dropzone${compact ? ' is-compact' : ''}${active ? ' is-active' : ''}`}>
      <span class="dropzone-icon" aria-hidden="true">
        <Icon name="image" size={compact ? 26 : 44} />
      </span>
      <p class="dropzone-title">{title}</p>
      {!compact && <p class="muted">{t.dropHint}</p>}
      {!compact && <span class="dropzone-or">{t.dropOr}</span>}
      <AddPhotosButton direct label={t.chooseFiles} class={compact ? 'btn btn-ghost btn-small' : 'btn btn-primary'} />
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
