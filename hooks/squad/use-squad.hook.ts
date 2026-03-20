import { useCallback, useEffect, useMemo, useState } from 'react';

const PAGE_SIZE = 12;

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

/**
 * UI-ready mock representation of a squad member shown in the squad tab grid.
 */
export interface SquadMember {
  id: string;
  displayName: string;
  age: number;
  avatarUrl: string;
}

interface MockMember extends SquadMember {
  activityScore: number;
}

/**
 * Returns an infinitely growing people list for the squad tab until backend data is wired.
 * When `selectedZoneId` is null, it yields squad members; otherwise zone members.
 */
export function useSquad(selectedZoneId: string | null) {
  const [members, setMembers] = useState<MockMember[]>(() =>
    buildMockPage(0, PAGE_SIZE, selectedZoneId),
  );

  useEffect(() => {
    setMembers(buildMockPage(0, PAGE_SIZE, selectedZoneId));
  }, [selectedZoneId]);

  const loadMore = useCallback(() => {
    setMembers((currentMembers) => {
      const nextPage = buildMockPage(currentMembers.length, PAGE_SIZE, selectedZoneId);
      return [...currentMembers, ...nextPage].sort((left, right) => right.activityScore - left.activityScore);
    });
  }, [selectedZoneId]);

  const hasMore = useMemo(() => true, []);

  return {
    members: members.map(({ activityScore, ...member }) => member),
    loadMore,
    hasMore,
  };
}

function buildMockPage(startIndex: number, pageSize: number, selectedZoneId: string | null): MockMember[] {
  return Array.from({ length: pageSize }, (_, offset) => createMockMember(startIndex + offset, selectedZoneId))
    .sort((left, right) => right.activityScore - left.activityScore);
}

function createMockMember(index: number, selectedZoneId: string | null): MockMember {
  const sourceSalt = selectedZoneId ? hashString(selectedZoneId) % 997 : 0;
  const seededIndex = index + sourceSalt;
  const firstName = FIRST_NAMES[seededIndex % FIRST_NAMES.length];
  const lastName = LAST_NAMES[(seededIndex * 3) % LAST_NAMES.length];
  const age = 19 + ((seededIndex * 7) % 12);
  const activityScore = (seededIndex * 29 + 17) % 100;
  const personIdPrefix = selectedZoneId ? `zone-${selectedZoneId}` : 'squad';

  return {
    id: `${personIdPrefix}-member-${index}`,
    displayName: `${firstName} ${lastName}`,
    age,
    avatarUrl: `https://i.pravatar.cc/400?img=${(seededIndex % 70) + 1}`,
    activityScore,
  };
}

function hashString(input: string): number {
  let hash = 0;
  for (let index = 0; index < input.length; index += 1) {
    hash = (hash * 31 + input.charCodeAt(index)) >>> 0;
  }
  return hash;
}
