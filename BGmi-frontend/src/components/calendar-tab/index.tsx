import type { BoxProps, TabListProps, TabsProps } from '@chakra-ui/react';
import { Box, Flex, Tab, TabList, TabPanels, Tabs } from '@chakra-ui/react';

import { useColorMode } from '~/hooks/use-color-mode';
import type { CalendarDataKey } from '~/types/calendar';

interface Props {
  children: React.ReactNode;
  customElement?: React.ReactNode;
  searchOpen?: boolean;
  searchPanel?: React.ReactNode;
  standaloneContent?: React.ReactNode;
  onSearchToggle?: () => void;
  tabListItems: CalendarDataKey[];
  tabListProps?: TabListProps;
  boxProps?: BoxProps;
  type?: 'subscribe';
}

function getChipStyles(colorMode: string) {
  return {
    color: colorMode === 'dark' ? 'whiteAlpha.900' : '#425466',
    bg: colorMode === 'dark' ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.28)',
    borderColor: colorMode === 'dark' ? 'whiteAlpha.140' : 'rgba(255,255,255,0.82)',
    boxShadow:
      colorMode === 'dark'
        ? '0 10px 24px rgba(0,0,0,0.14), inset 0 1px 0 rgba(255,255,255,0.05)'
        : '0 12px 28px rgba(39,87,116,0.08), inset 0 1px 0 rgba(255,255,255,0.46)',
    selected: {
      color: colorMode === 'dark' ? 'blue.100' : '#2563eb',
      bg: colorMode === 'dark' ? 'rgba(255,255,255,0.10)' : 'rgba(255,255,255,0.44)',
      borderColor: colorMode === 'dark' ? 'rgba(191,219,254,0.30)' : 'rgba(191,219,254,0.86)',
      boxShadow:
        colorMode === 'dark'
          ? '0 12px 28px rgba(41,121,255,0.16), inset 0 1px 0 rgba(255,255,255,0.10)'
          : '0 14px 30px rgba(94,188,214,0.16), 0 3px 10px rgba(59,130,246,0.12), inset 0 1px 0 rgba(255,255,255,0.54)',
    },
    hover: {
      bg: colorMode === 'dark' ? 'rgba(255,255,255,0.09)' : 'rgba(255,255,255,0.36)',
      borderColor: colorMode === 'dark' ? 'rgba(255,255,255,0.18)' : 'rgba(255,255,255,0.92)',
      boxShadow:
        colorMode === 'dark'
          ? '0 14px 30px rgba(0,0,0,0.18), inset 0 1px 0 rgba(255,255,255,0.09)'
          : '0 16px 32px rgba(94,188,214,0.14), 0 3px 10px rgba(59,130,246,0.08), inset 0 1px 0 rgba(255,255,255,0.54)',
    },
    active: {
      bg: colorMode === 'dark' ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.42)',
      boxShadow:
        colorMode === 'dark'
          ? '0 8px 18px rgba(0,0,0,0.16), inset 0 1px 0 rgba(255,255,255,0.10)'
          : '0 10px 20px rgba(94,188,214,0.12), inset 0 1px 0 rgba(255,255,255,0.60)',
    },
  };
}

function ActionChip({
  children,
  colorMode,
  selected = false,
  onClick,
  display,
}: {
  children: React.ReactNode;
  colorMode: string;
  selected?: boolean;
  onClick?: () => void;
  display?: Record<string, string>;
}) {
  const chipStyles = getChipStyles(colorMode);

  return (
    <Box
      as="button"
      type="button"
      display={display}
      whiteSpace="nowrap"
      alignItems="center"
      justifyContent="center"
      px={{ base: '3.5', lg: '4' }}
      h="10"
      minH="10"
      fontSize={{ base: 'sm', lg: 'md' }}
      lineHeight="1"
      fontWeight="semibold"
      rounded="2xl"
      bg={selected ? chipStyles.selected.bg : chipStyles.bg}
      color={selected ? chipStyles.selected.color : chipStyles.color}
      borderWidth="1px"
      borderColor={selected ? chipStyles.selected.borderColor : chipStyles.borderColor}
      boxShadow={selected ? chipStyles.selected.boxShadow : chipStyles.boxShadow}
      backdropFilter="blur(18px) saturate(168%)"
      transform="translateY(0)"
      transition="background 0.18s ease, border-color 0.18s ease, box-shadow 0.18s ease, transform 0.18s ease"
      onClick={onClick}
      flexShrink={0}
      position="relative"
      overflow="hidden"
      _before={{
        content: '""',
        position: 'absolute',
        top: '-30%',
        left: '-60%',
        width: '48%',
        height: '160%',
        transform: 'rotate(18deg)',
        background:
          colorMode === 'dark'
            ? 'linear-gradient(180deg, rgba(255,255,255,0.20), rgba(255,255,255,0))'
            : 'linear-gradient(180deg, rgba(255,255,255,0.40), rgba(255,255,255,0))',
        opacity: selected ? 0.9 : 0,
        transition: 'opacity 0.22s ease, left 0.28s ease',
        pointerEvents: 'none',
      }}
      _hover={{
        bg: selected ? chipStyles.selected.bg : chipStyles.hover.bg,
        borderColor: selected ? chipStyles.selected.borderColor : chipStyles.hover.borderColor,
        boxShadow: selected ? chipStyles.selected.boxShadow : chipStyles.hover.boxShadow,
        transform: 'translateY(-1px)',
        _before: {
          opacity: 1,
          left: '92%',
        },
      }}
      _active={{
        bg: selected ? chipStyles.selected.bg : chipStyles.active.bg,
        boxShadow: selected ? chipStyles.selected.boxShadow : chipStyles.active.boxShadow,
        transform: 'translateY(1px) scale(0.985)',
      }}
    >
      {children}
    </Box>
  );
}

