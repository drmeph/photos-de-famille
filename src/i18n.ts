// All interface text lives here. Which language is used comes from the family's
// settings (ALBUM_LANGUAGE), or each visitor's browser when that is 'auto'.
import { resolveLanguage, titleFor, type Language } from '../shared/config';
import { config } from './config';

const fr = {
  addPhotos: 'Ajouter des photos',
  addPhotosHint: 'Prendre une photo ou choisir dans la galerie',
  back: 'Retour',
  close: 'Fermer',
  previous: 'Précédente',
  next: 'Suivante',
  loading: 'Chargement…',
  retry: 'Réessayer',
  errorGeneric: 'Une erreur est survenue. Vérifiez la connexion et réessayez.',

  emptyAlbum: "L'album est vide. Ajoutez la première photo !",
  noMatch: 'Aucune photo ne correspond à ces filtres.',
  photoCount: (n: number) => (n === 1 ? '1 photo' : `${n} photos`),

  filters: 'Rechercher',
  hideFilters: 'Masquer la recherche',
  whoFilter: 'Qui est sur la photo ?',
  fromYear: 'De',
  toYear: 'à',
  anyYear: '—',
  clearFilters: 'Tout effacer',
  jumpToYear: 'Aller à l’année',

  whoIsInPhoto: 'Qui est sur cette photo ?',
  nobodyTagged: 'Personne n’est encore indiqué. Touchez un nom ci-dessous.',
  addPerson: 'Ajouter une personne',
  newPersonPlaceholder: 'Prénom et nom',
  add: 'Ajouter',
  cancel: 'Annuler',
  saving: 'Enregistrement…',
  saved: 'Enregistré',

  date: 'Date',
  dateFromCamera: 'date de l’appareil photo',
  dateFromUpload: 'date d’ajout (inconnue)',
  dateManual: 'date corrigée à la main',
  changeDate: 'Corriger la date',
  save: 'Enregistrer',
  caption: 'Légende',
  captionPlaceholder: 'Où ? Quelle occasion ? (facultatif)',
  addedBy: (who: string, when: string) => `Ajoutée par ${who} le ${when}`,
  downloadOriginal: 'Télécharger l’original',

  uploadTitle: 'Ajouter des photos',
  chooseMore: 'Ajouter d’autres photos',
  preparing: 'Préparation…',
  uploading: 'Envoi…',
  uploaded: 'Ajoutée',
  duplicate: 'Déjà dans l’album',
  failed: 'Échec',
  tagThis: 'Qui est dessus ?',
  allDone: 'Terminé !',
  backToAlbum: 'Voir l’album',
  keepPageOpen: 'Gardez cette page ouverte pendant l’envoi.',
  emptyTitle: 'Votre album est prêt',
  emptyText: 'Ajoutez les premières photos : celles de votre téléphone, ou de vieilles photos prises en photo.',
  who: 'Qui ?',
  when: 'Quand ?',
  years: 'Années',
  showResults: (n: number) => (n === 0 ? 'Aucune photo' : n === 1 ? 'Voir la photo' : `Voir les ${n} photos`),
  removeFilter: (what: string) => `Retirer le filtre ${what}`,
  photoPosition: (i: number, n: number) => `${i} sur ${n}`,
  onThisPhoto: 'Sur cette photo',
  tapToTag: 'Touchez les noms des personnes présentes.',
  addCaption: 'Ajouter une légende',
  uploadHint: 'Les photos sont ajoutées une par une. Vous pouvez continuer à regarder l’album.',
  welcomeTitle: 'Bienvenue dans l’album !',
  welcomeText: 'Comment vous appelez-vous ? Votre prénom sera affiché sur les photos que vous ajoutez et avec vos commentaires.',
  continue: 'Continuer',
  later: 'Plus tard',
  byName: (name: string) => `par ${name}`,
  sortBy: 'Trier les photos',
  sortDate: 'Par date',
  sortAdded: 'Derniers ajouts',
  today: 'Aujourd’hui',
  yesterday: 'Hier',
  addedEarlier: 'Ajouts plus anciens',
  dropTitle: 'Glissez vos photos ici',
  dropMore: 'Glissez d’autres photos ici',
  dropRelease: 'Relâchez pour ajouter les photos',
  dropHint: 'Depuis un dossier de votre ordinateur, plusieurs à la fois.',
  dropOr: 'ou',
  chooseFiles: 'Choisir des photos',
  comments: 'Commentaires',
  commentCount: (n: number) => (n === 1 ? '1 commentaire' : `${n} commentaires`),
  noComments: 'Pas encore de commentaire. Racontez un souvenir !',
  writeComment: 'Écrire un commentaire…',
  publish: 'Publier',
  publishing: 'Envoi…',
  deleteComment: 'Supprimer',
  confirmDeleteComment: 'Supprimer ce commentaire ?',
  yourName: 'Votre prénom',
  yourNameHint: 'Il sera affiché avec vos commentaires.',
  commentingAs: (name: string) => `En tant que ${name}`,
  changeName: 'Modifier',
  justNow: 'à l’instant',
};

