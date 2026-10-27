import { useState } from 'preact/hooks';
import type { Person } from '../../shared/types';
import { t } from '../i18n';

interface Props {
  people: Person[];
  selected: string[];
  onToggle: (id: string) => void;
  /** If given, show an "Add a person" button that creates a new name. */
  onAdd?: (name: string) => Promise<void>;
}

/** Big tappable name buttons. Selected ones are filled and show a check mark. */
export function PersonChips({ people, selected, onToggle, onAdd }: Props) {
  return (
    <div class="chips">
      {people.map((p) => {
        const on = selected.includes(p.id);
        return (
          <button key={p.id} type="button" class={on ? 'chip chip-on' : 'chip'} aria-pressed={on} onClick={() => onToggle(p.id)}>
            {on ? '✓ ' : ''}
            {p.name}
          </button>
        );
      })}
      {onAdd && <AddPerson onAdd={onAdd} />}
    </div>
  );
}

function AddPerson({ onAdd }: { onAdd: (name: string) => Promise<void> }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);

  if (!open) {
    return (
      <button type="button" class="chip chip-add" onClick={() => setOpen(true)}>
        ＋ {t.addPerson}
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
        value={name}
        onInput={(e) => setName(e.currentTarget.value)}
        placeholder={t.newPersonPlaceholder}
        aria-label={t.newPersonPlaceholder}
        maxLength={60}
        autoFocus
        autoComplete="off"
        autoCapitalize="words"
      />
      <button type="submit" class="btn btn-primary" disabled={busy || !name.trim()}>
        {t.add}
      </button>
      <button type="button" class="btn" onClick={() => setOpen(false)}>
        {t.cancel}
      </button>
    </form>
  );
}
