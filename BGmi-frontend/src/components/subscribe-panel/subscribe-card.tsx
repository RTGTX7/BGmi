import { Box, Button, Flex, Image, Text, useDisclosure } from '@chakra-ui/react';
import { useState } from 'react';

import { useColorMode } from '~/hooks/use-color-mode';
import { useSubscribeAction } from '~/hooks/use-subscribe-action';
import { resolveCoverSrc } from '~/lib/utils';

import SubscribeForm from './subscribe-form';

import type { WeekCalendar } from '~/types/calendar';
import type { InitialData } from './subscribe-form';

interface Props {
  bangumi: WeekCalendar;
}

export interface SyncData {
  status: boolean;
  episode: number | undefined;
}

export default function SubscribeCard({ bangumi }: Props) {
  const { colorMode } = useColorMode();
  const isDark = colorMode === 'dark';
  const [imageLoaded, setImageLoaded] = useState(false);
  const { isOpen, onClose, onOpen } = useDisclosure();
  const [initialData, setInitialData] = useState<InitialData>();

  const { handleFetchFilter, handleSubscribe } = useSubscribeAction();
  const [syncData, setSyncData] = useState<SyncData>({
    status: !!bangumi.status,
    episode: bangumi.episode,
  });

  const handleOpen = async (status: boolean, name: string, ep: number) => {
    onOpen();

    if (!status) {
      await handleSubscribe(name, 0);
      setSyncData(current => ({
        ...current,
        status: true,
      }));
    }

    const data = await handleFetchFilter(name);

    setInitialData({
      bangumiName: name,
      completedEpisodes: syncData.episode ?? ep,
      filterOptions: {
        include: data?.data.include ?? '',
        exclude: data?.data.exclude ?? '',
        regex: data?.data.regex ?? '',
      },
      subtitleGroups: data?.data.subtitle_group ?? [],
      follwedSubtitleGroups: data?.data.followed ?? [],
    });
  };

  return (
    <>
      <Box
        role="group"
        position="relative"
        rounded="24px"
        overflow="hidden"
        borderWidth="1px"
        borderColor={isDark ? 'whiteAlpha.120' : 'rgba(255,255,255,0.54)'}
        bg={isDark ? 'rgba(14,20,38,0.22)' : 'rgba(255,255,255,0.22)'}
        boxShadow={isDark ? '0 18px 42px rgba(0,0,0,0.24)' : '0 18px 42px rgba(15,23,42,0.12)'}
        transition="transform 240ms cubic-bezier(0.22, 1, 0.36, 1), box-shadow 240ms ease"
        _hover={{
          transform: 'translateY(-3px) scale(1.008)',
          boxShadow: isDark ? '0 24px 54px rgba(0,0,0,0.30)' : '0 24px 54px rgba(15,23,42,0.16)',
        }}
      >
        <Box position="relative" aspectRatio={3 / 4} w="full" overflow="hidden" bg={isDark ? 'gray.900' : 'gray.100'}>
          <Image
            h="full"
            w="full"
            src={resolveCoverSrc(bangumi.cover)}
            alt={bangumi.name}
            objectFit="cover"
            opacity={imageLoaded ? 1 : 0}
            onLoad={() => setImageLoaded(true)}
            transition="opacity 180ms ease, transform 260ms ease"
            _groupHover={{ transform: 'scale(1.025)' }}
          />

          <Box
            position="absolute"
            inset="0"
            pointerEvents="none"
            bg="linear-gradient(to bottom, rgba(0,0,0,0.02) 34%, rgba(0,0,0,0.18) 62%, rgba(0,0,0,0.56) 100%)"
          />

          <Box
            position="absolute"
            inset="0"
            pointerEvents="none"
            bg={
              isDark
                ? 'radial-gradient(circle at 22% 86%, rgba(83,240,193,0.12), transparent 26%), radial-gradient(circle at 78% 20%, rgba(123,181,255,0.12), transparent 26%)'
                : 'radial-gradient(circle at 20% 84%, rgba(83,240,193,0.16), transparent 28%), radial-gradient(circle at 82% 20%, rgba(123,181,255,0.16), transparent 28%)'
            }
          />

          <Box
            position="absolute"
            left={{ base: '3', md: '3.5' }}
            right={{ base: '3', md: '3.5' }}
            bottom={{ base: '3', md: '3.5' }}
            zIndex="2"
            rounded="22px"
            borderWidth="1px"
            borderColor={isDark ? 'rgba(255,255,255,0.14)' : 'rgba(255,255,255,0.18)'}
            bg={isDark ? 'rgba(19,24,36,0.42)' : 'rgba(16,22,34,0.52)'}
            backdropFilter="blur(2px) saturate(165%)"
            boxShadow={
              isDark
                ? '0 16px 34px rgba(3,8,20,0.24), inset 0 1px 0 rgba(255,255,255,0.10)'
                : '0 16px 34px rgba(15,23,42,0.16), inset 0 1px 0 rgba(255,255,255,0.16)'
            }
            px={{ base: '3', md: '3.5' }}
            py={{ base: '1.75', md: '2.15' }}
            minH={{ base: '4.6rem', md: '5rem' }}
            h={{ base: '4.6rem', md: '5rem' }}
            overflow="hidden"
            transition="transform 240ms cubic-bezier(0.22, 1, 0.36, 1), height 240ms cubic-bezier(0.22, 1, 0.36, 1), box-shadow 240ms ease, filter 240ms ease"
            _groupHover={{
              transform: 'translateY(-2px)',
              h: { base: '5.6rem', md: '6.3rem' },
              filter: 'saturate(1.03)',
              boxShadow: isDark
                ? '0 20px 38px rgba(3,8,20,0.28), inset 0 1px 0 rgba(255,255,255,0.12)'
                : '0 20px 38px rgba(15,23,42,0.14), inset 0 1px 0 rgba(255,255,255,0.24)',
            }}
            _before={{
              content: '""',
              position: 'absolute',
              inset: '1px',
              borderRadius: 'inherit',
              pointerEvents: 'none',
              border: isDark ? '1px solid rgba(255,255,255,0.06)' : '1px solid rgba(255,255,255,0.12)',
              background: isDark
                ? 'linear-gradient(180deg, rgba(255,255,255,0.08), rgba(255,255,255,0.028) 30%, rgba(255,255,255,0.008) 62%, rgba(255,255,255,0) 100%)'
                : 'linear-gradient(180deg, rgba(255,255,255,0.18), rgba(255,255,255,0.06) 30%, rgba(255,255,255,0.02) 62%, rgba(255,255,255,0) 100%)',
            }}
            _after={{
              content: '""',
              position: 'absolute',
              inset: '0',
              borderRadius: 'inherit',
              pointerEvents: 'none',
              background: isDark
                ? 'radial-gradient(circle at 18% -8%, rgba(255,255,255,0.14), transparent 28%), radial-gradient(circle at 84% 18%, rgba(120,194,255,0.06), transparent 28%)'
                : 'radial-gradient(circle at 18% -8%, rgba(255,255,255,0.28), transparent 28%), radial-gradient(circle at 84% 18%, rgba(120,194,255,0.06), transparent 28%)',
              opacity: isDark ? 0.4 : 0.56,
            }}
          >
            <Flex align="center" gap={{ base: '2.5', md: '3.5' }} position="relative" zIndex="1" h="full">
              <Flex align="center" minW="0" flex="1" h="full">
                <Text
                  w="full"
                  color="rgba(248,250,252,0.98)"
                  fontSize={{ base: 'md', md: 'lg' }}
                  fontWeight="700"
                  lineHeight="1.16"
                  textShadow="0 3px 14px rgba(0,0,0,0.64)"
                  sx={{
                    display: '-webkit-box',
                    WebkitBoxOrient: 'vertical',
                    WebkitLineClamp: '2',
                    overflow: 'hidden',
                    '@media (min-width: 48em)': {
                      '[role="group"]:hover &': {
                        WebkitLineClamp: 'unset',
                      },
                    },
                  }}
                >
                  {bangumi.name}
                </Text>
              </Flex>

              <Flex align="center" justify="flex-end" minH="36px" flexShrink={0}>
                <Button
                  onClick={() => handleOpen(syncData.status, bangumi.name, bangumi.episode ?? 0)}
                  h={{ base: '34px', md: '40px' }}
                  minW={{ base: '64px', md: '98px' }}
                  px={{ base: '3.5', md: '5' }}
                  fontSize={{ base: 'xs', md: 'sm' }}
                  fontWeight="700"
                  color="gray.900"
                  bg={
                    syncData.status
                      ? 'linear-gradient(135deg, #6ee7b7, #34d399)'
                      : 'linear-gradient(135deg, #7dd3fc, #60a5fa)'
                  }
                  boxShadow="0 10px 22px rgba(0,0,0,0.16), inset 0 1px 0 rgba(255,255,255,0.36)"
                  _hover={{ opacity: 0.96, transform: 'translateY(-1px)' }}
                >
                  {syncData.status ? '查看' : '订阅'}
                </Button>
              </Flex>
            </Flex>
          </Box>
        </Box>
      </Box>

      <SubscribeForm
        initialData={initialData}
        isOpen={isOpen}
        onClose={onClose}
        setSyncData={(data: SyncData) => setSyncData(data)}
        syncData={syncData}
      />
    </>
  );
}
