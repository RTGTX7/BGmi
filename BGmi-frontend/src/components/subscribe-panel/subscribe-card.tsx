import {
  Box,
  Button,
  Flex,
  Image,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalOverlay,
  Wrap,
  WrapItem,
  Tag,
  Text,
  useBreakpointValue,
  useDisclosure,
} from '@chakra-ui/react';
import type { TouchEvent } from 'react';
import { useRef, useState } from 'react';

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
  const {
    isOpen: isPreviewOpen,
    onClose: onPreviewClose,
    onOpen: onPreviewOpen,
  } = useDisclosure();
  const [initialData, setInitialData] = useState<InitialData>();
  const isMobile = useBreakpointValue({ base: true, md: false }) ?? false;
  const previewTouchStartRef = useRef<{ x: number; y: number } | null>(null);

  const { handleFetchFilter, handleSubscribe } = useSubscribeAction();
  const [syncData, setSyncData] = useState<SyncData>({
    status: !!bangumi.status,
    episode: bangumi.episode,
  });
  const followedSubtitleGroups = initialData?.follwedSubtitleGroups ?? [];
  const bangumiPlanUrl = `https://bgm.tv/subject_search/${encodeURIComponent(bangumi.name)}`;

  const loadFilterData = async (name: string, ep: number) => {
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

    return data;
  };

  const handleOpen = async (status: boolean, name: string, ep: number) => {
    onOpen();

    if (!status) {
      await handleSubscribe(name, 0);
      setSyncData(current => ({
        ...current,
        status: true,
      }));
    }

    await loadFilterData(name, ep);
  };

  const handleCardClick = () => {
    if (!isMobile) return;
    onPreviewOpen();
    if (syncData.status) {
      void loadFilterData(bangumi.name, bangumi.episode ?? 0);
    }
  };

  const handlePreviewTouchStart = (event: TouchEvent<HTMLDivElement>) => {
    const touch = event.changedTouches[0];
    if (!touch) return;
    previewTouchStartRef.current = { x: touch.clientX, y: touch.clientY };
  };

  const handlePreviewTouchEnd = (event: TouchEvent<HTMLDivElement>) => {
    const start = previewTouchStartRef.current;
    previewTouchStartRef.current = null;
    if (!start) return;

    const touch = event.changedTouches[0];
    if (!touch) return;

    const deltaX = touch.clientX - start.x;
    const deltaY = touch.clientY - start.y;
    if (Math.abs(deltaY) < 72 || Math.abs(deltaY) <= Math.abs(deltaX) * 1.2 || deltaY < 0) return;

    onPreviewClose();
  };

  return (
    <>
      <Box
        role="group"
        w="full"
        minW="0"
        cursor={isMobile ? 'pointer' : 'default'}
        onClick={handleCardClick}
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
            left={{ base: '2', md: '3.5' }}
            right={{ base: '2', md: '3.5' }}
            bottom={{ base: '2', md: '3.5' }}
            zIndex="2"
            rounded="22px"
            borderWidth="1px"
            borderColor={isDark ? 'rgba(255,255,255,0.14)' : 'rgba(255,255,255,0.18)'}
            bg={isDark ? 'rgba(19,24,36,0.30)' : 'rgba(16,22,34,0.46)'}
            backdropFilter="blur(2px) saturate(165%)"
            boxShadow={
              isDark
                ? '0 16px 34px rgba(3,8,20,0.24), inset 0 1px 0 rgba(255,255,255,0.10)'
                : '0 16px 34px rgba(15,23,42,0.16), inset 0 1px 0 rgba(255,255,255,0.16)'
            }
            px={{ base: '2.5', md: '3.5' }}
            py={{ base: '1.35', md: '2.15' }}
            minH={{ base: '3.9rem', md: '5rem' }}
            h={{ base: '3.9rem', md: '5rem' }}
            overflow="hidden"
            transition="transform 240ms cubic-bezier(0.22, 1, 0.36, 1), height 240ms cubic-bezier(0.22, 1, 0.36, 1), box-shadow 240ms ease, filter 240ms ease"
            _groupHover={{
              transform: 'translateY(-2px)',
              h: { base: '3.9rem', md: '6.3rem' },
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
            <Flex align="center" gap={{ base: '2', md: '3.5' }} position="relative" zIndex="1" h="full">
              <Flex align="center" minW="0" flex="1" h="full">
                <Text
                  w="full"
                  color="rgba(248,250,252,0.98)"
                  fontSize={{ base: 'sm', md: 'lg' }}
                  fontWeight="700"
                  lineHeight="1.1"
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
                  onClick={event => {
                    event.stopPropagation();
                    void handleOpen(syncData.status, bangumi.name, bangumi.episode ?? 0);
                  }}
                  h={{ base: '30px', md: '40px' }}
                  minW={{ base: '54px', md: '98px' }}
                  px={{ base: '3', md: '5' }}
                  fontSize={{ base: '11px', md: 'sm' }}
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

      <Modal isOpen={isMobile && isPreviewOpen} onClose={onPreviewClose} isCentered motionPreset="slideInBottom">
        <ModalOverlay bg="rgba(2,6,23,0.72)" backdropFilter="blur(10px)" />
        <ModalContent
          mx="4"
          rounded="28px"
          overflow="hidden"
          bg={isDark ? 'rgba(15,20,31,0.78)' : 'rgba(244,250,252,0.82)'}
          borderWidth="1px"
          borderColor={isDark ? 'whiteAlpha.140' : 'rgba(255,255,255,0.72)'}
          boxShadow={isDark ? '0 28px 64px rgba(0,0,0,0.42)' : '0 28px 64px rgba(15,23,42,0.22)'}
          backdropFilter="blur(24px) saturate(180%)"
        >
          <ModalCloseButton
            top="3"
            right="3"
            rounded="full"
            bg={isDark ? 'rgba(15,23,42,0.56)' : 'rgba(255,255,255,0.66)'}
            borderWidth="1px"
            borderColor={isDark ? 'whiteAlpha.180' : 'rgba(255,255,255,0.82)'}
          />
          <ModalBody p="0" onTouchStart={handlePreviewTouchStart} onTouchEnd={handlePreviewTouchEnd}>
            <Box px="5" pt="3" pb="2" display="flex" justifyContent="center">
              <Box w="2.75rem" h="0.3rem" rounded="full" bg={isDark ? 'whiteAlpha.300' : 'blackAlpha.200'} />
            </Box>

            <Box px={{ base: '5', md: '6' }} pb={{ base: '5', md: '6' }}>
              <Flex justify="center">
                <Box
                  w="full"
                  maxW="18rem"
                  rounded="24px"
                  overflow="hidden"
                  bg={isDark ? 'rgba(2,6,23,0.56)' : 'rgba(255,255,255,0.72)'}
                  borderWidth="1px"
                  borderColor={isDark ? 'whiteAlpha.120' : 'rgba(255,255,255,0.74)'}
                  boxShadow={isDark ? '0 22px 44px rgba(0,0,0,0.28)' : '0 20px 40px rgba(15,23,42,0.12)'}
                >
                  <Box aspectRatio={3 / 4} display="flex" alignItems="center" justifyContent="center" bg="black">
                    <Image
                      src={resolveCoverSrc(bangumi.cover)}
                      alt={bangumi.name}
                      w="full"
                      h="full"
                      objectFit="contain"
                    />
                  </Box>
                </Box>
              </Flex>

              <Box
                mt="4"
                rounded="24px"
                borderWidth="1px"
                borderColor={isDark ? 'whiteAlpha.120' : 'rgba(255,255,255,0.72)'}
                bg={isDark ? 'rgba(19,24,36,0.46)' : 'rgba(255,255,255,0.50)'}
                boxShadow={
                  isDark
                    ? '0 18px 36px rgba(0,0,0,0.18), inset 0 1px 0 rgba(255,255,255,0.06)'
                    : '0 18px 36px rgba(15,23,42,0.08), inset 0 1px 0 rgba(255,255,255,0.52)'
                }
                backdropFilter="blur(18px) saturate(175%)"
                px="4"
                py="4"
              >
                <Text color={isDark ? 'whiteAlpha.960' : '#203447'} fontSize="lg" fontWeight="700" lineHeight="1.28">
                  {bangumi.name}
                </Text>

                <Flex mt="3" gap="2" flexWrap="wrap">
                  <Tag rounded="full" bg={isDark ? 'whiteAlpha.100' : 'rgba(255,255,255,0.78)'}>
                    {bangumi.episode ? `最新：第 ${bangumi.episode} 集` : '暂无剧集信息'}
                  </Tag>
                  <Tag rounded="full" bg={isDark ? 'whiteAlpha.100' : 'rgba(255,255,255,0.78)'}>
                    更新：{bangumi.update_time || '未知'}
                  </Tag>
                  <Tag rounded="full" bg={syncData.status ? 'rgba(34,197,94,0.18)' : isDark ? 'whiteAlpha.100' : 'rgba(255,255,255,0.78)'}>
                    {syncData.status ? '已订阅' : '未订阅'}
                  </Tag>
                </Flex>

                {bangumi.subtitle_group?.length ? (
                  <Box mt="3">
                    <Text mb="2" color={isDark ? 'whiteAlpha.760' : '#526274'} fontSize="sm" lineHeight="1.6">
                      字幕组
                    </Text>
                    <Wrap spacing="2">
                      {bangumi.subtitle_group.map(item => {
                        const isSelected = followedSubtitleGroups.includes(item.name);
                        return (
                          <WrapItem key={item.id}>
                            <Tag
                              rounded="full"
                              px="3"
                              py="1.5"
                              fontSize="xs"
                              color={
                                isSelected
                                  ? isDark
                                    ? 'green.100'
                                    : 'green.700'
                                  : isDark
                                  ? 'whiteAlpha.860'
                                  : '#526274'
                              }
                              bg={
                                isSelected
                                  ? isDark
                                    ? 'rgba(34,197,94,0.18)'
                                    : 'rgba(220,252,231,0.92)'
                                  : isDark
                                  ? 'whiteAlpha.100'
                                  : 'rgba(255,255,255,0.72)'
                              }
                              borderWidth="1px"
                              borderColor={
                                isSelected
                                  ? isDark
                                    ? 'rgba(74,222,128,0.30)'
                                    : 'rgba(134,239,172,0.92)'
                                  : isDark
                                  ? 'whiteAlpha.120'
                                  : 'rgba(255,255,255,0.78)'
                              }
                              boxShadow={
                                isSelected
                                  ? isDark
                                    ? '0 0 0 1px rgba(74,222,128,0.10), 0 10px 20px rgba(34,197,94,0.12)'
                                    : '0 10px 20px rgba(34,197,94,0.10)'
                                  : 'none'
                              }
                              backdropFilter="blur(12px) saturate(165%)"
                            >
                              {item.name}
                            </Tag>
                          </WrapItem>
                        );
                      })}
                    </Wrap>
                  </Box>
                ) : null}

                <Flex mt="4" justify="flex-end" gap="2" flexWrap="wrap">
                  <Button
                    as="a"
                    href={bangumiPlanUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    h="2.5rem"
                    minW="5.75rem"
                    px="4"
                    fontSize="sm"
                    fontWeight="700"
                    color={isDark ? 'pink.100' : 'pink.600'}
                    bg={isDark ? 'rgba(244,114,182,0.14)' : 'rgba(252,231,243,0.88)'}
                    borderWidth="1px"
                    borderColor={isDark ? 'rgba(244,114,182,0.28)' : 'rgba(244,114,182,0.26)'}
                    boxShadow={
                      isDark
                        ? '0 10px 22px rgba(190,24,93,0.16), inset 0 1px 0 rgba(255,255,255,0.06)'
                        : '0 10px 22px rgba(236,72,153,0.12), inset 0 1px 0 rgba(255,255,255,0.42)'
                    }
                  >
                    番剧计划
                  </Button>
                  <Button
                    onClick={() => void handleOpen(syncData.status, bangumi.name, bangumi.episode ?? 0)}
                    h="2.5rem"
                    minW="5.75rem"
                    px="4"
                    fontSize="sm"
                    fontWeight="700"
                    color="gray.900"
                    bg={
                      syncData.status
                        ? 'linear-gradient(135deg, #6ee7b7, #34d399)'
                        : 'linear-gradient(135deg, #7dd3fc, #60a5fa)'
                    }
                    boxShadow="0 10px 22px rgba(0,0,0,0.16), inset 0 1px 0 rgba(255,255,255,0.36)"
                  >
                    {syncData.status ? '查看' : '订阅'}
                  </Button>
                </Flex>
              </Box>
            </Box>
          </ModalBody>
        </ModalContent>
      </Modal>
    </>
  );
}
