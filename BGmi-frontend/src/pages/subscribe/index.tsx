import { useEffect, useMemo, useReducer, useState } from 'react';
import { CiFilter, CiSearch } from 'react-icons/ci';
import {
  Box,
  Button,
  Divider,
  Flex,
  Icon,
  Input,
  Menu,
  MenuButton,
  MenuItem,
  MenuList,
  Portal,
  Spinner,
} from '@chakra-ui/react';

import { useAtom } from 'jotai';

import Auth from '~/components/auth';
import CalendarTab from '~/components/calendar-tab';
import MobileLiquidGlass from '~/components/layout/mobile-liquid-glass';
import SubscribePanel from '~/components/subscribe-panel';
import { bangumiFilterAtom, type DataKind } from '~/hooks/use-bangumi';
import { useCalendar } from '~/hooks/use-calendar';
import { useColorMode } from '~/hooks/use-color-mode';
import { useAccentTheme } from '~/hooks/use-accent-theme';

import type { CalendarData, CalendarDataEntries, CalendarDataKey, WeekCalendar } from '~/types/calendar';

interface FilterOptionsState {
  subscribed: boolean;
  unSubscribed: boolean;
}

interface FilterOptionsAction {
  type: 'subscribed' | 'unSubscribed';
  mutate: () => void;
}

const initialFilterOptionsState: FilterOptionsState = {
  subscribed: false,
  unSubscribed: false,
};

const filterOptionsReducer = (state: FilterOptionsState, action: FilterOptionsAction) => {
  switch (action.type) {
    case 'subscribed':
      action.mutate();
      return {
        subscribed: !state.subscribed,
        unSubscribed: false,
      };
    case 'unSubscribed':
      action.mutate();
      return {
        unSubscribed: !state.unSubscribed,
        subscribed: false,
      };
    default:
      throw new Error('Unexpected action');
  }
};

interface FilterOptionsMenuProps {
  state: FilterOptionsState;
  dispatch: (action: FilterOptionsAction) => void;
  mutate: () => void;
}

