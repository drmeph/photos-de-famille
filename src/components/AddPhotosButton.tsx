import { enqueueUploads } from '../data';
import { t } from '../i18n';
import { isDesktop } from '../lib/device';
import { href, navigate } from '../router';
import { Icon } from './Icon';

interface Props {
  label?: string;
  class?: string;
  /** Always open the file chooser, even on desktop (used inside the upload window itself). */
  direct?: boolean;
}

/**
 * A <label> wrapping a hidden file input. On phones and tablets one tap opens the chooser,
 * which offers both "Take photo" (camera) and the photo library; accept="image/*" also makes
 * iPhones convert HEIC to JPEG for us. On desktop it opens the upload window instead, where
 * photos can be dragged in from a folder.
 */
export function AddPhotosButton({ label = t.addPhotos, class: cls = 'btn btn-primary', direct = false }: Props) {
  // Clicking the label (or pressing Enter on the input) fires a click on the input: stop it
  // there on desktop so the file dialog doesn't open, and show the drop window instead.
  const onClick = (e: MouseEvent) => {
    if (direct || !isDesktop()) return;
    e.preventDefault();
    navigate(href.upload());
  };
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
      <Icon name="plus" />
      <span>{label}</span>
      <input type="file" accept="image/*,.heic,.heif" multiple onClick={onClick} onChange={onChange} class="visually-hidden" />
    </label>
  );
}
