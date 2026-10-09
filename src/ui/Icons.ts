import type Phaser from 'phaser';
import type { MoveData } from '@/types';

/** One consistent, original icon set drawn with vector shapes (no external icon files). */
export type IconKind =
  | 'light'
  | 'heavy'
  | 'block'
  | 'dodge'
  | 'projectile'
  | 'antiAir'
  | 'teleport'
  | 'armor'
  | 'wave'
  | 'ultimate'
  | 'energy'
  | 'health'
  | 'lock'
  | 'pause'
  | 'settings'
  | 'audio'
  | 'controls'
  | 'jump'
  | 'crouch'
  | 'move';

/** Picks an icon from what a move actually does. */
export const iconForMove = (m: MoveData): IconKind => {
  if (m.kind === 'ultimate') return 'ultimate';
  if (m.projectile?.grounded) return 'wave';
  if (m.projectile) return 'projectile';
  if (m.teleport) return 'teleport';
  if (m.armor) return 'armor';
  if ((m.movement?.vy ?? 0) > 0) return 'antiAir';
  return m.slot.toLowerCase().includes('heavy') ? 'heavy' : 'light';
};

export const drawIcon = (
  g: Phaser.GameObjects.Graphics,
  kind: IconKind,
  x: number,
  y: number,
  size: number,
  color: number,
): void => {
  const s = size / 2;
  g.fillStyle(color, 1);
  g.lineStyle(Math.max(2, size * 0.09), color, 1);
  switch (kind) {
    case 'light':
      g.fillCircle(x, y, s * 0.42);
      g.lineBetween(x - s * 0.9, y - s * 0.3, x - s * 0.5, y - s * 0.3);
      g.lineBetween(x - s * 0.9, y + s * 0.3, x - s * 0.5, y + s * 0.3);
      break;
    case 'heavy':
      g.fillCircle(x + s * 0.1, y, s * 0.62);
      for (let i = -1; i <= 1; i++)
        g.lineBetween(x - s * 0.95, y + i * s * 0.4, x - s * 0.6, y + i * s * 0.4);
      break;
    case 'block':
      g.beginPath();
      g.moveTo(x, y - s * 0.85);
      g.lineTo(x + s * 0.7, y - s * 0.5);
      g.lineTo(x + s * 0.55, y + s * 0.35);
      g.lineTo(x, y + s * 0.85);
      g.lineTo(x - s * 0.55, y + s * 0.35);
      g.lineTo(x - s * 0.7, y - s * 0.5);
      g.closePath();
      g.fillPath();
      break;
    case 'dodge':
      for (const off of [-0.35, 0.25]) {
        g.fillTriangle(
          x + s * (off - 0.3),
          y - s * 0.6,
          x + s * (off + 0.35),
          y,
          x + s * (off - 0.3),
          y + s * 0.6,
        );
      }
      break;
    case 'projectile':
      g.fillCircle(x + s * 0.25, y, s * 0.45);
      g.lineBetween(x - s * 0.9, y - s * 0.35, x - s * 0.3, y - s * 0.35);
      g.lineBetween(x - s * 0.9, y, x - s * 0.25, y);
      g.lineBetween(x - s * 0.9, y + s * 0.35, x - s * 0.3, y + s * 0.35);
      break;
    case 'antiAir':
      g.fillTriangle(x, y - s * 0.9, x + s * 0.6, y - s * 0.1, x - s * 0.6, y - s * 0.1);
      g.fillRect(x - s * 0.2, y - s * 0.15, s * 0.4, s * 0.95);
      break;
    case 'teleport':
      g.fillTriangle(x + s * 0.2, y - s * 0.8, x + s * 0.8, y, x + s * 0.2, y + s * 0.8);
      g.fillTriangle(x + s * 0.2, y - s * 0.8, x - s * 0.4, y, x + s * 0.2, y + s * 0.8);
      g.fillRect(x - s * 0.95, y - s * 0.08, s * 0.25, s * 0.16);
      g.fillRect(x - s * 0.62, y - s * 0.08, s * 0.18, s * 0.16);
      break;
    case 'armor':
      drawIcon(g, 'block', x, y, size, color);
      g.fillStyle(0x000000, 0.45);
      g.fillRect(x - s * 0.08, y - s * 0.6, s * 0.16, s * 1.2);
      break;
    case 'wave':
      g.fillTriangle(x - s * 0.9, y + s * 0.6, x - s * 0.3, y - s * 0.5, x + s * 0.1, y + s * 0.6);
      g.fillTriangle(x - s * 0.1, y + s * 0.6, x + s * 0.4, y - s * 0.1, x + s * 0.9, y + s * 0.6);
      break;
    case 'ultimate': {
      const pts: Array<{ x: number; y: number }> = [];
      for (let i = 0; i < 16; i++) {
        const r = i % 2 === 0 ? s * 0.95 : s * 0.42;
        const a = (i / 16) * Math.PI * 2 - Math.PI / 2;
        pts.push({ x: x + Math.cos(a) * r, y: y + Math.sin(a) * r });
      }
      g.beginPath();
      g.moveTo(pts[0].x, pts[0].y);
      for (const p of pts.slice(1)) g.lineTo(p.x, p.y);
      g.closePath();
      g.fillPath();
      break;
    }
    case 'energy':
      g.beginPath();
      g.moveTo(x + s * 0.15, y - s * 0.95);
      g.lineTo(x - s * 0.55, y + s * 0.1);
      g.lineTo(x - s * 0.05, y + s * 0.1);
      g.lineTo(x - s * 0.2, y + s * 0.95);
      g.lineTo(x + s * 0.55, y - s * 0.15);
      g.lineTo(x + s * 0.05, y - s * 0.15);
      g.closePath();
      g.fillPath();
      break;
    case 'health':
      g.fillRect(x - s * 0.22, y - s * 0.75, s * 0.44, s * 1.5);
      g.fillRect(x - s * 0.75, y - s * 0.22, s * 1.5, s * 0.44);
      break;
    case 'lock':
      g.fillRoundedRect(x - s * 0.6, y - s * 0.1, s * 1.2, s * 0.95, 3);
      g.strokeCircle(x, y - s * 0.25, s * 0.4);
      break;
    case 'pause':
      g.fillRect(x - s * 0.5, y - s * 0.6, s * 0.35, s * 1.2);
      g.fillRect(x + s * 0.15, y - s * 0.6, s * 0.35, s * 1.2);
      break;
    case 'settings':
      g.strokeCircle(x, y, s * 0.5);
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2;
        g.fillCircle(x + Math.cos(a) * s * 0.72, y + Math.sin(a) * s * 0.72, s * 0.16);
      }
      break;
    case 'audio':
      g.fillRect(x - s * 0.8, y - s * 0.25, s * 0.35, s * 0.5);
      g.fillTriangle(x - s * 0.5, y - s * 0.25, x - s * 0.5, y + s * 0.25, x + s * 0.05, y + s * 0.7);
      g.fillTriangle(x - s * 0.5, y - s * 0.25, x + s * 0.05, y - s * 0.7, x + s * 0.05, y + s * 0.7);
      g.beginPath();
      g.arc(x + s * 0.15, y, s * 0.55, -0.7, 0.7);
      g.strokePath();
      break;
    case 'controls':
      g.fillRoundedRect(x - s * 0.9, y - s * 0.45, s * 1.8, s * 0.9, s * 0.4);
      g.fillStyle(0x000000, 0.6);
      g.fillRect(x - s * 0.6, y - s * 0.06, s * 0.4, s * 0.12);
      g.fillRect(x - s * 0.46, y - s * 0.2, s * 0.12, s * 0.4);
      g.fillCircle(x + s * 0.45, y - s * 0.12, s * 0.1);
      g.fillCircle(x + s * 0.6, y + s * 0.1, s * 0.1);
      break;
    case 'jump':
      g.fillTriangle(x, y - s * 0.85, x + s * 0.7, y + s * 0.1, x - s * 0.7, y + s * 0.1);
      g.fillRect(x - s * 0.7, y + s * 0.45, s * 1.4, s * 0.2);
      break;
    case 'crouch':
      g.fillTriangle(x, y + s * 0.85, x + s * 0.7, y - s * 0.1, x - s * 0.7, y - s * 0.1);
      g.fillRect(x - s * 0.7, y - s * 0.65, s * 1.4, s * 0.2);
      break;
    case 'move':
      g.fillTriangle(x - s * 0.95, y, x - s * 0.35, y - s * 0.5, x - s * 0.35, y + s * 0.5);
      g.fillTriangle(x + s * 0.95, y, x + s * 0.35, y - s * 0.5, x + s * 0.35, y + s * 0.5);
      break;
    default:
      break;
  }
};
