/** Polish translations for the Szpont website. */
export const pl = {
  meta: {
    title: 'Szpont — poznawaj nowych ludzi na mieście',
    description: 'Szpont aktywuje strefy spotkań w Twoim mieście każdego weekendu. Swipuj, matchuj się i spotykaj na żywo.',
  },

  hero: {
    titleBefore: 'wyjścia na miasto są lepsze kiedy ',
    titleAccent: 'poznajesz nowych ludzi',
  },

  waitlist: {
    placeholder: 'twój email',
    button: 'dołącz do listy',
    success: 'jesteś nr. {{number}} na liście! 🚀',
    alreadyOnList: 'już jesteś na liście.',
    error: 'coś poszło nie tak. spróbuj ponownie.',
    invalidEmail: 'podaj prawidłowy adres email.',
    suggestZoneLink: 'zaproponuj nową strefę',
  },

  slide2: {
    titleBefore: 'znajdź ',
    titleAccent: 'swoją ekipę',
    subtitle: 'dodawaj ludzi, z którymi chcesz się poznać.\nmożesz to robić przez cały tydzień.',
  },

  slide3: {
    titleBefore: 'w piątek i sobotę odpalamy ',
    titleAccent: 'strefy spotkań',
    titleAfter: ' w całym mieście',
  },

  slide4: {
    titleBefore: 'kiedy wejdziesz do strefy, ',
    titleAccent: 'inni mogą do Ciebie podchodzić',
    subtitle: 'Twoja lokalizacja jest widoczna tylko dla osób, które polubiłeś(aś).',
  },

  slide5: {
    titleBefore: 'nie bój się zagadać, masz ',
    titleAccent: 'zielone światło',
    subtitle: 'na mapie są widoczne tylko osoby, które już wysłały Ci lajka. chętnie się z tobą poznają!',
  },

  zones: {
    title: 'nasze strefy spotkań',
    subtitle: 'strefy to prawdziwe miejsca w twoim mieście, w których możesz poznać ludzi, których polubiłeś. w każdy piątek i sobotę aktywujemy je dla ciebie.',
    activeLabel: 'aktywne strefy',
    proposedLabel: 'proponowane strefy',
    likeButton: 'lubię',
    liked: 'polubione',
    noProposed: 'brak proponowanych stref',
    suggestButton: 'zaproponuj nową strefę',
    backToHome: 'wróć na stronę główną',
  },

  cityMap: {
    suggestButton: 'zaproponuj nową strefę',
    back: 'wróć',
    activeZones: 'aktywne strefy',
    suggestedZones: 'proponowane strefy',
  },

  suggestZone: {
    title: 'zaproponuj nową strefę',
    nameLabel: 'nazwa strefy',
    namePlaceholder: 'np. Rynek Starego Miasta',
    cityLabel: 'miasto',
    cityPlaceholder: 'wybierz miasto',
    cityOther: 'inne',
    cityOtherPlaceholder: 'wpisz nazwę miasta',
    motivationLabel: 'motywacja',
    motivationPlaceholder: 'napisz, dlaczego ta strefa powinna być na Szponcie. czy to miejsce nocnych wyjść? popularne miejsce weekendowe? jaki ma klimat?',
    attendanceLabel: 'typowa weekendowa frekwencja',
    attendancePlaceholder: 'wybierz zakres',
    boundaryLabel: 'granica strefy (GeoJSON)',
    boundaryHelper: 'możesz narysować granicę strefy na',
    boundaryHelperLink: 'geojson.io',
    boundaryHelperAfter: 'i eksportować plik.',
    boundaryButton: 'wybierz plik',
    boundaryNone: 'nie wybrano pliku',
    emailLabel: 'twój email',
    emailPlaceholder: 'email@example.com',
    submit: 'wyślij propozycję',
    success: 'dzięki! twoja propozycja została wysłana.',
    error: 'coś poszło nie tak. spróbuj ponownie.',
  },

  validation: {
    required: 'to pole jest wymagane.',
    minChars: 'musi mieć co najmniej {{min}} znaków.',
    invalidEmail: 'podaj prawidłowy adres email.',
    invalidJson: 'plik nie zawiera prawidłowego JSON.',
    selectOption: 'wybierz opcję.',
  },

  scrollHint: 'przewiń w dół, aby zobaczyć więcej',

  footer: {
    joinWaitlist: 'dołącz do listy',
    instagram: 'obserwuj codzienny progres na Instagramie @szpont.app',
    copyright: '© 2026 Szpont. wszelkie prawa zastrzeżone.',
  },
} as const;
