import { useCallback } from 'react';

import { useAtom } from 'jotai';
import { atomWithStorage } from 'jotai/utils';

export interface CurrentWatchHistoryItem {
  episode: string;
  currentTime?: string;
}

export interface WatchHistoryItem {
  [episode: string]: 'mark' | CurrentWatchHistoryItem | undefined;
  'current-watch': CurrentWatchHistoryItem | undefined;
}

export interface WatchHistory {
  [name: string]: WatchHistoryItem | undefined;
}

export const watchHistoryAtom = atomWithStorage<WatchHistory>('watch-history', {});
export const useWatchHistory = () => useAtom(watchHistoryAtom);

export const useVideoCurrentTime = (bangumiName: string) => {
  const updateCurrentTime = useCallback(
    (currentTime: number) => {
      const watchHistoryJson = localStorage.getItem('watch-history') ?? '{}';
      const watchHistory = JSON.parse(watchHistoryJson) as WatchHistory;
      const newWatchHistory = {
        ...watchHistory,
        [bangumiName]: {
          ...watchHistory[bangumiName],
          'current-watch': {
            ...(watchHistory[bangumiName]?.['current-watch'] || {}),
            currentTime,
          },
        },
      };

      localStorage.setItem('watch-history', JSON.stringify(newWatchHistory));
    },
    [bangumiName]
  );

  const getCurrentTime = useCallback((): number => {
    const watchHistoryJson = localStorage.getItem('watch-history') ?? '{}';
    const watchHistory = JSON.parse(watchHistoryJson) as WatchHistory;
    const currentTime = watchHistory[bangumiName]?.['current-watch']?.currentTime ?? '0';

    return parseFloat(currentTime);
  }, [bangumiName]);

  return {
    updateCurrentTime,
    getCurrentTime,
  };
};
