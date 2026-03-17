import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';

const STORAGE_KEY = 'hasSeenWelcome';

interface WelcomeContextValue {
  hasSeenWelcome: boolean;
  /** Persists the flag and flips the guard so the navigator switches to login. */
  completeWelcome: () => void;
}

const WelcomeContext = createContext<WelcomeContextValue>({
  hasSeenWelcome: false,
  completeWelcome: () => { },
});

/** Provides `hasSeenWelcome` state backed by localStorage for the root navigator guards. */
export function WelcomeProvider({ children }: { children: ReactNode }) {
  const [hasSeenWelcome, setHasSeenWelcome] = useState(
    () => !!localStorage.getItem(STORAGE_KEY),
  );

  const completeWelcome = useCallback(() => {
    localStorage.setItem(STORAGE_KEY, '1');
    setHasSeenWelcome(true);
  }, []);

  return (
    <WelcomeContext.Provider value={{ hasSeenWelcome, completeWelcome }}>
      {children}
    </WelcomeContext.Provider>
  );
}

/** Returns `hasSeenWelcome` flag and `completeWelcome` setter. */
export function useWelcome() {
  return useContext(WelcomeContext);
}
