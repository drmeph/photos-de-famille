import { t } from '../i18n';
import { enqueueUploads } from '../data';
import { href, navigate } from '../router';

/**
 * A <label> wrapping a hidden file input: one tap opens the phone's chooser,
 * which offers both "Take photo" (camera) and the photo library.
 * accept="image/*" also makes iPhones convert HEIC to JPEG for us.
 */
export function AddPhotosButton({ label = t.addPhotos, class: cls = 'btn btn-primary btn-big' }: { label?: string; class?: string }) {
  const onChange = (e: Event) => {
    const input = e.currentTarget as HTMLInputElement;
    if (input.files?.length) {
      enqueueUploads(input.files);
      if (!location.hash.startsWith('#/upload')) navigate(href.upload());
    }
    input.value = ''; // allow picking the same file again
  };
  return (
    <label class={cls}>
      <span aria-hidden="true">＋</span> {label}
      <input type="file" accept="image/*,.heic,.heif" multiple onChange={onChange} class="visually-hidden" />
    </label>
  );
}