function FilterOptionsMenu({ state, dispatch, mutate }: FilterOptionsMenuProps) {
  const { colorMode } = useColorMode();
  const { colors, theme } = useAccentTheme();
  const [bangumiShow, setBangumiShow] = useAtom(bangumiFilterAtom);
  const isDark = colorMode === 'dark';

  const selectedBg = theme.soft;

  const handleShow = (type: DataKind) => {
    setBangumiShow(current => (current === type ? 'both' : type));
  };

  return (
    <Box display="flex" alignItems="center" justifyContent="flex-end" h="full" w="auto" pl={{ base: 0, lg: 1 }}>
      <Box display={{ base: 'none', lg: 'flex' }} alignItems="center">
        <Menu autoSelect={false} closeOnSelect={false} placement="bottom-end">
          <MenuButton
            as={Button}
            leftIcon={<CiFilter size="17" />}
            size="sm"
            h="2.5rem"
            w="auto"
            minW="unset"
            px="3.5"
            lineHeight="1"
            display="inline-flex"
            alignItems="center"
            justifyContent="center"
            gap="1.5"
            rounded="full"
            color={colors.text}
            bg={`${colors.surface}A8`}
            borderWidth="1px"
            borderColor={theme.border}
            boxShadow={
              isDark
                ? '0 14px 30px rgba(0,0,0,0.18), inset 0 1px 0 rgba(255,255,255,0.06)'
                : '0 14px 30px rgba(39,87,116,0.10), inset 0 1px 0 rgba(255,255,255,0.52)'
            }
            backdropFilter="blur(22px) saturate(170%)"
            fontSize="sm"
            fontWeight="semibold"
            _hover={{
              bg: theme.soft,
              borderColor: colors.accent,
            }}
          >
            筛选
          </MenuButton>
          <Portal>
            <MenuList
              minW="36"
              zIndex={1600}
              bg={`${colors.surface}EB`}
              color={colors.text}
              borderColor={theme.border}
              boxShadow={
                isDark
                  ? '0 18px 44px rgba(0,0,0,0.28), inset 0 1px 0 rgba(255,255,255,0.06)'
                  : '0 18px 44px rgba(39,87,116,0.12), 0 6px 18px rgba(94,188,214,0.12), inset 0 1px 0 rgba(255,255,255,0.56)'
              }
              backdropFilter="blur(22px) saturate(170%)"
              sx={{ WebkitBackdropFilter: 'blur(22px) saturate(170%)' }}
            >
              <MenuItem justifyContent="center" bg={state.subscribed ? selectedBg : 'transparent'} _hover={{ bg: theme.soft }} _focus={{ bg: theme.soft }} onClick={() => dispatch({ type: 'subscribed', mutate })}>
                仅看已订阅
              </MenuItem>
              <MenuItem justifyContent="center" bg={state.unSubscribed ? selectedBg : 'transparent'} _hover={{ bg: theme.soft }} _focus={{ bg: theme.soft }} onClick={() => dispatch({ type: 'unSubscribed', mutate })}>
                仅看未订阅
              </MenuItem>
              <Divider borderColor={theme.border} />
              <MenuItem justifyContent="center" bg={bangumiShow === 'new' ? selectedBg : 'transparent'} _hover={{ bg: theme.soft }} _focus={{ bg: theme.soft }} onClick={() => handleShow('new')}>
                仅显示新番
              </MenuItem>
              <MenuItem justifyContent="center" bg={bangumiShow === 'old' ? selectedBg : 'transparent'} _hover={{ bg: theme.soft }} _focus={{ bg: theme.soft }} onClick={() => handleShow('old')}>
                仅显示旧番
              </MenuItem>
            </MenuList>
          </Portal>
        </Menu>
      </Box>

      <Box display={{ base: 'flex', lg: 'none' }} alignItems="center">
        <Menu autoSelect={false} closeOnSelect={false} placement="bottom-end">
        <MenuButton
          as={Button}
          leftIcon={<CiFilter size="17" />}
          size="sm"
          h={{ base: '2.55rem', lg: '2.5rem' }}
          w="auto"
          minW="unset"
          px={{ base: '4', lg: '3.5' }}
          lineHeight="1"
          display={{ base: 'none', lg: 'inline-flex' }}
          alignItems="center"
          justifyContent="center"
          gap="1.5"
          rounded="full"
          color={colors.text}
          bg={`${colors.surface}A8`}
          borderWidth="1px"
          borderColor={theme.border}
          boxShadow={
            isDark
              ? '0 14px 30px rgba(0,0,0,0.18), inset 0 1px 0 rgba(255,255,255,0.06)'
              : '0 14px 30px rgba(39,87,116,0.10), inset 0 1px 0 rgba(255,255,255,0.52)'
          }
          backdropFilter="blur(22px) saturate(170%)"
          fontSize={{ base: 'sm', lg: 'sm' }}
          fontWeight="semibold"
          _hover={{
            bg: theme.soft,
            borderColor: colors.accent,
          }}
        >
          筛选
        </MenuButton>
        <MenuButton
          as={Box}
          type="button"
          aria-label="筛选"
          display={{ base: 'block', lg: 'none' }}
          position="relative"
          w="2.55rem"
          h="2.55rem"
          rounded="full"
          overflow="hidden"
          bg="transparent"
          borderWidth="0"
          p="0"
          cursor="pointer"
          sx={{
            WebkitTapHighlightColor: 'transparent',
          }}
        >
          <Flex
            position="absolute"
            inset="0"
            zIndex="0"
            align="center"
            justify="center"
            color={colors.accent}
            pointerEvents="none"
            filter={isDark ? 'drop-shadow(0 0 10px rgba(125,211,252,0.62)) drop-shadow(0 0 18px rgba(56,189,248,0.28))' : 'drop-shadow(0 1px 4px rgba(255,255,255,0.72))'}
          >
            <Icon as={CiFilter} boxSize="17px" strokeWidth="1.35" />
          </Flex>
          <MobileLiquidGlass
            width={40.8}
            height={40.8}
            borderRadius={20.4}
            strength={22}
            blur={0.42}
            style={{
              zIndex: 1,
              background: `${colors.surface}80`,
              borderColor: theme.border,
              boxShadow: isDark
                ? 'inset 0 1px 2px rgba(255,255,255,0.46), inset 0 -12px 22px rgba(125,211,252,0.10), 0 0 0 1px rgba(56,189,248,0.10), 0 10px 24px rgba(0,0,0,0.22)'
                : 'inset 0 1px 2px rgba(255,255,255,0.76), inset 0 -12px 22px rgba(255,255,255,0.18), 0 10px 24px rgba(34,68,92,0.10)',
            }}
          />
        </MenuButton>
        <Portal>
          <MenuList
            minW="36"
            zIndex={1600}
            bg={`${colors.surface}EB`}
            color={colors.text}
            borderColor={theme.border}
            boxShadow={
              isDark
                ? '0 18px 44px rgba(0,0,0,0.28), inset 0 1px 0 rgba(255,255,255,0.06)'
                : '0 18px 44px rgba(39,87,116,0.12), 0 6px 18px rgba(94,188,214,0.12), inset 0 1px 0 rgba(255,255,255,0.56)'
            }
            backdropFilter="blur(22px) saturate(170%)"
            sx={{ WebkitBackdropFilter: 'blur(22px) saturate(170%)' }}
          >
            <MenuItem justifyContent="center" bg={state.subscribed ? selectedBg : 'transparent'} _hover={{ bg: theme.soft }} _focus={{ bg: theme.soft }} onClick={() => dispatch({ type: 'subscribed', mutate })}>
              仅看已订阅
            </MenuItem>
            <MenuItem justifyContent="center" bg={state.unSubscribed ? selectedBg : 'transparent'} _hover={{ bg: theme.soft }} _focus={{ bg: theme.soft }} onClick={() => dispatch({ type: 'unSubscribed', mutate })}>
              仅看未订阅
            </MenuItem>
            <Divider borderColor={theme.border} />
            <MenuItem justifyContent="center" bg={bangumiShow === 'new' ? selectedBg : 'transparent'} _hover={{ bg: theme.soft }} _focus={{ bg: theme.soft }} onClick={() => handleShow('new')}>
              仅显示新番
            </MenuItem>
            <MenuItem justifyContent="center" bg={bangumiShow === 'old' ? selectedBg : 'transparent'} _hover={{ bg: theme.soft }} _focus={{ bg: theme.soft }} onClick={() => handleShow('old')}>
              仅显示旧番
            </MenuItem>
          </MenuList>
        </Portal>
        </Menu>
      </Box>
    </Box>
  );
}

