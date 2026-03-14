import { createContext, type Dispatch, type ReactNode, type SetStateAction, useContext, useState } from 'react';

interface TabBarVisibilityContextValue {
  hidden: boolean;
  setHidden: Dispatch<SetStateAction<boolean>>;
}

const TabBarVisibilityContext = createContext<TabBarVisibilityContextValue | null>(null);

/** Provides a shared boolean that any descendant can flip to hide the native tab bar. */
export function TabBarVisibilityProvider({ children }: { children: ReactNode }) {
  const [hidden, setHidden] = useState(false);

  return (
    <TabBarVisibilityContext.Provider value={{ hidden, setHidden }}>
      {children}
    </TabBarVisibilityContext.Provider>
  );
}

/** Reads and controls the tab bar visibility. Must be used within a TabBarVisibilityProvider. */
export function useTabBarVisibility(): TabBarVisibilityContextValue {
  const ctx = useContext(TabBarVisibilityContext);
  if (!ctx) {
    throw new Error('useTabBarVisibility must be used within a TabBarVisibilityProvider');
  }
  return ctx;
}
