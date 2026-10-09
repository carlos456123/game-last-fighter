/**
 * LAST FIGHTER design system: one source of truth for colours, type, spacing and states,
 * shared by menus, character select, HUD, settings and tutorial.
 */
export const COLORS = {
  bg: 0x07060c,
  bgTop: 0x150d22,
  panel: 0x12101c,
  panelHi: 0x1f1a30,
  line: 0x3b3452,
  lineHi: 0x6b5f8c,
  accent: 0xff4d2e,
  accentHi: 0xff7a45,
  gold: 0xffc24a,
  cyan: 0x3fe0c5,
  danger: 0xff3355,
  success: 0x5be37a,
  energy: 0x4fb4ff,
  energyFull: 0xffd34a,
  white: 0xffffff,
  black: 0x000000,
  shadow: 0x000000,
} as const;

export const TEXT_COLORS = {
  primary: '#f6f0e6',
  dim: '#a8a0b8',
  muted: '#6d6680',
  accent: '#ff6a3d',
  gold: '#ffc24a',
  cyan: '#3fe0c5',
  danger: '#ff4d6a',
  success: '#6fe88a',
  dark: '#0b0910',
} as const;

export const FONTS = {
  display: '"Russo One", "Arial Black", sans-serif',
  body: '"Chakra Petch", "Segoe UI", sans-serif',
} as const;

export const TYPE = {
  hero: 96,
  h1: 56,
  h2: 38,
  h3: 28,
  body: 22,
  small: 18,
  tiny: 15,
} as const;

export const SPACE = { xs: 4, sm: 8, md: 16, lg: 24, xl: 40 } as const;
export const RADIUS = { sm: 4, md: 8, lg: 14 } as const;

export const BUTTON = {
  width: 380,
  height: 58,
  hoverShift: 8,
  pressScale: 0.97,
  disabledAlpha: 0.38,
} as const;

export const DEPTH = {
  background: 0,
  world: 10,
  fighters: 20,
  projectiles: 30,
  vfx: 40,
  hud: 100,
  overlay: 200,
  modal: 300,
  debug: 1000,
} as const;

export const toCss = (color: number): string => `#${color.toString(16).padStart(6, '0')}`;

export interface TextStyleOptions {
  size?: number;
  color?: string;
  font?: 'display' | 'body';
  bold?: boolean;
  align?: 'left' | 'center' | 'right';
  wrap?: number;
  stroke?: boolean;
}

/** Builds a Phaser text style from design tokens. */
export const textStyle = (o: TextStyleOptions = {}): Phaser.Types.GameObjects.Text.TextStyle => ({
  fontFamily: FONTS[o.font ?? 'body'],
  fontSize: `${o.size ?? TYPE.body}px`,
  color: o.color ?? TEXT_COLORS.primary,
  fontStyle: o.bold ? 'bold' : 'normal',
  align: o.align ?? 'left',
  wordWrap: o.wrap ? { width: o.wrap, useAdvancedWrap: true } : undefined,
  stroke: o.stroke ? '#000000' : undefined,
  strokeThickness: o.stroke ? Math.max(3, Math.round((o.size ?? TYPE.body) / 8)) : 0,
});
