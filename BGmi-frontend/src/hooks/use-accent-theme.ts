import { atom, useAtom } from 'jotai';
import { useColorMode } from './use-color-mode';

export type PaletteMode = 'light' | 'dark';
export type GlassStyle = 'clear' | 'frosted' | 'liquid';
export type PaletteColors = { accent: string; background: string; sidebar: string; surface: string; text: string };
export type PalettePresetName = 'ocean' | 'teal' | 'sand' | 'slate' | 'violet' | 'rose';
type ModeSelection = { preset: PalettePresetName | 'custom'; custom: PaletteColors };
type PaletteSettings = Record<PaletteMode, ModeSelection>;

export const palettePresets: { name: PalettePresetName; label: string; light: PaletteColors; dark: PaletteColors }[] = [
  { name: 'ocean', label: '海蓝', light: { accent: '#0284C7', background: '#EAF5FA', sidebar: '#DDEEF5', surface: '#FFFFFF', text: '#203447' }, dark: { accent: '#38BDF8', background: '#0B1728', sidebar: '#0B1424', surface: '#152236', text: '#E8F2FA' } },
  { name: 'teal', label: '青绿', light: { accent: '#0F766E', background: '#E9F6F2', sidebar: '#DCEEE8', surface: '#FFFFFF', text: '#1D3937' }, dark: { accent: '#2DD4BF', background: '#0B1C1D', sidebar: '#0A1719', surface: '#14292A', text: '#E2F5F0' } },
  { name: 'sand', label: '暖砂', light: { accent: '#B45309', background: '#F7F1E8', sidebar: '#EFE3D1', surface: '#FFFCF7', text: '#403225' }, dark: { accent: '#FBBF24', background: '#201A14', sidebar: '#191510', surface: '#30271D', text: '#F5EAD6' } },
  { name: 'slate', label: '石墨', light: { accent: '#475569', background: '#EFF1F3', sidebar: '#E2E6EA', surface: '#FFFFFF', text: '#263241' }, dark: { accent: '#94A3B8', background: '#11151C', sidebar: '#0C1016', surface: '#202733', text: '#E7EBF0' } },
  { name: 'violet', label: '紫灰', light: { accent: '#7C3AED', background: '#F2EFF8', sidebar: '#E8E2F1', surface: '#FFFFFF', text: '#322A42' }, dark: { accent: '#A78BFA', background: '#191622', sidebar: '#12101A', surface: '#272233', text: '#F0EBFA' } },
  { name: 'rose', label: '樱粉', light: { accent: '#BE4967', background: '#FAF0F2', sidebar: '#F1E1E6', surface: '#FFFDFD', text: '#422B35' }, dark: { accent: '#FB7185', background: '#21151B', sidebar: '#190F15', surface: '#302129', text: '#F9EAF0' } },
];

const paletteKeys: (keyof PaletteColors)[] = ['accent', 'background', 'sidebar', 'surface', 'text'];
const storageKey = 'bgmi-theme-palettes';
const glassStorageKey = 'bgmi-glass-style';
const defaultSettings: PaletteSettings = {
  light: { preset: 'ocean', custom: palettePresets[0].light },
  dark: { preset: 'ocean', custom: palettePresets[0].dark },
};
const settingsAtom = atom<PaletteSettings>(readSettings());
const glassStyleAtom = atom<GlassStyle>(readGlassStyle());

function isHexColor(value: unknown): value is string {
  return typeof value === 'string' && /^#[0-9a-fA-F]{6}$/.test(value);
}

function readSettings(): PaletteSettings {
  if (typeof window === 'undefined') return defaultSettings;
  try {
    const saved = JSON.parse(window.localStorage.getItem(storageKey) || '{}') as Partial<PaletteSettings>;
    const result = { ...defaultSettings };
    for (const mode of ['light', 'dark'] as const) {
      const entry = saved[mode];
      const preset = entry?.preset;
      const custom = entry?.custom;
      if (!entry || !custom || !paletteKeys.every(key => isHexColor(custom[key]))) continue;
      if (preset !== 'custom' && !palettePresets.some(item => item.name === preset)) continue;
      result[mode] = { preset: preset as ModeSelection['preset'], custom };
    }
    return result;
  } catch {
    return defaultSettings;
  }
}

function readGlassStyle(): GlassStyle {
  if (typeof window === 'undefined') return 'liquid';
  try {
    const stored = window.localStorage.getItem(glassStorageKey);
    return stored === 'clear' || stored === 'frosted' || stored === 'liquid' ? stored : 'liquid';
  } catch {
    return 'liquid';
  }
}

function resolvePalette(settings: PaletteSettings, mode: PaletteMode): PaletteColors {
  const selection = settings[mode];
  return selection.preset === 'custom'
    ? selection.custom
    : (palettePresets.find(item => item.name === selection.preset) ?? palettePresets[0])[mode];
}

export function useAccentTheme() {
  const [settings, setSettings] = useAtom(settingsAtom);
  const [glassStyle, setGlassStyle] = useAtom(glassStyleAtom);
  const { colorMode } = useColorMode();
  const mode: PaletteMode = colorMode === 'light' ? 'light' : 'dark';

  const update = (next: PaletteSettings) => {
    setSettings(next);
    window.localStorage.setItem(storageKey, JSON.stringify(next));
  };
  const selectPreset = (targetMode: PaletteMode, preset: PalettePresetName) => {
    update({ ...settings, [targetMode]: { ...settings[targetMode], preset } });
  };
  const saveCustom = (targetMode: PaletteMode, colors: PaletteColors) => {
    if (!paletteKeys.every(key => isHexColor(colors[key]))) return;
    update({ ...settings, [targetMode]: { preset: 'custom', custom: colors } });
  };

  const colors = resolvePalette(settings, mode);
  return {
    mode,
    colors,
    settings,
    getPalette: (targetMode: PaletteMode) => resolvePalette(settings, targetMode),
    selectPreset,
    saveCustom,
    glassStyle,
    setGlassStyle: (style: GlassStyle) => {
      setGlassStyle(style);
      window.localStorage.setItem(glassStorageKey, style);
    },
    theme: {
      name: settings[mode].preset,
      primary: colors.accent,
      soft: `${colors.accent}24`,
      border: `${colors.accent}55`,
      darkBackground: resolvePalette(settings, 'dark').background,
      lightBackground: resolvePalette(settings, 'light').background,
    },
  };
}
