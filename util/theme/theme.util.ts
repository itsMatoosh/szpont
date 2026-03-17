/** Semantic color tokens shared between NativeWind (CSS) and React Navigation. */
export const Colors = {
  light: {
    background: '#FAFAFA',
    foreground: '#262626',
    surface: '#FFFFFF',
    primary: '#FFFFFF',
    accent: '#CCFF00',
    onPrimary: '#262626',
    onAccent: '#262626',
    muted: '#8E8E8E',
    border: '#DBDBDB',
    highlight: '#ECECEC',
  },
  dark: {
    background: '#000000',
    foreground: '#F5F5F5',
    surface: '#1C1C1C',
    primary: '#000000',
    accent: '#CCFF00',
    onPrimary: '#F5F5F5',
    onAccent: '#262626',
    muted: '#8E8E8E',
    border: '#262626',
    highlight: '#2A2A2A',
  },
} as const;
