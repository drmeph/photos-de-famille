import Foundation

// All interface text, in French and English (same wording as the website's src/i18n.ts).
// The language comes from the family's settings (ALBUM_LANGUAGE), or the phone's when "auto".

public enum Language: String, Sendable {
    case fr, en

    public var locale: Locale { Locale(identifier: self == .fr ? "fr_FR" : "en_GB") }
}

/// French if asked for (or the phone prefers it in "auto" mode), otherwise English.
public func resolveLanguage(_ setting: String, preferred: String?) -> Language {
    if let fixed = Language(rawValue: setting) { return fixed }
    return (preferred ?? "").lowercased().hasPrefix("fr") ? .fr : .en
}

public struct Strings: Sendable {
    public let lang: Language
    public init(_ lang: Language) { self.lang = lang }

    private func s(_ fr: String, _ en: String) -> String { lang == .fr ? fr : en }

    // General
    public var defaultTitle: String { s("Album de famille", "Family album") }
    public var addPhotos: String { s("Ajouter des photos", "Add photos") }
    public var takePhoto: String { s("Prendre une photo", "Take a photo") }
    public var chooseFromLibrary: String { s("Choisir dans mes photos", "Choose from my photos") }
    public var back: String { s("Retour", "Back") }
    public var close: String { s("Fermer", "Close") }
    public var previous: String { s("Précédente", "Previous") }
    public var next: String { s("Suivante", "Next") }
    public var loading: String { s("Chargement…", "Loading…") }
    public var retry: String { s("Réessayer", "Try again") }
    public var errorGeneric: String { s("Une erreur est survenue. Vérifiez la connexion et réessayez.", "Something went wrong. Check your connection and try again.") }
    public var cancel: String { s("Annuler", "Cancel") }
    public var save: String { s("Enregistrer", "Save") }
    public var saving: String { s("Enregistrement…", "Saving…") }
    public var add: String { s("Ajouter", "Add") }
    public var done: String { s("Terminé", "Done") }

    // Timeline
    public var emptyTitle: String { s("Votre album est prêt", "Your album is ready") }
    public var emptyText: String { s("Ajoutez les premières photos : celles de votre téléphone, ou de vieilles photos prises en photo.", "Add the first photos: from your phone, or old prints you photograph.") }
    public var noMatch: String { s("Aucune photo ne correspond à ces filtres.", "No photo matches these filters.") }
    public func photoCount(_ n: Int) -> String { n == 1 ? "1 photo" : "\(n) photos" }
    public func commentCount(_ n: Int) -> String { lang == .fr ? (n == 1 ? "1 commentaire" : "\(n) commentaires") : (n == 1 ? "1 comment" : "\(n) comments") }
    public var sortDate: String { s("Par date", "By date") }
    public var sortAdded: String { s("Derniers ajouts", "Latest additions") }
    public var today: String { s("Aujourd’hui", "Today") }
    public var yesterday: String { s("Hier", "Yesterday") }
    public var addedEarlier: String { s("Ajouts plus anciens", "Earlier additions") }
    public func byName(_ name: String) -> String { s("par \(name)", "by \(name)") }
    public var jumpToYear: String { s("Aller à l’année", "Jump to year") }

    // Search
    public var filters: String { s("Rechercher", "Search") }
    public var who: String { s("Qui ?", "Who?") }
    public var when: String { s("Quand ?", "When?") }
    public var fromYear: String { s("De", "From") }
    public var toYear: String { s("à", "to") }
    public var anyYear: String { "—" }
    public var clearFilters: String { s("Tout effacer", "Clear all") }
    public func showResults(_ n: Int) -> String {
        lang == .fr ? (n == 0 ? "Aucune photo" : n == 1 ? "Voir la photo" : "Voir les \(n) photos")
            : (n == 0 ? "No photos" : n == 1 ? "See the photo" : "See \(n) photos")
    }

    // Photo page
    public func photoPosition(_ i: Int, _ n: Int) -> String { s("\(i) sur \(n)", "\(i) of \(n)") }
    public var onThisPhoto: String { s("Sur cette photo", "In this photo") }
    public var tapToTag: String { s("Touchez les noms des personnes présentes.", "Tap the names of the people in it.") }
    public var addPerson: String { s("Ajouter une personne", "Add a person") }
    public var newPersonPlaceholder: String { s("Prénom et nom", "First and last name") }
    public var date: String { s("Date", "Date") }
    public var dateFromCamera: String { s("date de l’appareil photo", "camera date") }
    public var dateFromUpload: String { s("date d’ajout (inconnue)", "upload date (unknown)") }
    public var dateManual: String { s("date corrigée à la main", "corrected by hand") }
    public var changeDate: String { s("Corriger la date", "Fix the date") }
    public var caption: String { s("Légende", "Caption") }
    public var addCaption: String { s("Ajouter une légende", "Add a caption") }
    public var editCaption: String { s("Modifier la légende", "Edit the caption") }
    public var captionPlaceholder: String { s("Où ? Quelle occasion ? (facultatif)", "Where? What occasion? (optional)") }
    public func addedBy(_ who: String, _ when: String) -> String { s("Ajoutée par \(who) le \(when)", "Added by \(who) on \(when)") }
    public var shareOriginal: String { s("Partager l’original", "Share the original") }

