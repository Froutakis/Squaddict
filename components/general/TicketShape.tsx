import { useId, useState } from 'react';
import { StyleSheet, View, type LayoutChangeEvent, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { ClipPath, Defs, Path, Rect } from 'react-native-svg';

type TicketShapeProps = {
  fill: string;
  // Corner radius and the half-circle bitten out of each side.
  corner?: number;
  notch?: number;
  // Where the notches sit, from the top; the middle when left out.
  notchAt?: number;
  stroke?: string;
  // A 3px band down the left edge, following the corners: the sun on a live plan.
  stripe?: string;
  style?: StyleProp<ViewStyle>;
};

// A ticket's outline drawn behind its content: rounded corners and a real
// half-circle cut out of each side, so whatever is behind (the ticket pattern
// on the page) shows through the notches. Drawn once the size is known.
export default function TicketShape({ fill, corner = 16, notch = 7, notchAt, stroke, stripe, style }: TicketShapeProps) {
  const clipId = `ticket${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);

  function onLayout(event: LayoutChangeEvent) {
    const { width, height } = event.nativeEvent.layout;
    setSize((was) => (was && was.w === width && was.h === height ? was : { w: width, h: height }));
  }

  return (
    <View style={[StyleSheet.absoluteFill, style]} onLayout={onLayout} pointerEvents="none">
      {size && size.w > 0 && size.h > 0 ? (
        <Svg width={size.w} height={size.h}>
          {stripe ? (
            <Defs>
              <ClipPath id={clipId}>
                <Path d={ticketPath(size.w, size.h, corner, notch, notchAt ?? size.h / 2)} />
              </ClipPath>
            </Defs>
          ) : null}
          <Path
            d={ticketPath(size.w, size.h, corner, notch, notchAt ?? size.h / 2)}
            fill={fill}
            stroke={stroke}
            strokeWidth={stroke ? 1.5 : 0}
          />
          {stripe ? <Rect x={0} y={0} width={3} height={size.h} fill={stripe} clipPath={`url(#${clipId})`} /> : null}
        </Svg>
      ) : null}
    </View>
  );
}

// A rounded rectangle with a half-circle cut into the left and right sides.
export function ticketPath(w: number, h: number, corner: number, notch: number, at: number): string {
  const r = Math.min(corner, w / 2, h / 2);
  const n = Math.max(0, Math.min(notch, at - r, h - r - at));
  if (n <= 0) {
    return `M${r},0 H${w - r} A${r},${r} 0 0 1 ${w},${r} V${h - r} A${r},${r} 0 0 1 ${w - r},${h} H${r} A${r},${r} 0 0 1 0,${h - r} V${r} A${r},${r} 0 0 1 ${r},0 Z`;
  }
  return [
    `M${r},0 H${w - r} A${r},${r} 0 0 1 ${w},${r}`,
    `V${at - n} A${n},${n} 0 0 0 ${w},${at + n}`,
    `V${h - r} A${r},${r} 0 0 1 ${w - r},${h} H${r} A${r},${r} 0 0 1 0,${h - r}`,
    `V${at + n} A${n},${n} 0 0 0 0,${at - n}`,
    `V${r} A${r},${r} 0 0 1 ${r},0 Z`,
  ].join(' ');
}
