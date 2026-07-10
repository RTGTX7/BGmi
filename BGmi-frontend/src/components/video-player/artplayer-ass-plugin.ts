import type Artplayer from 'artplayer';
import type { Subtitle } from 'artplayer/types/subtitle';
import ASS from 'assjs';

interface ArtplayerAssPluginOptions {
  onError?: (error: unknown) => void;
}

function isAssType(type?: string) {
  return ['ass', 'ssa'].includes(String(type || '').toLowerCase());
}

function inferSubtitleType(url: string) {
  const path = url.split(/[?#]/, 1)[0] || '';
  return path.split('.').pop()?.toLowerCase() || '';
}

function isAssSubtitle(url: string, option?: Subtitle) {
  return isAssType(option?.type) || isAssType(inferSubtitleType(url));
}

export function artplayerAssPlugin(options: ArtplayerAssPluginOptions = {}) {
  return (art: Artplayer) => {
    const originalSwitch = art.subtitle.switch.bind(art.subtitle);
    const originalInit = art.subtitle.init.bind(art.subtitle);
    let assRenderer: ASS | null = null;
    let abortController: AbortController | null = null;
    let requestSeq = 0;

    const destroyAss = () => {
      requestSeq += 1;
      abortController?.abort();
      abortController = null;
      assRenderer?.destroy();
      assRenderer = null;
    };

    const ensureContainer = () => {
      let container = art.template.$player.querySelector<HTMLDivElement>('.JASSUB');
      if (!container) {
        container = document.createElement('div');
        container.className = 'JASSUB';
        art.template.$player.appendChild(container);
      }

      container.style.position = 'absolute';
      container.style.inset = '0';
      container.style.pointerEvents = 'none';
      container.style.zIndex = '20';
      container.style.display = '';
      return container;
    };

    const clearNativeSubtitle = () => {
      art.template.$subtitle.innerHTML = '';
      art.template.$track.removeAttribute('src');
      if (art.subtitle.textTrack) {
        art.subtitle.textTrack.mode = 'disabled';
      }
    };

    const switchAssSubtitle = async (url: string, option: Subtitle = {}) => {
      const requestId = requestSeq + 1;
      destroyAss();
      requestSeq = requestId;
      clearNativeSubtitle();

      if (!url) return '';

      const subtitleOption = {
        ...art.option.subtitle,
        ...option,
        url,
        type: isAssType(option.type) ? option.type : 'ass',
      };
      art.option.subtitle = subtitleOption;

      abortController = new AbortController();

      try {
        const response = await fetch(url, { signal: abortController.signal });
        if (!response.ok) throw new Error(`Failed to load ASS subtitle: ${response.status}`);
        const content = await response.text();
        if (requestSeq !== requestId || art.isDestroy) return '';

        const container = ensureContainer();
        assRenderer = new ASS(content, art.video, { container });
        assRenderer.delay = art.subtitleOffset || 0;
        art.emit('subtitleLoad', [], subtitleOption);
        return url;
      } catch (error) {
        if ((error as { name?: string })?.name !== 'AbortError') {
          options.onError?.(error);
        }
        return '';
      }
    };

    art.subtitle.switch = async (url: string, option: Subtitle = {}) => {
      if (isAssSubtitle(url, option)) {
        return switchAssSubtitle(url, option);
      }

      destroyAss();
      return originalSwitch(url, option);
    };

    art.subtitle.init = async (subtitle: Subtitle) => {
      if (subtitle?.url && isAssSubtitle(subtitle.url, subtitle)) {
        return switchAssSubtitle(subtitle.url, subtitle);
      }

      destroyAss();
      return originalInit(subtitle);
    };

    art.on('subtitleOffset', offset => {
      if (assRenderer) {
        assRenderer.delay = offset;
      }
    });
    art.on('destroy', destroyAss);
    art.on('restart', destroyAss);
  };
}
