import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

const PAGE_SIZE = 8;

/** How many cards must remain before the next page is requested. */
const PREFETCH_THRESHOLD = 5;

const FIRST_NAMES = [
  'Ava',
  'Mia',
  'Lena',
  'Noa',
  'Nina',
  'Ella',
  'Zoe',
  'Mila',
  'Luca',
  'Leo',
  'Maja',
  'Oli',
  'Alex',
  'Emi',
  'Sara',
  'Lia',
  'Kai',
  'Max',
];

const LAST_NAMES = [
  'Nowak',
  'Smith',
  'Garcia',
  'Lee',
  'Kowalski',
  'Khan',
  'Lopez',
  'Novak',
  'Kim',
  'Dubois',
  'Ivanov',
  'Silva',
];

const BIOS = [
  'always down for sunset walks and random coffee runs.',
  'looking for someone to explore hidden city spots with.',
  'playlist curator, dog person, and weekend traveler.',
  'gym in the morning, tacos in the evening.',
  'i collect vintage cameras and good conversations.',
  'new in town and trying every cozy cafe.',
];

/**
 * Profile row shown on swipe cards; matches what a future discover API would return.
 */
export interface SwipeProfile {
  id: string;
  displayName: string;
  age: number;
  imageUri: string;
  bio: string;
}

/**
 * Infinite mock discover queue with prefetch: when the buffer shrinks to `PREFETCH_THRESHOLD`
 * or below, `loadMore` runs automatically. Swap `buildMockPage` for `useInfiniteQuery` later.
 */
export function useSwipeFeed() {
  const [profiles, setProfiles] = useState<SwipeProfile[]>(() => buildMockPage(0, PAGE_SIZE));
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const loadingLockRef = useRef(false);
  /** Next global index for mock rows so refetches never reuse `id`s after the queue was empty. */
  const nextMockIndexRef = useRef(PAGE_SIZE);

  const hasMore = useMemo(() => true, []);

  const loadMore = useCallback(() => {
    if (loadingLockRef.current || !hasMore) return;
    loadingLockRef.current = true;
    setIsLoadingMore(true);
    const start = nextMockIndexRef.current;
    nextMockIndexRef.current += PAGE_SIZE;
    const page = buildMockPage(start, PAGE_SIZE);
    setProfiles((prev) => {
      requestAnimationFrame(() => {
        loadingLockRef.current = false;
        setIsLoadingMore(false);
      });
      return [...prev, ...page];
    });
  }, [hasMore]);

  useEffect(() => {
    if (profiles.length <= PREFETCH_THRESHOLD && hasMore && !loadingLockRef.current) {
      loadMore();
    }
  }, [profiles.length, hasMore, loadMore]);

  /** Removes the front card after its dismiss animation finishes. */
  const dismissFront = useCallback(() => {
    setProfiles((q) => q.slice(1));
  }, []);

  /** Restarts the mock feed from scratch (e.g. empty-state CTA). */
  const resetFeed = useCallback(() => {
    loadingLockRef.current = false;
    setIsLoadingMore(false);
    nextMockIndexRef.current = PAGE_SIZE;
    setProfiles(buildMockPage(0, PAGE_SIZE));
  }, []);

  return {
    profiles,
    loadMore,
    hasMore,
    isLoading: false,
    isLoadingMore,
    dismissFront,
    resetFeed,
  };
}

function buildMockPage(startIndex: number, pageSize: number): SwipeProfile[] {
  return Array.from({ length: pageSize }, (_, offset) => {
    const index = startIndex + offset;
    const firstName = FIRST_NAMES[index % FIRST_NAMES.length];
    const lastName = LAST_NAMES[(index * 3) % LAST_NAMES.length];
    const age = 19 + ((index * 7) % 12);
    const bio = BIOS[index % BIOS.length];
    return {
      id: `swipe-profile-${index}`,
      displayName: `${firstName} ${lastName}`,
      age,
      imageUri: `https://i.pravatar.cc/600?img=${(index % 70) + 1}`,
      bio,
    };
  });
}
