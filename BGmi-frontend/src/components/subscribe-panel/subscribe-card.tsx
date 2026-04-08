import { Box, Button, Fade, Flex, Image, Text, useDisclosure } from '@chakra-ui/react';

import { useState } from 'react';
import { useSubscribeAction } from '~/hooks/use-subscribe-action';
import { useColorMode } from '~/hooks/use-color-mode';
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
  const buttonSubscribeBg = colorMode === 'dark' ? 'green.400' : 'rgba(104, 219, 149, 0.72)';
  const buttonUnSubscribeBg = colorMode === 'dark' ? 'blue.400' : 'rgba(105, 191, 255, 0.70)';

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

    /**
     * 先进行订阅操作才能请求 `filter` 获取字幕组数据, 已订阅不操作
     * */
    if (!status) {
      await handleSubscribe(name, 0);
      setSyncData({
        ...syncData,
        status: true,
      });
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
        rounded="2xl"
        overflow="hidden"
        borderWidth="1px"
        borderColor={colorMode === 'dark' ? 'whiteAlpha.120' : 'rgba(255,255,255,0.76)'}
        bg={colorMode === 'dark' ? 'rgba(255,255,255,0.04)' : 'rgba(236,248,255,0.62)'}
        backdropFilter="blur(18px) saturate(165%)"
        boxShadow={
          colorMode === 'dark'
            ? '0 16px 36px rgba(0,0,0,0.16), inset 0 1px 0 rgba(255,255,255,0.05)'
            : '0 20px 42px rgba(39,87,116,0.10), 0 6px 18px rgba(94,188,214,0.10), inset 0 1px 0 rgba(255,255,255,0.52)'
        }
        position="relative"
        _before={{
          content: '""',
          position: 'absolute',
          inset: '1px',
          borderRadius: 'inherit',
          pointerEvents: 'none',
          background:
            colorMode === 'dark'
              ? 'linear-gradient(180deg, rgba(255,255,255,0.08), rgba(255,255,255,0) 22%)'
              : 'linear-gradient(180deg, rgba(255,255,255,0.66), rgba(214,255,249,0.16) 22%, rgba(188,233,255,0.08) 48%, rgba(255,255,255,0.04) 70%)',
        }}
        _after={{
          content: '""',
          position: 'absolute',
          top: '0',
          left: '0',
          right: '0',
          height: '1px',
          pointerEvents: 'none',
          background: colorMode === 'dark' ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.82)',
        }}
      >
        <Flex
          align={{ base: 'stretch', sm: 'center' }}
          direction={{ base: 'column', sm: 'row' }}
          gap={{ base: '3', sm: '2' }}
          minH="12"
          bg="transparent"
          p={{ base: '3.5', sm: '4' }}
          px={{ base: '3', sm: '2.5' }}
        >
          <Text
            minW="0"
            flex="1"
            maxH={{ base: '10', sm: '6' }}
            overflow="hidden"
            transition="max-height 0.3s ease"
            fontWeight="medium"
            fontSize={{ base: 'sm', sm: 'md' }}
            color={colorMode === 'dark' ? 'whiteAlpha.920' : 'gray.700'}
            _hover={{
              maxH: '28',
            }}
          >
            {bangumi.name}
          </Text>
          <Button
            onClick={() => handleOpen(syncData.status, bangumi.name, bangumi.episode ?? 0)}
            ml={{ base: '0', sm: '2' }}
            w={{ base: 'full', sm: 'auto' }}
            minW={{ sm: '6.5rem' }}
            bg={syncData.status ? buttonSubscribeBg : buttonUnSubscribeBg}
            borderColor={colorMode === 'dark' ? undefined : 'rgba(255,255,255,0.58)'}
            boxShadow={
              colorMode === 'dark'
                ? undefined
                : '0 10px 22px rgba(83, 162, 214, 0.14), inset 0 1px 0 rgba(255,255,255,0.36)'
            }
            color={colorMode === 'dark' ? undefined : 'gray.800'}
            _hover={{
              opacity: 0.92,
            }}
          >
            {syncData.status ? '查看' : '订阅'}
          </Button>
        </Flex>
        <Box
          bg={colorMode === 'dark' ? 'gray.900' : 'gray.100'}
          minW="0"
          w="full"
          minH={{ base: '11.5rem', sm: 'sm' }}
          position="relative"
          overflow="hidden"
          _before={{
            content: '""',
            position: 'absolute',
            inset: '0',
            pointerEvents: 'none',
            border: colorMode === 'dark' ? '1px solid rgba(255,255,255,0.06)' : '1px solid rgba(255,255,255,0.42)',
            boxShadow:
              colorMode === 'dark'
                ? 'inset 0 0 0 1px rgba(255,255,255,0.02)'
                : 'inset 0 0 0 1px rgba(255,255,255,0.18)',
          }}
          _after={{
            content: '""',
            position: 'absolute',
            inset: '0',
            pointerEvents: 'none',
            background:
              colorMode === 'dark'
                ? 'linear-gradient(135deg, rgba(255,255,255,0.08), rgba(255,255,255,0) 34%)'
                : 'linear-gradient(135deg, rgba(255,255,255,0.22), rgba(255,255,255,0) 34%)',
          }}
        >
          <Fade in={imageLoaded}>
            <Image
              h="full"
              w="full"
              src={resolveCoverSrc(bangumi.cover)}
              alt="anime cover"
              objectFit="cover"
              backgroundPosition="50% 50%"
              onLoad={() => setImageLoaded(true)}
            />
          </Fade>
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