function SearchPanel({
  keyword,
  onKeywordChange,
}: {
  keyword: string;
  onKeywordChange: (value: string) => void;
}) {
  const { colorMode } = useColorMode();
  const { colors, theme } = useAccentTheme();
  const isDark = colorMode === 'dark';

  return (
    <Box
      data-bgmi-glass-panel
      px="2"
      py="2"
      rounded="20px"
      borderWidth="1px"
      borderColor={theme.border}
      bg={`${colors.surface}8F`}
      boxShadow={
        isDark
          ? '0 18px 36px rgba(0,0,0,0.18), inset 0 1px 0 rgba(255,255,255,0.05)'
          : '0 16px 32px rgba(39,87,116,0.10), inset 0 1px 0 rgba(255,255,255,0.46)'
      }
      backdropFilter="blur(24px) saturate(180%)"
    >
      <Box
        w="full"
        rounded="16px"
        borderWidth="1px"
        borderColor={theme.border}
        bg={`${colors.surface}70`}
        boxShadow={
          isDark
            ? '0 10px 24px rgba(0,0,0,0.12), inset 0 1px 0 rgba(255,255,255,0.06)'
            : '0 10px 24px rgba(39,87,116,0.08), inset 0 1px 0 rgba(255,255,255,0.48)'
        }
        backdropFilter="blur(20px) saturate(175%)"
        _before={{
          content: '""',
          position: 'absolute',
          inset: '1px',
          borderRadius: 'inherit',
          pointerEvents: 'none',
          background: `linear-gradient(180deg, ${colors.accent}18, transparent 58%)`,
        }}
        position="relative"
      >
        <Box
          position="absolute"
          left="1rem"
          top="50%"
          transform="translateY(-50%)"
          zIndex="2"
          color={colors.accent}
          display="flex"
          alignItems="center"
          justifyContent="center"
        >
          <CiSearch size="20" />
        </Box>
        <Input
          autoFocus
          placeholder="搜索动画片"
          value={keyword}
          onChange={event => onKeywordChange(event.target.value)}
          h={{ base: '3rem', md: '3.1rem' }}
          pl="2.85rem"
          pr="1rem"
          rounded="16px"
          border="none"
          bg="transparent"
          color={colors.text}
          fontSize={{ base: 'sm', md: 'md' }}
          fontWeight="500"
          lineHeight="1"
          _placeholder={{ color: `${colors.text}88` }}
          _focusVisible={{
            boxShadow: `0 0 0 1px ${theme.border}, 0 0 0 4px ${theme.soft}, 0 14px 30px ${colors.accent}22`,
          }}
        />
      </Box>
    </Box>
  );
}