type Strings = typeof fr;

const en: Strings = {
  addPhotos: 'Add photos',
  addPhotosHint: 'Take a photo or choose from your gallery',
  back: 'Back',
  close: 'Close',
  previous: 'Previous',
  next: 'Next',
  loading: 'Loading…',
  retry: 'Try again',
  errorGeneric: 'Something went wrong. Check your connection and try again.',

  emptyAlbum: 'The album is empty. Add the first photo!',
  noMatch: 'No photo matches these filters.',
  photoCount: (n: number) => (n === 1 ? '1 photo' : `${n} photos`),

  filters: 'Search',
  hideFilters: 'Hide search',
  whoFilter: 'Who is in the photo?',
  fromYear: 'From',
  toYear: 'to',
  anyYear: '—',
  clearFilters: 'Clear all',
  jumpToYear: 'Jump to year',

  whoIsInPhoto: 'Who is in this photo?',
  nobodyTagged: 'Nobody is marked yet. Tap a name below.',
  addPerson: 'Add a person',
  newPersonPlaceholder: 'First and last name',
  add: 'Add',
  cancel: 'Cancel',
  saving: 'Saving…',
  saved: 'Saved',

  date: 'Date',
  dateFromCamera: 'camera date',
  dateFromUpload: 'upload date (unknown)',
  dateManual: 'corrected by hand',
  changeDate: 'Fix the date',
  save: 'Save',
  caption: 'Caption',
  captionPlaceholder: 'Where? What occasion? (optional)',
  addedBy: (who: string, when: string) => `Added by ${who} on ${when}`,
  downloadOriginal: 'Download original',

  uploadTitle: 'Add photos',
  chooseMore: 'Add more photos',
  preparing: 'Preparing…',
  uploading: 'Uploading…',
  uploaded: 'Added',
  duplicate: 'Already in the album',
  failed: 'Failed',
  tagThis: 'Who is in it?',
  allDone: 'Done!',
  backToAlbum: 'See the album',
  keepPageOpen: 'Keep this page open while uploading.',
  emptyTitle: 'Your album is ready',
  emptyText: 'Add the first photos: from your phone, or old prints you photograph.',
  who: 'Who?',
  when: 'When?',
  years: 'Years',
  showResults: (n: number) => (n === 0 ? 'No photos' : n === 1 ? 'See the photo' : `See ${n} photos`),
  removeFilter: (what: string) => `Remove filter ${what}`,
  photoPosition: (i: number, n: number) => `${i} of ${n}`,
  onThisPhoto: 'In this photo',
  tapToTag: 'Tap the names of the people in it.',
  addCaption: 'Add a caption',
  uploadHint: 'Photos are added one by one. You can keep browsing the album.',
  welcomeTitle: 'Welcome to the album!',
  welcomeText: 'What’s your name? Your first name will be shown on the photos you add and with your comments.',
  continue: 'Continue',
  later: 'Later',
  byName: (name: string) => `by ${name}`,
  sortBy: 'Sort photos',
  sortDate: 'By date',
  sortAdded: 'Latest additions',
  today: 'Today',
  yesterday: 'Yesterday',
  addedEarlier: 'Earlier additions',
  dropTitle: 'Drag your photos here',
  dropMore: 'Drag more photos here',
  dropRelease: 'Drop to add the photos',
  dropHint: 'From a folder on your computer, several at once.',
  dropOr: 'or',
  chooseFiles: 'Choose photos',
  comments: 'Comments',
  commentCount: (n: number) => (n === 1 ? '1 comment' : `${n} comments`),
  noComments: 'No comments yet. Share a memory!',
  writeComment: 'Write a comment…',
  publish: 'Post',
  publishing: 'Posting…',
  deleteComment: 'Delete',
  confirmDeleteComment: 'Delete this comment?',
  yourName: 'Your first name',
  yourNameHint: 'It will be shown with your comments.',
  commentingAs: (name: string) => `As ${name}`,
  changeName: 'Change',
  justNow: 'just now',
};

