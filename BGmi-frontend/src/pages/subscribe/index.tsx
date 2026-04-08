import { useMemo, useReducer, useState } from 'react';
import { CiFilter } from 'react-icons/ci';
import {
  Box,
  Button,
  Divider,
  Flex,
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
import SubscribePanel from '~/components/subscribe-panel';
import { bangumiFilterAtom, type DataKind } from '~/hooks/use-bangumi';
import { useCalendar } from '~/hooks/use-calendar';
import { useColorMode } from '~/hooks/use-color-mode';

import type { Calendar, CalendarDataEntries, CalendarDataKey, WeekCalendar } from '~/types/calendar';

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
  const [bangumiShow, setBangumiShow] = useAtom(bangumiFilterAtom);

  const selectedBg = colorMode === 'dark' ? 'rgba(255,255,255,0.10)' : 'rgba(234,248,255,0.72)';

  const handleShow = (type: DataKind) => {
    setBangumiShow(current => (current === type ? 'both' : type));
  };

  return (
    <Box display="flex" alignItems="center" justifyContent="flex-start" h="full" w={{ base: 'full', lg: 'auto' }} pl={{ base: 0, lg: 1 }}>
      <Menu autoSelect={false} closeOnSelect={false} placement="bottom-end">
        <MenuButton
          as={Button}
          leftIcon={<CiFilter size="15" />}
          size="sm"
          h="10"
          w={{ base: 'full', lg: 'auto' }}
          minW="unset"
          px="4"
          lineHeight="1"
          bg={colorMode === 'dark' ? 'rgba(255,255,255,0.08)' : 'rgba(234,248,255,0.64)'}
          borderColor={colorMode === 'dark' ? 'whiteAlpha.140' : 'rgba(255,255,255,0.78)'}
          boxShadow={
            colorMode === 'dark'
              ? '0 10px 24px rgba(0,0,0,0.18), inset 0 1px 0 rgba(255,255,255,0.06)'
              : '0 14px 30px rgba(39,87,116,0.10), 0 4px 14px rgba(94,188,214,0.10), inset 0 1px 0 rgba(255,255,255,0.52)'
          }
        >
          筛选
        </MenuButton>
        <Portal>
          <MenuList
            minW="36"
            zIndex={1600}
            bg={colorMode === 'dark' ? 'rgba(25,30,42,0.88)' : 'rgba(244,252,255,0.88)'}
            borderColor={colorMode === 'dark' ? 'whiteAlpha.160' : 'rgba(255,255,255,0.80)'}
            boxShadow={
              colorMode === 'dark'
                ? '0 18px 44px rgba(0,0,0,0.28), inset 0 1px 0 rgba(255,255,255,0.06)'
                : '0 18px 44px rgba(39,87,116,0.12), 0 6px 18px rgba(94,188,214,0.12), inset 0 1px 0 rgba(255,255,255,0.56)'
            }
            backdropFilter="blur(22px) saturate(170%)"
          >
            <MenuItem justifyContent="center" bg={state.subscribed ? selectedBg : 'transparent'} onClick={() => dispatch({ type: 'subscribed', mutate })}>
              仅看已订阅
            </MenuItem>
            <MenuItem justifyContent="center" bg={state.unSubscribed ? selectedBg : 'transparent'} onClick={() => dispatch({ type: 'unSubscribed', mutate })}>
              仅看未订阅
            </MenuItem>
            <Divider />
            <MenuItem justifyContent="center" bg={bangumiShow === 'new' ? selectedBg : 'transparent'} onClick={() => handleShow('new')}>
              仅显示新番
            </MenuItem>
            <MenuItem justifyContent="center" bg={bangumiShow === 'old' ? selectedBg : 'transparent'} onClick={() => handleShow('old')}>
              仅显示旧番
            </MenuItem>
          </MenuList>
        </Portal>
      </Menu>
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
  const isDark = colorMode === 'dark';

  return (
    <Box
      px="2"
      py="2"
      rounded="2xl"
      borderWidth="1px"
      borderColor={isDark ? 'rgba(255,255,255,0.10)' : 'rgba(255,255,255,0.62)'}
      bg={isDark ? 'rgba(18,24,36,0.62)' : 'rgba(228,244,246,0.58)'}
      boxShadow={
        isDark
          ? '0 18px 36px rgba(0,0,0,0.18), inset 0 1px 0 rgba(255,255,255,0.05)'
          : '0 14px 28px rgba(39,87,116,0.10), 0 4px 10px rgba(94,188,214,0.08), inset 0 1px 0 rgba(255,255,255,0.42)'
      }
      backdropFilter="blur(22px) saturate(170%)"
    >
      <Box
        w="full"
        rounded="full"
        borderWidth="1px"
        borderColor={isDark ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.58)'}
        bg={isDark ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.20)'}
        boxShadow={
          isDark
            ? '0 10px 22px rgba(0,0,0,0.12), inset 0 1px 0 rgba(255,255,255,0.06)'
            : '0 10px 22px rgba(39,87,116,0.08), 0 3px 10px rgba(94,188,214,0.06), inset 0 1px 0 rgba(255,255,255,0.46)'
        }
        backdropFilter="blur(18px) saturate(170%)"
        _before={{
          content: '""',
          position: 'absolute',
          inset: '1px',
          borderRadius: 'inherit',
          pointerEvents: 'none',
          background: isDark
            ? 'linear-gradient(180deg, rgba(255,255,255,0.10), rgba(255,255,255,0.02) 38%, rgba(255,255,255,0) 100%)'
            : 'linear-gradient(180deg, rgba(255,255,255,0.48), rgba(255,255,255,0.14) 38%, rgba(255,255,255,0.02) 100%)',
        }}
        position="relative"
      >
        <Input
          placeholder="搜索动画片"
          value={keyword}
          onChange={event => onKeywordChange(event.target.value)}
          h="2.9rem"
          px="4.5"
          rounded="full"
          border="none"
          bg="transparent"
          color={isDark ? 'whiteAlpha.920' : '#516274'}
          fontSize={{ base: 'sm', md: 'md' }}
          lineHeight="1"
          _placeholder={{ color: isDark ? 'whiteAlpha.500' : 'rgba(79,95,110,0.52)' }}
          _focusVisible={{
            boxShadow: isDark
              ? '0 0 0 1px rgba(191,219,254,0.34), 0 10px 24px rgba(59,130,246,0.16)'
              : '0 0 0 1px rgba(148,211,255,0.62), 0 12px 28px rgba(94,188,214,0.16)',
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

  const calendarData = useMemo(() => {
    if (!data) return;

    const sortData = window.structuredClone(data) as Calendar;
    const normalizedKeyword = keyword.trim().toLowerCase();

    Object.values(sortData.data).forEach(week => {
      week?.sort(b => (!b.status ? 1 : -1));
    });

    const filterData = sortData.data;
    for (const [week, weekData] of Object.entries(sortData.data) as CalendarDataEntries) {
      filterData[week] = weekData?.filter(bangumi => {
        const matchKeyword = normalizedKeyword.length === 0 || bangumi.name.toLowerCase().includes(normalizedKeyword);

        if (!matchKeyword) return false;
        if (state.subscribed) return bangumi.status;
        if (state.unSubscribed) return !bangumi.status;
        return true;
      });
    }

    return filterData;
  }, [data, keyword, state]);

  const tabListItems = useMemo(() => Object.keys(calendarData ?? []) as CalendarDataKey[], [calendarData]);
  const tabPanelsItems = useMemo(() => Object.entries(calendarData ?? []) as CalendarDataEntries, [calendarData]);
  const globalSearchResults = useMemo(() => {
    const deduped = new Map<number, WeekCalendar>();

    tabPanelsItems.forEach(([_, bangumis]) => {
      bangumis?.forEach(bangumi => {
        deduped.set(bangumi.id, bangumi);
      });
    });

    return Array.from(deduped.values());
  }, [tabPanelsItems]);

  if (!calendarData || tabListItems.length === 0 || tabPanelsItems.length === 0) {
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
        searchOpen={searchOpen}
        searchPanel={<SearchPanel keyword={keyword} onKeywordChange={setKeyword} />}
        standaloneContent={keyword.trim() ? <SubscribePanel bangumis={globalSearchResults} standalone /> : undefined}
        onSearchToggle={() => setSearchOpen(value => !value)}
        tabListItems={tabListItems}
        tabListProps={{ mr: 0 }}
        boxProps={{ mt: 3 }}
        type="subscribe"
      >
        {tabPanelsItems.map(([week, bangumis]) => (
          <SubscribePanel key={week} bangumis={bangumis} />
        ))}
      </CalendarTab>
    </Auth>
  );
}
