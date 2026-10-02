import {
  Box,
  Button,
  Flex,
  FormControl,
  FormLabel,
  Input,
  Link,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
  SimpleGrid,
  Spinner,
  Stack,
  Text,
} from '@chakra-ui/react';
import { useEffect, useState } from 'react';
import useSWR from 'swr';

import { useAccentTheme } from '~/hooks/use-accent-theme';
import { useColorMode } from '~/hooks/use-color-mode';
import { useSubscribeAction } from '~/hooks/use-subscribe-action';
import { fetcherWithTimeout } from '~/lib/fetcher';
import { findMikanSubtitleLink, type MikanSubtitleGroupResponse } from '~/lib/mikan-subtitle';

import type { SyncData } from './subscribe-card';

export interface InitialData {
  bangumiName: string;
  completedEpisodes: number;
  filterOptions: {
    include: string;
    exclude: string;
    regex: string;
  };
  subtitleGroups: string[];
  follwedSubtitleGroups: string[];
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  initialData: InitialData | undefined;
  setSyncData: (data: SyncData) => void;
  syncData: SyncData;
}

export default function SubscribeForm({ isOpen, onClose, initialData, setSyncData, syncData }: Props) {
  const { colorMode } = useColorMode();
  const { theme: accentTheme } = useAccentTheme();
  const [formData, setFormData] = useState<InitialData>();
  const { handleSaveFilter, handleSaveMark, handleUnSubscribe, handleTriggerDownload } = useSubscribeAction();

  useEffect(() => {
    setFormData(initialData);
  }, [initialData]);

  const { data: mikanGroups } = useSWR<MikanSubtitleGroupResponse>(
    isOpen && formData?.bangumiName ? `/api/mikan/subtitle-groups?bangumi=${encodeURIComponent(formData.bangumiName)}` : null,
    (key: string) => fetcherWithTimeout([key], {}, 60000),
    { revalidateOnFocus: false, shouldRetryOnError: false }
  );

  const glassFieldBg = colorMode === 'dark' ? 'rgba(255,255,255,0.06)' : 'rgba(234,248,255,0.42)';
  const glassFieldBorder = colorMode === 'dark' ? 'whiteAlpha.180' : 'rgba(255,255,255,0.76)';
  const primaryText = colorMode === 'dark' ? '#10212F' : '#FFFFFF';
  const bangumiPlanUrl = formData ? `https://bgm.tv/subject_search/${encodeURIComponent(formData.bangumiName)}` : '';

  const handleSave = async () => {
    if (!formData) return;

    await handleSaveFilter.trigger({
      name: formData.bangumiName,
      include: formData.filterOptions.include,
      exclude: formData.filterOptions.exclude,
      regex: formData.filterOptions.regex,
      subtitle: formData.follwedSubtitleGroups.join(','),
    });

    await handleSaveMark.trigger({
      name: formData.bangumiName,
      episode: formData.completedEpisodes,
    });

    setSyncData({ ...syncData, episode: formData.completedEpisodes });
    onClose();
  };

  const handleResetCompleted = async () => {
    if (!formData) return;

    await handleSaveMark.trigger({
      name: formData.bangumiName,
      episode: 0,
    });

    setFormData({
      ...formData,
      completedEpisodes: 0,
    });
    setSyncData({ ...syncData, episode: 0 });
  };

  const handleSubmitDownload = async () => {
    if (!formData) return;
    await handleTriggerDownload.trigger({
      name: formData.bangumiName,
      download: true,
    });
  };

  const handleUnSub = async () => {
    if (!formData) return;

    const data = await handleUnSubscribe(formData.bangumiName);
    if (data) setSyncData({ ...syncData, status: false });
    onClose();
  };

  return (
    <Modal onClose={onClose} isOpen={isOpen} closeOnOverlayClick={false}>
      <ModalOverlay />
      <ModalContent
        data-bgmi-glass-panel
        maxW={{ base: 'calc(100vw - 1rem)', sm: 'sm', md: 'xl' }}
        overflow="visible"
        bg="var(--bgmi-glass-background)"
        borderColor={glassFieldBorder}
        boxShadow={
          colorMode === 'dark'
            ? '0 30px 80px rgba(0,0,0,0.34), inset 0 1px 0 rgba(255,255,255,0.08)'
            : '0 30px 80px rgba(39,87,116,0.14), 0 10px 28px rgba(94,188,214,0.12), inset 0 1px 0 rgba(255,255,255,0.64)'
        }
        backdropFilter="blur(var(--bgmi-glass-blur)) saturate(175%)"
      >
        <ModalHeader pb="2">订阅设置</ModalHeader>
        <ModalCloseButton />

        <ModalBody pb="2">
          {!formData ? (
            <Box textAlign="center" my="8">
              <Spinner />
            </Box>
          ) : (
            <Stack spacing="5">
              <Text fontSize="sm" opacity="0.78">
                调整过滤规则、已完成剧集和字幕组偏好。手动下载可立刻触发一次抓取。
              </Text>

              <Flex gap="3" flexWrap="wrap">
                <Button variant="outline" borderColor={accentTheme.border} color={accentTheme.primary} onClick={() => void handleResetCompleted()} isLoading={handleSaveMark.isMutating}>
                  完成剧集清零
                </Button>
                <Button bg={accentTheme.primary} color={primaryText} _hover={{ filter: 'brightness(0.92)' }} onClick={() => void handleSubmitDownload()} isLoading={handleTriggerDownload.isMutating}>
                  提交下载
                </Button>
                <Button as="a" href={bangumiPlanUrl} target="_blank" rel="noopener noreferrer" variant="outline" borderColor={accentTheme.border} color={accentTheme.primary}>
                  番剧计划 ↗
                </Button>
              </Flex>

              <SimpleGrid columns={{ base: 1, md: 2 }} spacing="4">
                <FormControl id="include">
                  <FormLabel>包含字段</FormLabel>
                  <Input
                    value={formData.filterOptions.include}
                    onChange={event =>
                      setFormData({
                        ...formData,
                        filterOptions: { ...formData.filterOptions, include: event.target.value },
                      })
                    }
                    type="text"
                    bg={glassFieldBg}
                    borderColor={glassFieldBorder}
                  />
                </FormControl>
                <FormControl id="exclude">
                  <FormLabel>排除字段</FormLabel>
                  <Input
                    value={formData.filterOptions.exclude}
                    onChange={event =>
                      setFormData({
                        ...formData,
                        filterOptions: { ...formData.filterOptions, exclude: event.target.value },
                      })
                    }
                    type="text"
                    bg={glassFieldBg}
                    borderColor={glassFieldBorder}
                  />
                </FormControl>
              </SimpleGrid>

              <FormControl id="regex">
                <FormLabel>正则表达式</FormLabel>
                <Input
                  value={formData.filterOptions.regex}
                  onChange={event =>
                    setFormData({
                      ...formData,
                      filterOptions: { ...formData.filterOptions, regex: event.target.value },
                    })
                  }
                  type="text"
                  bg={glassFieldBg}
                  borderColor={glassFieldBorder}
                />
              </FormControl>

              <FormControl id="completedEpisodes">
                <FormLabel>已完成下载的剧集</FormLabel>
                <Input
                  value={String(formData.completedEpisodes)}
                  onChange={event => setFormData({ ...formData, completedEpisodes: Number(event.target.value || 0) })}
                  type="number"
                  bg={glassFieldBg}
                  borderColor={glassFieldBorder}
                />
              </FormControl>

              <FormControl id="subtitleGroups">
                <FormLabel>已识别字幕组</FormLabel>
                <Flex wrap="wrap" gap="2">
                  {formData.subtitleGroups.length ? formData.subtitleGroups.map(name => {
                    const selected = formData.follwedSubtitleGroups.includes(name);
                    const url = findMikanSubtitleLink(mikanGroups?.data.groups, name);
                    return (
                      <Flex key={name} align="center" gap="2" maxW="full" minW="0" p="2" rounded="lg" borderWidth="1px" borderColor={selected ? accentTheme.primary : glassFieldBorder} bg={selected ? accentTheme.soft : glassFieldBg}>
                        <Link href={url} target={url ? '_blank' : undefined} rel={url ? 'noopener noreferrer' : undefined} minW="0" fontSize="sm" lineHeight="1.4" overflowWrap="anywhere" color={url ? accentTheme.primary : undefined} textDecoration={url ? 'underline' : undefined}>
                          {name}{url ? ' ↗' : ''}
                        </Link>
                        <Button size="xs" minW="3rem" flexShrink={0} bg={selected ? accentTheme.primary : 'transparent'} color={selected ? primaryText : accentTheme.primary} borderWidth="1px" borderColor={accentTheme.border} onClick={() => setFormData({ ...formData, follwedSubtitleGroups: selected ? formData.follwedSubtitleGroups.filter(item => item !== name) : [...formData.follwedSubtitleGroups, name] })}>
                          {selected ? '已选' : '选择'}
                        </Button>
                      </Flex>
                    );
                  }) : <Text fontSize="sm" opacity={0.7}>暂无已识别字幕组</Text>}
                </Flex>
              </FormControl>
            </Stack>
          )}
        </ModalBody>

        <ModalFooter pt="4">
          <Flex w="full" justify="space-between" gap="3" flexWrap="wrap">
            <Button onClick={onClose} variant="outline" borderColor={accentTheme.border} color={accentTheme.primary}>
              返回
            </Button>
            <Flex gap="3" ml={{ md: 'auto', base: 0 }}>
              <Button variant="outline" borderColor={accentTheme.border} color={accentTheme.primary} onClick={() => void handleUnSub()}>
                取消订阅
              </Button>
              <Button
                bg={accentTheme.primary}
                color={primaryText}
                _hover={{ filter: 'brightness(0.92)' }}
                onClick={() => void handleSave()}
                isLoading={handleSaveFilter.isMutating || handleSaveMark.isMutating}
              >
                保存
              </Button>
            </Flex>
          </Flex>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
