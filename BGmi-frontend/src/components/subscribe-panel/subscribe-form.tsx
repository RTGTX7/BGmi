import {
  Box,
  Button,
  Flex,
  FormControl,
  FormLabel,
  Input,
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
import { Select } from 'chakra-react-select';
import { useMemo, useState } from 'react';

import { useColorMode } from '~/hooks/use-color-mode';
import { useSubscribeAction } from '~/hooks/use-subscribe-action';
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

interface SelectOption {
  label: string;
  value: string;
}

export default function SubscribeForm({ isOpen, onClose, initialData, setSyncData, syncData }: Props) {
  const { colorMode } = useColorMode();
  const [formData, setFormData] = useState<InitialData>();
  const { handleSaveFilter, handleSaveMark, handleUnSubscribe } = useSubscribeAction();

  if (initialData && !formData) setFormData(initialData);

  const selectOptions = useMemo<SelectOption[]>(
    () =>
      formData?.subtitleGroups.map(subtitleGroup => ({
        label: subtitleGroup,
        value: subtitleGroup,
      })) ?? [],
    [formData]
  );

  const selectDefaultValue = useMemo<SelectOption[]>(
    () =>
      formData?.follwedSubtitleGroups.map(followedSubtitleGroup => ({
        label: followedSubtitleGroup,
        value: followedSubtitleGroup,
      })) ?? [],
    [formData]
  );

  const glassFieldBg = colorMode === 'dark' ? 'rgba(255,255,255,0.06)' : 'rgba(234,248,255,0.42)';
  const glassFieldBorder = colorMode === 'dark' ? 'whiteAlpha.180' : 'rgba(255,255,255,0.76)';

  const handleClose = () => {
    onClose();
  };

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

  const handleUnSub = async () => {
    if (!formData) return;

    const data = await handleUnSubscribe(formData.bangumiName);
    if (data) setSyncData({ ...syncData, status: false });
    onClose();
  };

  return (
    <Modal onClose={handleClose} isOpen={isOpen} closeOnOverlayClick={false}>
      <ModalOverlay />
      <ModalContent
        maxW={{ base: 'calc(100vw - 1rem)', sm: 'sm', md: 'xl' }}
        overflow="visible"
        bg={colorMode === 'dark' ? 'rgba(25,30,42,0.84)' : 'rgba(244,252,255,0.80)'}
        borderColor={glassFieldBorder}
        boxShadow={
          colorMode === 'dark'
            ? '0 30px 80px rgba(0,0,0,0.34), inset 0 1px 0 rgba(255,255,255,0.08)'
            : '0 30px 80px rgba(39,87,116,0.14), 0 10px 28px rgba(94,188,214,0.12), inset 0 1px 0 rgba(255,255,255,0.64)'
        }
        backdropFilter="blur(28px) saturate(175%)"
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
                为当前番剧调整过滤规则、已完成剧集和字幕组偏好。
              </Text>

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
                <FormLabel>选择字幕组</FormLabel>
                <Select<SelectOption, true>
                  isMulti
                  placeholder="选择要跟随的字幕组"
                  options={selectOptions}
                  value={selectDefaultValue}
                  onChange={items =>
                    setFormData({
                      ...formData,
                      follwedSubtitleGroups: items.map(item => item.value),
                    })
                  }
                  closeMenuOnSelect={false}
                  chakraStyles={{
                    container: provided => ({
                      ...provided,
                      w: '100%',
                    }),
                    control: provided => ({
                      ...provided,
                      minH: '3rem',
                      bg: glassFieldBg,
                      borderColor: glassFieldBorder,
                      boxShadow:
                        colorMode === 'dark'
                          ? 'inset 0 1px 0 rgba(255,255,255,0.05)'
                          : '0 10px 24px rgba(39,87,116,0.08), inset 0 1px 0 rgba(255,255,255,0.44)',
                      backdropFilter: 'blur(18px) saturate(165%)',
                      borderRadius: '0.9rem',
                    }),
                    valueContainer: provided => ({
                      ...provided,
                      py: '0.45rem',
                    }),
                    menu: provided => ({
                      ...provided,
                      bg: colorMode === 'dark' ? 'rgba(25,30,42,0.90)' : 'rgba(244,252,255,0.88)',
                      border: '1px solid',
                      borderColor: glassFieldBorder,
                      boxShadow:
                        colorMode === 'dark'
                          ? '0 18px 44px rgba(0,0,0,0.28), inset 0 1px 0 rgba(255,255,255,0.06)'
                          : '0 18px 44px rgba(39,87,116,0.12), 0 6px 18px rgba(94,188,214,0.12), inset 0 1px 0 rgba(255,255,255,0.56)',
                      backdropFilter: 'blur(22px) saturate(170%)',
                      borderRadius: '1rem',
                      overflow: 'hidden',
                    }),
                    menuList: provided => ({
                      ...provided,
                      py: '0.4rem',
                    }),
                    option: (provided, state) => ({
                      ...provided,
                      mx: '0.35rem',
                      my: '0.2rem',
                      borderRadius: '0.8rem',
                      bg: state.isFocused
                        ? colorMode === 'dark'
                          ? 'rgba(255,255,255,0.10)'
                          : 'rgba(234,248,255,0.72)'
                        : 'transparent',
                    }),
                    multiValue: provided => ({
                      ...provided,
                      bg: colorMode === 'dark' ? 'rgba(255,255,255,0.10)' : 'rgba(234,248,255,0.78)',
                      borderRadius: '999px',
                      px: '0.15rem',
                    }),
                    dropdownIndicator: provided => ({
                      ...provided,
                      px: '0.7rem',
                    }),
                  }}
                />
              </FormControl>
            </Stack>
          )}
        </ModalBody>

        <ModalFooter pt="4">
          <Flex w="full" justify="space-between" gap="3" flexWrap="wrap">
            <Button onClick={onClose} variant="outline">
              返回
            </Button>
            <Flex gap="3" ml={{ md: 'auto', base: 0 }}>
              <Button colorScheme="red" variant="solid" onClick={handleUnSub}>
                取消订阅
              </Button>
              <Button
                colorScheme="blue"
                onClick={handleSave}
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