const STRINGS: Record<Language, Strings> = { fr, en };
const LOCALES: Record<Language, string> = { fr: 'fr-FR', en: 'en-GB' };

export const lang: Language = resolveLanguage(config.language, navigator.languages?.[0] ?? navigator.language);
export const t: Strings = STRINGS[lang];
export const locale = LOCALES[lang];
/** The family's album name, or the default one in this language. */
export const albumTitle = titleFor(config, lang);

/** "2019-07-14T15:32:10" -> "dimanche 14 juillet 2019" */
export function formatDate(local: string, withWeekday = true): string {
  const [y, m, d] = local.slice(0, 10).split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(locale, {
    weekday: withWeekday ? 'long' : undefined,
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

/** "il y a 40 ans" / "40 years ago"; null for photos less than a year old. */
export function yearsAgo(local: string): string | null {
  const [y, m, d] = local.slice(0, 10).split('-').map(Number);
  const now = new Date();
  let years = now.getFullYear() - y;
  if (now.getMonth() + 1 < m || (now.getMonth() + 1 === m && now.getDate() < d)) years--;
  return years >= 1 ? new Intl.RelativeTimeFormat(locale, { numeric: 'auto' }).format(-years, 'year') : null;
}

/** "2019-07" -> "juillet" (or "juil." when short) */
export function formatMonthName(yearMonth: string, short = false): string {
  const [y, m] = yearMonth.split('-').map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString(locale, { month: short ? 'short' : 'long' });
}

/** "il y a 3 jours" / "3 days ago"; the date itself for anything older than four weeks. */
export function timeAgo(iso: string): string {
  const seconds = (Date.now() - new Date(iso).getTime()) / 1000;
  if (seconds < 60) return t.justNow;
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });
  if (seconds < 3600) return rtf.format(-Math.floor(seconds / 60), 'minute');
  if (seconds < 86400) return rtf.format(-Math.floor(seconds / 3600), 'hour');
  if (seconds < 28 * 86400) return rtf.format(-Math.floor(seconds / 86400), 'day');
  return new Date(iso).toLocaleDateString(locale, { day: 'numeric', month: 'long', year: 'numeric' });
}

/** "Aujourd'hui", "Hier", "lundi 27 octobre" (with the year if it isn't this year). '' = date unknown. */
export function formatAddedDay(day: string): string {
  if (!day) return t.addedEarlier;
  const [y, m, d] = day.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  const today = new Date();
  const yesterday = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 1);
  const same = (a: Date, b: Date) => a.toDateString() === b.toDateString();
  if (same(date, today)) return t.today;
  if (same(date, yesterday)) return t.yesterday;
  return date.toLocaleDateString(locale, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: y === today.getFullYear() ? undefined : 'numeric',
  });
}
