import { atom, useAtom } from 'jotai';
import { atomWithStorage } from 'jotai/utils';
import { useColorMode } from './use-color-mode';

export type PaletteMode = 'light' | 'dark';
/** 0 = liquid transparent glass, 100 = frosted glass. */
export type GlassStyle = number;
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
const windowTransparencyAtom = atomWithStorage('bgmi-window-transparency', 35);
const backgroundBrightnessAtom = atomWithStorage<Record<PaletteMode, number>>('bgmi-background-brightness', { light: 0, dark: 0 });
export const opticalSettingsAtom = atomWithStorage('bgmi-glass-optics', { refraction: 0.2, chromAberration: 0.08, zRadius: 10 });

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
  if (typeof window === 'undefined') return 10;
  try {
    const stored = window.localStorage.getItem(glassStorageKey);
    if (stored === 'clear' || stored === 'liquid') return 0;
    if (stored === 'frosted') return 100;
    if (stored === null) return 25;
    const value = Number(stored);
    return Number.isFinite(value) ? Math.max(0, Math.min(100, value)) : 10;
  } catch {
    return 10;
  }
}

export const glassSurfaceAlpha = (style: GlassStyle) => `${Math.round(0x18 + (0xe8 - 0x18) * (style / 100)).toString(16).padStart(2, '0')}`;
export const glassBlurValue = (style: GlassStyle) => `${2 + style * 0.34}px`;
export const glassSaturationValue = (style: GlassStyle) => `${112 - style * 0.04}%`;
export const windowGlassBlurValue = (style: GlassStyle) => `${34 * Math.pow(style / 100, 2)}px`;
export const windowGlassSurfaceValue = (transparency: number, mode: PaletteMode = 'light', surface = '#FFFFFF') => {
  const alpha = ((100 - transparency) / 100).toFixed(3);
  const match = surface.match(/^#([0-9a-f]{6})$/i);
  if (match) {
    const hex = match[1];
    return `rgba(${parseInt(hex.slice(0, 2), 16)},${parseInt(hex.slice(2, 4), 16)},${parseInt(hex.slice(4, 6), 16)},${alpha})`;
  }
  return mode === 'dark' ? `rgba(10,20,34,${alpha})` : `rgba(255,255,255,${alpha})`;
};
export const windowOverlayValue = (_mode: PaletteMode, brightness: number) => {
  const amount = Math.max(-30, Math.min(30, brightness));
  // Keep zero neutral, then scale the selected adjustment clearly enough to
  // see through the transparent glass while remaining subtle at the ends.
  const alpha = (Math.abs(amount) / 100).toFixed(3);
  return amount > 0 ? `rgba(255,255,255,${alpha})` : `rgba(0,0,0,${alpha})`;
};

function resolvePalette(settings: PaletteSettings, mode: PaletteMode): PaletteColors {
  const selection = settings[mode];
  return selection.preset === 'custom'
    ? selection.custom
    : (palettePresets.find(item => item.name === selection.preset) ?? palettePresets[0])[mode];
}

export function useAccentTheme() {
  const [settings, setSettings] = useAtom(settingsAtom);
  const [glassStyle, setGlassStyle] = useAtom(glassStyleAtom);
  const [windowTransparency, setWindowTransparency] = useAtom(windowTransparencyAtom);
  const [backgroundBrightness, setBackgroundBrightness] = useAtom(backgroundBrightnessAtom);
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
    backgroundBrightness,
    setBackgroundBrightness: (targetMode: PaletteMode, value: number) => {
      setBackgroundBrightness(previous => ({ ...previous, [targetMode]: Math.max(-30, Math.min(30, value)) }));
    },
    glassStyle,
    windowTransparency,
    setWindowTransparency: (value: number) => setWindowTransparency(Math.max(0, Math.min(100, value))),
    setGlassStyle: (style: GlassStyle) => {
      const value = Math.max(0, Math.min(100, style));
      setGlassStyle(value);
      window.localStorage.setItem(glassStorageKey, String(value));
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