export default function CalendarTab({
  children,
  customElement,
  searchOpen,
  searchPanel,
  standaloneContent,
  onSearchToggle,
  tabListItems,
  tabListProps,
  boxProps,
  type,
  ...props
}: Props & TabsProps) {
  const { colorMode } = useColorMode();
  const chipStyles = getChipStyles(colorMode);

  const engToZh: Record<CalendarDataKey, string> = {
    mon: '周一',
    tue: '周二',
    wed: '周三',
    thu: '周四',
    fri: '周五',
    sat: '周六',
    sun: '周日',
    unknown: '未知',
  };

  const today = new Date().getDay();

  return (
    <Tabs position="relative" isLazy lazyBehavior="keepMounted" {...props} defaultIndex={today}>
      <Flex
        align={{ base: 'stretch', lg: 'center' }}
        direction={{ base: 'column', lg: 'row' }}
        gap="3"
        flexWrap={{ base: 'nowrap', lg: 'nowrap' }}
        overflow="visible"
      >
        <Flex
          flex="1 1 auto"
          gap={{ base: '2', md: '2.5' }}
          align="center"
          overflowX={{ base: 'auto', lg: 'visible' }}
          overflowY="hidden"
          flexWrap="nowrap"
          pr={{ base: '1', lg: '0' }}
          sx={{
            WebkitOverflowScrolling: 'touch',
            scrollbarWidth: 'none',
            '&::-webkit-scrollbar': {
              display: 'none',
            },
          }}
        >
          <TabList
            borderBottom="none"
            p="0"
            m="0"
            gap={{ base: '2', md: '2.5' }}
            flexWrap="nowrap"
            flex="0 0 auto"
            {...tabListProps}
          >
            {tabListItems.map(week => (
              <Tab
                key={week}
                whiteSpace="nowrap"
                mb="0"
                px={{ base: '3.5', lg: '4' }}
                py={{ base: '2.5', lg: '2.75' }}
                minH={{ base: '2.9rem', lg: '3.1rem' }}
                fontSize={{ base: 'sm', lg: 'md' }}
                fontWeight="semibold"
                rounded="2xl"
                color={chipStyles.color}
                bg={chipStyles.bg}
                borderWidth="1px"
                borderColor={chipStyles.borderColor}
                boxShadow={chipStyles.boxShadow}
                backdropFilter="blur(18px) saturate(168%)"
                transition="background 0.18s ease, border-color 0.18s ease, box-shadow 0.18s ease, transform 0.18s ease"
                position="relative"
                overflow="hidden"
                _before={{
                  content: '""',
                  position: 'absolute',
                  top: '-30%',
                  left: '-60%',
                  width: '48%',
                  height: '160%',
                  transform: 'rotate(18deg)',
                  background:
                    colorMode === 'dark'
                      ? 'linear-gradient(180deg, rgba(255,255,255,0.20), rgba(255,255,255,0))'
                      : 'linear-gradient(180deg, rgba(255,255,255,0.40), rgba(255,255,255,0))',
                  opacity: 0,
                  transition: 'opacity 0.22s ease, left 0.28s ease',
                  pointerEvents: 'none',
                }}
                _hover={{
                  bg: chipStyles.hover.bg,
                  borderColor: chipStyles.hover.borderColor,
                  boxShadow: chipStyles.hover.boxShadow,
                  transform: 'translateY(-1px)',
                  _before: {
                    opacity: 1,
                    left: '92%',
                  },
                }}
                _active={{
                  bg: chipStyles.active.bg,
                  boxShadow: chipStyles.active.boxShadow,
                  transform: 'translateY(1px) scale(0.985)',
                }}
                _selected={{
                  ...chipStyles.selected,
                  transform: 'translateY(-1px)',
                  _before: {
                    opacity: 0.72,
                    left: '30%',
                  },
                }}
                flexShrink={0}
              >
                {engToZh[week]}
              </Tab>
            ))}
          </TabList>

          {type === 'subscribe' ? (
            <ActionChip
              colorMode={colorMode}
              selected={!!searchOpen}
              onClick={onSearchToggle}
              display={{ base: 'inline-flex', lg: 'none' }}
            >
              搜索
            </ActionChip>
          ) : null}
        </Flex>

        {type === 'subscribe' || customElement ? (
          <Box
            flexShrink={0}
            display="flex"
            w={{ base: 'full', lg: 'auto' }}
            alignItems="center"
            justifyContent={{ base: 'flex-start', lg: 'flex-end' }}
            gap="2.5"
            ml={{ base: 0, lg: 'auto' }}
            flexWrap="wrap"
          >
            {type === 'subscribe' ? (
              <ActionChip
                colorMode={colorMode}
                selected={!!searchOpen}
                onClick={onSearchToggle}
                display={{ base: 'none', lg: 'inline-flex' }}
              >
                搜索
              </ActionChip>
            ) : null}
            {customElement}
          </Box>
        ) : null}
      </Flex>

      {type === 'subscribe' && searchOpen && searchPanel ? (
        <Box mt={{ base: '3', lg: '4' }} mb={{ base: '3', lg: '4' }} w="full" display="flex" justifyContent="center">
          <Box w="full" maxW={{ base: 'calc(100% - 0.5rem)', lg: '30rem' }}>
            {searchPanel}
          </Box>
        </Box>
      ) : null}

      <Box mt={searchOpen ? 0 : 3} {...boxProps} />
      {standaloneContent ? standaloneContent : <TabPanels>{children}</TabPanels>}
    </Tabs>
  );
}