export default function Subscribe() {
  const { data, mutate } = useCalendar();
  const [state, dispatch] = useReducer(filterOptionsReducer, initialFilterOptionsState);
  const [searchOpen, setSearchOpen] = useState(false);
  const [keyword, setKeyword] = useState('');
  const [activeTab, setActiveTab] = useState<string>('');
  const [didInitializeTab, setDidInitializeTab] = useState(false);

  const calendarData = useMemo(() => {
    if (!data) return;

    const normalizedKeyword = keyword.trim().toLowerCase();
    return Object.fromEntries(
      (Object.entries(data.data) as CalendarDataEntries).map(([week, weekData]) => [
        week,
        weekData?.filter(bangumi => {
        const matchKeyword = normalizedKeyword.length === 0 || bangumi.name.toLowerCase().includes(normalizedKeyword);
        if (!matchKeyword) return false;
        if (state.subscribed) return bangumi.status;
        if (state.unSubscribed) return !bangumi.status;
        return true;
        }).sort((a, b) => Number(Boolean(b.status)) - Number(Boolean(a.status))),
      ])
    ) as CalendarData;
  }, [data, keyword, state]);

  const weekdayTabItems = useMemo(() => {
    const keys = new Set(Object.keys(calendarData ?? []));
    const ordered: string[] = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'].filter(key => keys.has(key));
    if (keys.has('unknown')) ordered.push('unknown');
    return ordered as CalendarDataKey[];
  }, [calendarData]);
  const tabListItems = useMemo<string[]>(() => [...weekdayTabItems], [weekdayTabItems]);
  const tabPanelsItems = useMemo(() => Object.entries(calendarData ?? []) as CalendarDataEntries, [calendarData]);
  const todayWeekday = useMemo<CalendarDataKey>(
    () => (['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'][new Date().getDay()] ?? 'sun') as CalendarDataKey,
    []
  );
  const resolvedActiveTab = useMemo(() => {
    if (activeTab && tabListItems.includes(activeTab)) return activeTab;
    if (weekdayTabItems.includes(todayWeekday as CalendarDataKey)) return todayWeekday;
    return weekdayTabItems[0] ?? '';
  }, [activeTab, tabListItems, todayWeekday, weekdayTabItems]);
  const globalSearchResults = useMemo(() => {
    const deduped = new Map<string, WeekCalendar>();

    tabPanelsItems.forEach(([_, bangumis]) => {
      bangumis?.forEach(bangumi => {
        deduped.set(bangumi.id, bangumi);
      });
    });

    return Array.from(deduped.values());
  }, [tabPanelsItems]);

  useEffect(() => {
    if (tabListItems.length === 0 || didInitializeTab) return;
    const fallbackTab = weekdayTabItems.includes(todayWeekday as CalendarDataKey)
      ? todayWeekday
      : weekdayTabItems[0] ?? '';

    setActiveTab(fallbackTab);
    setDidInitializeTab(true);
  }, [didInitializeTab, tabListItems, todayWeekday, weekdayTabItems]);

  useEffect(() => {
    if (!didInitializeTab || !activeTab || tabListItems.includes(activeTab)) return;
    const fallbackTab = weekdayTabItems.includes(todayWeekday as CalendarDataKey)
      ? todayWeekday
      : weekdayTabItems[0] ?? '';
    setActiveTab(fallbackTab);
  }, [activeTab, didInitializeTab, tabListItems, todayWeekday, weekdayTabItems]);

  const handleActiveTabChange = (nextTab: string) => {
    const fallbackTab = weekdayTabItems.includes(todayWeekday as CalendarDataKey)
      ? todayWeekday
      : weekdayTabItems[0] ?? '';

    setDidInitializeTab(true);
    setSearchOpen(false);
    setActiveTab(nextTab || fallbackTab);
  };

  const activeContent = useMemo(() => {
    if (searchOpen) {
      return <SubscribePanel bangumis={globalSearchResults} standalone />;
    }

    const bangumis = calendarData?.[resolvedActiveTab as CalendarDataKey];
    return <SubscribePanel bangumis={bangumis} standalone />;
  }, [calendarData, globalSearchResults, resolvedActiveTab, searchOpen]);

  if (!calendarData || weekdayTabItems.length === 0 || tabPanelsItems.length === 0) {
    return (
      <Flex justifyContent="center" alignContent="center" mt={{ base: '28', md: '44' }}>
        <Spinner />
      </Flex>
    );
  }

  return (
    <Auth to="/subscribe">
      <CalendarTab
        customElement={<FilterOptionsMenu state={state} dispatch={dispatch} mutate={mutate} />}
        activeTabKey={resolvedActiveTab}
        onActiveTabChange={handleActiveTabChange}
        searchOpen={searchOpen}
        searchPanel={<SearchPanel keyword={keyword} onKeywordChange={setKeyword} />}
        standaloneContent={activeContent}
        contentKey={searchOpen ? 'search' : resolvedActiveTab || 'subscribe'}
        railActions={[
          {
            key: 'search',
            label: 'Search',
            icon: CiSearch,
            active: searchOpen,
            onSelect: () => setSearchOpen(true),
            ariaLabel: 'Search subscribe',
          },
        ]}
        tabListItems={tabListItems}
        tabListProps={{ mr: 0 }}
        boxProps={{ mt: 3 }}
        type="subscribe"
      />
    </Auth>
  );
}
