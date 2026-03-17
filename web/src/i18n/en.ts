/** English translations for the Szpont website. */
export const en = {
  meta: {
    title: 'Szpont — meet new people when you go out',
    description: 'Szpont activates meetup zones in your city every weekend. Swipe, match, and meet in real life.',
  },

  hero: {
    titleBefore: 'going out is more fun when you\'re ',
    titleAccent: 'meeting new people',
  },

  waitlist: {
    placeholder: 'your email',
    button: 'join waitlist',
    success: 'you\'re #{{number}} on the list! 🚀',
    alreadyOnList: 'you\'re already on the list.',
    error: 'something went wrong. try again.',
    invalidEmail: 'enter a valid email address.',
    suggestZoneLink: 'suggest a new zone',
  },

  slide2: {
    titleBefore: 'find ',
    titleAccent: 'your squad',
    subtitle: 'swipe on people you\'d like to meet.\nyou can do this all week long.',
  },

  slide3: {
    titleBefore: 'on friday and saturday we activate ',
    titleAccent: 'meetup zones',
    titleAfter: ' across the city',
  },

  slide4: {
    titleBefore: 'when you enter a zone, ',
    titleAccent: 'others can approach you',
    subtitle: 'Your location will only be visible to people you liked.',
  },

  slide5: {
    titleBefore: 'don\'t be afraid to say hi, you\'ve got the ',
    titleAccent: 'green light',
    subtitle: 'people that you see on the map have already sent you a like. they can\'t wait to meet you!',
  },

  zones: {
    title: 'our meetup zones',
    subtitle: 'zones are real places in your city where you can meet the people you\'ve liked. every friday and saturday, we activate them for you.',
    activeLabel: 'active zones',
    proposedLabel: 'proposed zones',
    likeButton: 'like',
    liked: 'liked',
    noProposed: 'no proposed zones yet',
    suggestButton: 'suggest a new zone',
    backToHome: 'back to home',
  },

  cityMap: {
    suggestButton: 'suggest a new zone',
    back: 'back',
    activeZones: 'active zones',
    suggestedZones: 'suggested zones',
  },

  suggestZone: {
    title: 'suggest a new zone',
    nameLabel: 'zone name',
    namePlaceholder: 'e.g. Old Town Square',
    cityLabel: 'city',
    cityPlaceholder: 'select a city',
    cityOther: 'other',
    cityOtherPlaceholder: 'enter city name',
    motivationLabel: 'motivation',
    motivationPlaceholder: 'say why you think this zone should be on Szpont. is this a nightlife hotspot? a popular place where people go on the weekends? what vibe does this zone have typically?',
    attendanceLabel: 'typical weekend attendance',
    attendancePlaceholder: 'select a range',
    boundaryLabel: 'zone boundary (GeoJSON)',
    boundaryHelper: 'you can draw your zone boundary at',
    boundaryHelperLink: 'geojson.io',
    boundaryHelperAfter: 'and download the file.',
    boundaryButton: 'choose file',
    boundaryNone: 'no file chosen',
    emailLabel: 'your email',
    emailPlaceholder: 'email@example.com',
    submit: 'submit suggestion',
    success: 'thanks! your suggestion has been submitted.',
    error: 'something went wrong. try again.',
  },

  validation: {
    required: 'this field is required.',
    minChars: 'must be at least {{min}} characters.',
    invalidEmail: 'enter a valid email address.',
    invalidJson: 'the file doesn\'t contain valid JSON.',
    selectOption: 'select an option.',
  },

  footer: {
    joinWaitlist: 'join the waitlist',
    copyright: '© 2026 Szpont. all rights reserved.',
  },
} as const;
