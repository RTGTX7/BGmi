import { Stack } from '@chakra-ui/react';
import { useMemo } from 'react';
import { useAtomValue } from 'jotai';

import BangumiGroupSection from '~/components/bangumi/group-section';
import { bangumiFilterAtom, useBangumi } from '~/hooks/use-bangumi';
import { buildSeasonGroups } from '~/lib/bangumi';

export default function Bangumi() {
  const { data, kind } = useBangumi();
  const bangumiShow = useAtomValue(bangumiFilterAtom);

  const bangumiData = useMemo(() => {
    if (!data) return undefined;
    if (bangumiShow === 'new') return kind?.new;
    if (bangumiShow === 'old') return kind?.old;
    return data;
  }, [bangumiShow, data, kind?.new, kind?.old]);

  const groupedData = useMemo(() => {
    if (!bangumiData?.data?.length) return undefined;
    return buildSeasonGroups(bangumiData.data);
  }, [bangumiData]);

  if (!bangumiData || !groupedData) return null;

  const { seasonGroups, unknownItems } = groupedData;

  return (
    <Stack spacing={{ base: '4', md: '6' }}>
      {seasonGroups.map(group => (
        <BangumiGroupSection
          key={group.seasonKey}
          title={group.title}
          href={`/bangumi-group/${group.seasonKey}`}
          bangumis={group.items}
        />
      ))}

      {unknownItems.length > 0 ? (
        <BangumiGroupSection
          title="其他番剧"
          subtitle="未匹配到季度来源的条目"
          href="/bangumi-group/unknown"
          bangumis={unknownItems}
        />
      ) : null}
    </Stack>
  );
}
