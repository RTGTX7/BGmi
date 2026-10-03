import { useId, useLayoutEffect, useRef, type Ref } from 'react';

interface MobileLiquidGlassProps {
  width: number;
  height: number;
  borderRadius: number;
  x?: number;
  y?: number;
  strength?: number;
  edgeWidth?: number;
  resolution?: number;
  rimOnly?: boolean;
  filterOnly?: boolean;
  filterTarget?: HTMLElement | null;
  blur?: number;
  saturation?: number;
  opacity?: number;
  softenCorners?: boolean;
  droplet?: {
    active: boolean;
    centerX: number;
    centerY: number;
    radiusX: number;
    radiusY: number;
    strength?: number;
  };
  className?: string;
  elementRef?: Ref<HTMLDivElement>;
  style?: React.CSSProperties;
}

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

const smoothStep = (edge0: number, edge1: number, value: number) => {
  const t = clamp((value - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
};

const roundedRectSdf = (x: number, y: number, halfWidth: number, halfHeight: number, radius: number) => {
  const qx = Math.abs(x) - halfWidth + radius;
  const qy = Math.abs(y) - halfHeight + radius;
  return Math.min(Math.max(qx, qy), 0) + Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) - radius;
};

export default function MobileLiquidGlass({
  width,
  height,
  borderRadius,
  x = 0,
  y = 0,
  strength = 18,
  edgeWidth,
  resolution = 1,
  rimOnly = false,
  filterOnly = false,
  filterTarget,
  blur = 0.35,
  saturation = 100,
  opacity = 1,
  softenCorners = false,
  droplet,
  className,
  elementRef,
  style,
}: MobileLiquidGlassProps) {
  const rawId = useId();
  const safeId = rawId.replace(/[^a-zA-Z0-9_-]/g, '');
  const filterId = `mobile-liquid-glass-filter-${safeId}`;
  const mapId = `mobile-liquid-glass-map-${safeId}`;
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const imageRef = useRef<SVGFEImageElement | null>(null);
  const displacementRef = useRef<SVGFEDisplacementMapElement | null>(null);

  useLayoutEffect(() => {
    if (!filterOnly || !filterTarget) return;
    const previousBackdrop = filterTarget.style.getPropertyValue('backdrop-filter');
    const previousWebkit = filterTarget.style.getPropertyValue('-webkit-backdrop-filter');
    const previousBackdropPriority = filterTarget.style.getPropertyPriority('backdrop-filter');
    const previousWebkitPriority = filterTarget.style.getPropertyPriority('-webkit-backdrop-filter');
    const value = `url(#${filterId}) blur(${blur}px) saturate(${saturation}%)`;
    filterTarget.style.setProperty('backdrop-filter', value, 'important');
    filterTarget.style.setProperty('-webkit-backdrop-filter', value, 'important');
    return () => {
      if (previousBackdrop) filterTarget.style.setProperty('backdrop-filter', previousBackdrop, previousBackdropPriority);
      else filterTarget.style.removeProperty('backdrop-filter');
      if (previousWebkit) filterTarget.style.setProperty('-webkit-backdrop-filter', previousWebkit, previousWebkitPriority);
      else filterTarget.style.removeProperty('-webkit-backdrop-filter');
    };
  }, [blur, filterId, filterOnly, filterTarget, saturation]);

  useLayoutEffect(() => {
    const canvas = canvasRef.current;
    const image = imageRef.current;
    const displacement = displacementRef.current;
    if (!canvas || !image || !displacement || width <= 0 || height <= 0) return;

    const context = canvas.getContext('2d');
    if (!context) return;

    const pixelWidth = Math.max(1, Math.round(width * resolution));
    const pixelHeight = Math.max(1, Math.round(height * resolution));
    if (canvas.width !== pixelWidth) canvas.width = pixelWidth;
    if (canvas.height !== pixelHeight) canvas.height = pixelHeight;

    const halfWidth = pixelWidth / 2;
    const halfHeight = pixelHeight / 2;
    const radius = clamp(borderRadius * resolution, 0, Math.min(halfWidth, halfHeight));
    const rimWidth = edgeWidth === undefined ? Math.max(8, Math.min(pixelWidth, pixelHeight) * 0.22) : edgeWidth * resolution;
    const data = new Uint8ClampedArray(pixelWidth * pixelHeight * 4);

    let index = 0;
    for (let py = 0; py < pixelHeight; py += 1) {
      for (let px = 0; px < pixelWidth; px += 1) {
        const centeredX = px - halfWidth;
        const centeredY = py - halfHeight;
        const distance = roundedRectSdf(centeredX, centeredY, halfWidth, halfHeight, radius);
        const inside = 1 - smoothStep(-1, 1, distance);
        const edge = 1 - smoothStep(0, rimWidth, Math.abs(distance));
        const core = rimOnly ? 0 : 0.12 * (1 - smoothStep(0, 1, Math.hypot(centeredX / halfWidth, centeredY / halfHeight)));
        const cornerX = smoothStep(halfWidth - radius * 2, halfWidth - radius, Math.abs(centeredX));
        const cornerY = smoothStep(halfHeight - radius * 2, halfHeight - radius, Math.abs(centeredY));
        const cornerAttenuation = softenCorners ? 1 - cornerX * cornerY : 1;
        const baseBend = inside * Math.max(edge, core) * strength * cornerAttenuation;
        let dx = (centeredX / halfWidth) * baseBend;
        let dy = (centeredY / halfHeight) * baseBend;

        if (droplet?.active) {
          const localX = px - droplet.centerX * resolution;
          const localY = py - droplet.centerY * resolution;
          const normalizedX = localX / Math.max(1, droplet.radiusX * resolution);
          const normalizedY = localY / Math.max(1, droplet.radiusY * resolution);
          const distance = Math.hypot(normalizedX, normalizedY);
          const body = 1 - smoothStep(0.05, 1, distance);
          const rim = 1 - smoothStep(0, 0.28, Math.abs(distance - 0.82));
          const pull = (body * 0.72 + rim * 1.1) * (droplet.strength ?? strength * 1.25) * inside * (rimOnly ? edge : 1);
          const directionX = normalizedX / Math.max(0.25, distance);
          const directionY = normalizedY / Math.max(0.25, distance);

          dx += directionX * pull;
          dy += directionY * pull * 0.72;
        }

        data[index] = clamp(Math.round((dx / strength) * 127 + 128), 0, 255);
        data[index + 1] = clamp(Math.round((dy / strength) * 127 + 128), 0, 255);
        data[index + 2] = 128;
        data[index + 3] = 255;
        index += 4;
      }
    }

    context.putImageData(new ImageData(data, pixelWidth, pixelHeight), 0, 0);
    const source = canvas.toDataURL();
    image.setAttribute('href', source);
    image.setAttributeNS('http://www.w3.org/1999/xlink', 'href', source);
    displacement.setAttribute('scale', strength.toString());
  }, [borderRadius, droplet, edgeWidth, height, resolution, rimOnly, softenCorners, strength, width]);

  if (width <= 0 || height <= 0) return null;

  return (
    <>
      <svg width="0" height="0" aria-hidden="true" style={{ position: 'absolute', pointerEvents: 'none' }}>
        <defs>
          <filter
            id={filterId}
            x={-strength}
            y={-strength}
            width={width + strength * 2}
            height={height + strength * 2}
            filterUnits="userSpaceOnUse"
            colorInterpolationFilters="sRGB"
          >
            <feImage ref={imageRef} id={mapId} width={width} height={height} preserveAspectRatio="none" />
            <feDisplacementMap ref={displacementRef} in="SourceGraphic" in2={mapId} xChannelSelector="R" yChannelSelector="G" />
          </filter>
        </defs>
      </svg>
      <canvas ref={canvasRef} width={Math.round(width)} height={Math.round(height)} style={{ display: 'none' }} />
      {!filterOnly && <div
        ref={elementRef}
        className={className}
        style={{
          position: 'absolute',
          left: x,
          top: y,
          width,
          height,
          borderRadius,
          pointerEvents: 'none',
          opacity,
          overflow: 'hidden',
          background: 'rgba(255,255,255,0.035)',
          border: '1px solid rgba(255,255,255,0.38)',
          boxShadow:
            'inset 0 1px 1px rgba(255,255,255,0.55), inset 0 -10px 22px rgba(255,255,255,0.08), 0 12px 34px rgba(22,42,66,0.12)',
          backdropFilter: rimOnly ? `url(#${filterId}) blur(${blur}px)` : `url(#${filterId}) blur(${blur}px) contrast(1.18) brightness(1.08) saturate(1.18)`,
          WebkitBackdropFilter: rimOnly ? `url(#${filterId}) blur(${blur}px)` : `url(#${filterId}) blur(${blur}px) contrast(1.18) brightness(1.08) saturate(1.18)`,
          transition: 'opacity 140ms ease, transform 160ms cubic-bezier(0.2, 0.9, 0.2, 1)',
          ...style,
        }}
      />}
    </>
  );
}
