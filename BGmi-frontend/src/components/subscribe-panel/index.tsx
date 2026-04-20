import { Box, Flex, Text } from '@chakra-ui/react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';

import { useColorMode } from '~/hooks/use-color-mode';
import type { WeekCalendar } from '~/types/calendar';
import SubscribeCard from './subscribe-card';

interface Props {
  bangumis: WeekCalendar[] | undefined;
  standalone?: boolean;
}

const MotionBox = motion(Box);
const ITEM_EASE = [0.22, 1, 0.36, 1] as const;

export default function SubscribePanel({ bangumis, standalone = false }: Props) {
  const { colorMode } = useColorMode();
  const reduceMotion = useReducedMotion();
  const isDark = colorMode === 'dark';
  const sharedProps = {
    display: 'grid',
    gridTemplateColumns: {
      base: 'repeat(2, minmax(0, 1fr))',
      sm: 'repeat(2, minmax(0, 1fr))',
      md: 'repeat(auto-fill, minmax(15.5rem, 1fr))',
      lg: 'repeat(auto-fill, minmax(16rem, 1fr))',
    },
    gridTemplateRows: '1fr',
    justifyContent: 'stretch',
    gap: { base: 3, md: 5, lg: 6 },
    pb: { base: 'calc(env(safe-area-inset-bottom, 0px) + 7.5rem)', lg: '0' },
  } as const;

  const emptyState = (
    <MotionBox
      minH={{ base: '11rem', md: '13rem' }}
      align="center"
      justify="center"
      display="flex"
      rounded="2xl"
      borderWidth="1px"
      borderColor={isDark ? 'whiteAlpha.120' : 'rgba(255,255,255,0.72)'}
      bg={isDark ? 'rgba(18,24,36,0.38)' : 'rgba(255,255,255,0.42)'}
      boxShadow={
        isDark
          ? '0 16px 32px rgba(0,0,0,0.16), inset 0 1px 0 rgba(255,255,255,0.05)'
          : '0 16px 32px rgba(15,23,42,0.08), inset 0 1px 0 rgba(255,255,255,0.52)'
      }
      backdropFilter="blur(18px) saturate(160%)"
      px="4"
      textAlign="center"
      gridColumn="1 / -1"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
    >
      <Text color={isDark ? 'whiteAlpha.760' : '#5b6b7c'} fontSize={{ base: 'sm', md: 'md' }}>
        暂无可显示的番剧
      </Text>
    </MotionBox>
  );

  const content = bangumis?.length ? (
    <AnimatePresence initial={false}>
      {bangumis.map((bangumi, index) => (
        <MotionBox
          key={bangumi.id}
          layout
          initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 10, scale: 0.985 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: -6, scale: 0.992 }}
          transition={
            reduceMotion
              ? { duration: 0.14 }
              : { duration: 0.24, delay: Math.min(index * 0.018, 0.12), ease: ITEM_EASE }
          }
        >
          <SubscribeCard bangumi={bangumi} />
        </MotionBox>
      ))}
    </AnimatePresence>
  ) : (
    emptyState
  );

  return <Box {...sharedProps}>{content}</Box>;
}
