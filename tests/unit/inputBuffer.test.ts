import { describe, expect, it } from 'vitest';
import { InputBuffer } from '@/input/InputBuffer';
import { frameFromHeld, mergeFrames, createButtonState } from '@/input/InputFrame';
import { input } from './helpers';

describe('InputBuffer', () => {
  it('keeps a press for the buffer window', () => {
    const buf = new InputBuffer(8, 14);
    buf.push(10, input([], ['light']));
    expect(buf.has('light', 12)).toBe(true);
    expect(buf.has('light', 18)).toBe(true);
    expect(buf.has('light', 19)).toBe(false);
  });

  it('consumes a press only once', () => {
    const buf = new InputBuffer();
    buf.push(1, input([], ['heavy']));
    expect(buf.consume('heavy', 2)).toBe(true);
    expect(buf.consume('heavy', 2)).toBe(false);
  });

  it('detects double taps within the window only', () => {
    const buf = new InputBuffer(8, 14);
    buf.push(1, input([], ['right']));
    buf.push(10, input([], ['right']));
    expect(buf.wasDoubleTapped('right')).toBe(true);
    buf.push(11, input());
    expect(buf.wasDoubleTapped('right')).toBe(false);
    buf.push(40, input([], ['right']));
    buf.push(70, input([], ['right']));
    expect(buf.wasDoubleTapped('right')).toBe(false);
  });

  it('derives pressed edges from held state and merges sources', () => {
    const prev = createButtonState();
    const held = createButtonState();
    held.light = true;
    const f = frameFromHeld(held, prev);
    expect(f.pressed.light).toBe(true);
    const f2 = frameFromHeld(held, held);
    expect(f2.pressed.light).toBe(false);
    const merged = mergeFrames([input(['left']), input([], ['heavy'])]);
    expect(merged.held.left && merged.pressed.heavy).toBe(true);
  });
});
