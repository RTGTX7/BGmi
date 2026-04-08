import { Box, TabPanel } from '@chakra-ui/react';
import type { WeekCalendar } from '~/types/calendar';
import SubscribeCard from './subscribe-card';

interface Props {
  bangumis: WeekCalendar[] | undefined;
  standalone?: boolean;
}

export default function SubscribePanel({ bangumis, standalone = false }: Props) {
  const sharedProps = {
    display: 'grid',
    gridTemplateColumns: {
      base: 'repeat(auto-fill, minmax(10rem, 1fr))',
      sm: 'repeat(auto-fill, minmax(15.5rem, 1fr))',
      lg: 'repeat(auto-fill, minmax(16rem, 1fr))',
    },
    gridTemplateRows: '1fr',
    justifyContent: 'center',
    gap: { base: 3, md: 5, lg: 6 },
  } as const;

  if (standalone) {
    return <Box {...sharedProps}>{bangumis?.map(bangumi => <SubscribeCard key={bangumi.id} bangumi={bangumi} />)}</Box>;
  }

  return <TabPanel {...sharedProps}>{bangumis?.map(bangumi => <SubscribeCard key={bangumi.id} bangumi={bangumi} />)}</TabPanel>;
}