    // Comments
    public var comments: String { s("Commentaires", "Comments") }
    public var noComments: String { s("Pas encore de commentaire. Racontez un souvenir !", "No comments yet. Share a memory!") }
    public var writeComment: String { s("Écrire un commentaire…", "Write a comment…") }
    public var publish: String { s("Publier", "Post") }
    public var deleteComment: String { s("Supprimer", "Delete") }
    public var confirmDeleteComment: String { s("Supprimer ce commentaire ?", "Delete this comment?") }
    public var yourName: String { s("Votre prénom", "Your first name") }
    public var yourNameHint: String { s("Il sera affiché avec vos commentaires.", "It will be shown with your comments.") }
    public func commentingAs(_ name: String) -> String { s("En tant que \(name)", "As \(name)") }
    public var changeName: String { s("Modifier", "Change") }
    public var justNow: String { s("à l’instant", "just now") }

    // Upload
    public var uploadTitle: String { s("Ajouter des photos", "Add photos") }
    public var preparing: String { s("Préparation…", "Preparing…") }
    public var uploading: String { s("Envoi…", "Uploading…") }
    public var uploaded: String { s("Ajoutée", "Added") }
    public var duplicate: String { s("Déjà dans l’album", "Already in the album") }
    public var failed: String { s("Échec", "Failed") }
    public var tagThis: String { s("Qui est dessus ?", "Who is in it?") }
    public var keepAppOpen: String { s("Gardez l’application ouverte pendant l’envoi.", "Keep the app open while uploading.") }

    // First visit
    public var welcomeTitle: String { s("Bienvenue dans l’album !", "Welcome to the album!") }
    public var welcomeText: String { s("Comment vous appelez-vous ? Votre prénom sera affiché sur les photos que vous ajoutez et avec vos commentaires.", "What’s your name? Your first name will be shown on the photos you add and with your comments.") }
    public var continueLabel: String { s("Continuer", "Continue") }
    public var later: String { s("Plus tard", "Later") }

    // Sign-in & settings
    public var loginTitle: String { s("Connexion à l’album", "Sign in to the album") }
    public var loginIntro: String { s("Entrez l’adresse de l’album de votre famille.", "Enter the address of your family’s album.") }
    public var albumAddress: String { s("Adresse de l’album", "Album address") }
    public var connect: String { s("Se connecter", "Sign in") }
    public var familyPassword: String { s("Mot de passe de la famille", "Family password") }
    public var unreachable: String { s("Impossible de joindre cet album. Vérifiez l’adresse et la connexion.", "Can’t reach this album. Check the address and your connection.") }
    public var wrongPassword: String { s("Prénom ou mot de passe incorrect.", "Wrong name or password.") }
    public var sessionExpired: String { s("Votre session a expiré. Reconnectez-vous.", "Your session has expired. Please sign in again.") }
    public var settings: String { s("Réglages", "Settings") }
    public var signedInAs: String { s("Connecté en tant que", "Signed in as") }
    public var signOut: String { s("Se déconnecter", "Sign out") }
    public var confirmSignOut: String { s("Se déconnecter de l’album ?", "Sign out of the album?") }

    // Formatting

    private func formatter(_ template: String) -> DateFormatter {
        let f = DateFormatter()
        f.locale = lang.locale
        f.setLocalizedDateFormatFromTemplate(template)
        return f
    }

    /// "1985-12-24T20:15:00" -> "Mardi 24 décembre 1985" (or without the weekday).
    public func formatDate(_ local: LocalDateTime, weekday: Bool = true) -> String {
        guard let d = LocalDate.date(from: local) else { return local }
        return capitalized(formatter(weekday ? "EEEEdMMMMy" : "dMMMMy").string(from: d))
    }

    /// "1985-12" -> "Décembre" (or "Déc." when short).
    public func monthName(_ yearMonth: String, short: Bool = false) -> String {
        guard let d = LocalDate.date(from: yearMonth + "-01") else { return yearMonth }
        return capitalized(formatter(short ? "MMM" : "MMMM").string(from: d))
    }

    /// "Aujourd’hui", "Hier", "Lundi 27 octobre" (with the year if not this year). "" = unknown.
    public func addedDay(_ day: String, now: Date = Date(), calendar: Calendar = .current) -> String {
        guard !day.isEmpty, let d = LocalDate.date(from: day, calendar: calendar) else { return addedEarlier }
        if calendar.isDate(d, inSameDayAs: now) { return today }
        if let y = calendar.date(byAdding: .day, value: -1, to: now), calendar.isDate(d, inSameDayAs: y) { return yesterday }
        let sameYear = calendar.component(.year, from: d) == calendar.component(.year, from: now)
        return capitalized(formatter(sameYear ? "EEEEdMMMM" : "EEEEdMMMMy").string(from: d))
    }

    /// "il y a 40 ans" / "40 years ago".
    public func yearsAgo(_ years: Int) -> String {
        let f = RelativeDateTimeFormatter()
        f.locale = lang.locale
        f.unitsStyle = .full
        return f.localizedString(from: DateComponents(year: -years))
    }

    /// "il y a 3 jours" / "3 days ago"; the date itself beyond four weeks.
    public func timeAgo(_ iso: String, now: Date = Date()) -> String {
        guard let d = parseISODate(iso) else { return "" }
        let seconds = now.timeIntervalSince(d)
        if seconds < 60 { return justNow }
        if seconds >= 28 * 86400 { return formatter("dMMMMy").string(from: d) }
        let f = RelativeDateTimeFormatter()
        f.locale = lang.locale
        f.unitsStyle = .full
        f.dateTimeStyle = .numeric
        return f.localizedString(for: d, relativeTo: now)
    }

    /// Short date for "added on": "01/11/2026".
    public func shortDate(_ iso: String) -> String {
        guard let d = parseISODate(iso) else { return "" }
        let f = DateFormatter()
        f.locale = lang.locale
        f.dateStyle = .short
        return f.string(from: d)
    }

    private func capitalized(_ s: String) -> String { s.prefix(1).uppercased() + s.dropFirst() }
}
