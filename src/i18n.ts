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
