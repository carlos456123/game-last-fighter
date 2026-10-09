import type Phaser from 'phaser';
import type { EnemyAI } from '@/ai/EnemyAI';
import type { Match } from '@/core/Match';
import type { Rect } from '@/types';
import { DEPTH } from '@/ui/theme';

/**
 * Development overlay (F1 in dev builds only): FPS, frame timing, fighter state, AI state,
 * hit/hurt/push boxes, velocity, position, move frame, cooldowns and energy.
 */
export class DebugOverlay {
  private readonly boxes: Phaser.GameObjects.Graphics;
  private readonly text: Phaser.GameObjects.Text;
  private visible = false;

  constructor(
    private readonly scene: Phaser.Scene,
    world: Phaser.GameObjects.Layer,
    ui: Phaser.GameObjects.Layer,
    private readonly match: Match,
    private readonly ai: EnemyAI | null,
  ) {
    this.boxes = scene.add.graphics().setDepth(DEPTH.debug);
    world.add(this.boxes);
    this.text = scene.add
      .text(12, 130, '', {
        fontFamily: 'monospace',
        fontSize: '13px',
        color: '#9cff9c',
        backgroundColor: '#000000aa',
      })
      .setDepth(DEPTH.debug)
      .setPadding(6, 6, 6, 6);
    ui.add(this.text);
    this.setVisible(false);
  }

  toggle(): void {
    this.setVisible(!this.visible);
  }

  setVisible(v: boolean): void {
    this.visible = v;
    this.boxes.setVisible(v);
    this.text.setVisible(v);
  }

  update(simStepMs: number): void {
    if (!this.visible) return;
    const g = this.boxes;
    const floor = this.match.arena.floorY;
    const rect = (r: Rect, color: number, alpha: number): void => {
      g.lineStyle(2, color, 1);
      g.strokeRect(r.x, floor - r.y - r.h, r.w, r.h);
      g.fillStyle(color, alpha);
      g.fillRect(r.x, floor - r.y - r.h, r.w, r.h);
    };
    g.clear();
    for (const f of this.match.fighters) {
      const invuln = f.isInvulnerable();
      rect(f.pushbox(), 0xffff00, 0.04);
      for (const h of f.hurtboxes()) rect(h, invuln ? 0x888888 : 0x3fa9ff, 0.12);
      const hb = f.hitbox();
      if (hb) rect(hb, 0xff3333, 0.3);
    }
    for (const p of this.match.combat.projectiles) rect(p.box(), 0xff8800, 0.3);
    const b = this.match.bounds;
    g.lineStyle(2, 0xff00ff, 0.8);
    g.lineBetween(b.left, floor - 400, b.left, floor);
    g.lineBetween(b.right, floor - 400, b.right, floor);

    const lines = [
      `FPS ${this.scene.game.loop.actualFps.toFixed(0)}  sim ${simStepMs.toFixed(2)}ms  frame ${this.match.frame}/${this.match.simFrame}`,
      `phase ${this.match.phase}  hitstop ${this.match.hitstop}  freeze ${this.match.superFreeze}`,
    ];
    for (const f of this.match.fighters) {
      const cds = f.data.moves
        .filter((m) => f.skills.cooldownOf(m.id) > 0)
        .map((m) => `${m.id}:${f.skills.cooldownOf(m.id)}`)
        .join(' ');
      lines.push(
        `${f.side} ${f.data.id} ${f.state}#${f.stateFrame} move=${f.move?.id ?? '-'}@${f.moveFrame}(${f.movePhase ?? '-'})`,
        `   pos ${f.x.toFixed(0)},${f.y.toFixed(0)} vel ${f.vx.toFixed(0)},${f.vy.toFixed(0)} hp ${f.health} en ${f.energy.toFixed(0)} stun ${f.stunMeter.toFixed(0)}`,
        `   cd ${cds || '-'} invuln ${f.isInvulnerable()} armor ${f.hasArmor()}`,
      );
    }
    if (this.ai) lines.push(`AI ${this.ai.state} gap ${this.ai.perception?.gap.toFixed(0) ?? '-'}`);
    this.text.setText(lines.join('\n'));
  }
}
