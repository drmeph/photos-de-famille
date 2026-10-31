import { useState } from 'preact/hooks';
import type { Person } from '../../shared/types';
import { t } from '../i18n';
import { Icon } from './Icon';

interface Props {
  people: Person[];
  selected: string[];
  onToggle: (id: string) => void;
  /** If given, show an "Add a person" button that creates a new name. */
  onAdd?: (name: string) => Promise<void>;
}

/** Big tappable name buttons with an initials avatar. Selected ones are filled and show a check. */
export function PersonChips({ people, selected, onToggle, onAdd }: Props) {
  return (
    <div class="chips">
      {people.map((p) => {
        const on = selected.includes(p.id);
        return (
          <button key={p.id} type="button" class={on ? 'chip chip-on' : 'chip'} aria-pressed={on} onClick={() => onToggle(p.id)}>
            <Avatar name={p.name} checked={on} />
            <span>{p.name}</span>
          </button>
        );
      })}
      {onAdd && <AddPerson onAdd={onAdd} />}
    </div>
  );
}

export function Avatar({ name, checked = false }: { name: string; checked?: boolean }) {
  return (
    <span class="avatar" style={{ '--hue': hueOf(name) }} aria-hidden="true">
      {checked ? <Icon name="check" size={18} /> : initials(name)}
    </span>
  );
}

/** "Mamie Jeanne" -> "MJ", "Léo" -> "L" */
export function initials(name: string): string {
  const words = name.split(/[\s-]+/).filter(Boolean);
  return words
    .slice(0, 2)
    .map((w) => w[0].toLocaleUpperCase())
    .join('');
}

/** A stable, pleasant hue per name, so each person keeps the same color everywhere. */
function hueOf(name: string): number {
  let h = 0;
  for (const c of name) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return h % 360;
}

function AddPerson({ onAdd }: { onAdd: (name: string) => Promise<void> }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);

  if (!open) {
    return (
      <button type="button" class="chip chip-add" onClick={() => setOpen(true)}>
        <span class="avatar avatar-add" aria-hidden="true">
          <Icon name="plus" size={18} />
        </span>
        <span>{t.addPerson}</span>
      </button>
    );
  }

  const submit = async (e: Event) => {
    e.preventDefault();
    if (!name.trim() || busy) return;
    setBusy(true);
    try {
      await onAdd(name.trim());
      setName('');
      setOpen(false);
    } catch {
      alert(t.errorGeneric);
    } finally {
      setBusy(false);
    }
  };

  return (
    <form class="add-person" onSubmit={submit}>
      <input
        type="text"
        class="input"
        value={name}
        onInput={(e) => setName(e.currentTarget.value)}
        placeholder={t.newPersonPlaceholder}
        aria-label={t.newPersonPlaceholder}
        maxLength={60}
        autoFocus
        autoComplete="off"
        autoCapitalize="words"
      />
      <div class="row">
        <button type="submit" class="btn btn-primary" disabled={busy || !name.trim()}>
          {t.add}
        </button>
        <button type="button" class="btn btn-ghost" onClick={() => setOpen(false)}>
          {t.cancel}
        </button>
      </div>
    </form>
  );
}
