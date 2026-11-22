import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  HEADER_SCROLL_ENTER_PX,
  HEADER_SCROLL_EXIT_PX,
  computeNextHeaderScrolledState,
} from '../src/utils/headerScrollState';

describe('Header scroll hysteresis state machine', () => {
  it('stays unscrolled at top of page and below the enter threshold', () => {
    for (const y of [0, 5, 15, 20, 40, HEADER_SCROLL_ENTER_PX - 0.5, HEADER_SCROLL_ENTER_PX - 1]) {
      assert.equal(
        computeNextHeaderScrolledState(false, y),
        false,
        `expected unscrolled state to remain false at scrollY=${y}`
      );
    }
  });

  it('transitions to scrolled once reaching or passing the enter threshold', () => {
    assert.equal(computeNextHeaderScrolledState(false, HEADER_SCROLL_ENTER_PX), true);
    assert.equal(computeNextHeaderScrolledState(false, HEADER_SCROLL_ENTER_PX + 1), true);
    assert.equal(computeNextHeaderScrolledState(false, 420), true);
  });

  it('remains completely stable when stopping or jittering inside the hysteresis deadband', () => {
    // From unscrolled: oscillating inside [0, enterThreshold) never flips to true
    let state = false;
    for (const y of [10, 25, 18, 45, 32, 58, 22, 59.9, 30, 15]) {
      state = computeNextHeaderScrolledState(state, y);
      assert.equal(state, false, `unscrolled state toggled unexpectedly at scrollY=${y}`);
    }

    // From scrolled: stopping halfway or oscillating inside (exitThreshold, 120] never flips to false
    state = true;
    for (const y of [120, 60, 59, 45, 30, 55, 25, 58, 20.5, 42, 35]) {
      state = computeNextHeaderScrolledState(state, y);
      assert.equal(state, true, `scrolled state toggled unexpectedly at scrollY=${y}`);
    }
  });

  it('transitions cleanly back to unscrolled once scrolling up to or below the exit threshold', () => {
    assert.equal(computeNextHeaderScrolledState(true, HEADER_SCROLL_EXIT_PX + 0.1), true);
    assert.equal(computeNextHeaderScrolledState(true, HEADER_SCROLL_EXIT_PX), false);
    assert.equal(computeNextHeaderScrolledState(true, 10), false);
    assert.equal(computeNextHeaderScrolledState(true, 0), false);
  });

  it('never toggles repeatedly across a full scroll-down, pause-midway, scroll-back-up sequence', () => {
    const samples = [
      0, 12, 28, 45, 59, 60, 85, 140,
      // User scrolls back up and pauses/jitters around the old 15px-50px zone
      90, 55, 48, 52, 38, 44, 26, 31, 22, 24,
      // Continues back to top
      20, 18, 25, 14, 0,
    ];

    let state = false;
    let transitions = 0;
    for (const y of samples) {
      const next = computeNextHeaderScrolledState(state, y);
      if (next !== state) {
        transitions += 1;
        state = next;
      }
    }

    assert.equal(transitions, 2, 'expected exactly one enter transition and one exit transition');
    assert.equal(state, false);
  });

  it('clamps negative iOS Safari rubber-band overscroll and non-finite values safely to 0', () => {
    assert.equal(computeNextHeaderScrolledState(false, -25), false);
    assert.equal(computeNextHeaderScrolledState(true, -25), false);
    assert.equal(computeNextHeaderScrolledState(true, -0.5), false);
    assert.equal(computeNextHeaderScrolledState(true, Number.NaN), false);
    assert.equal(computeNextHeaderScrolledState(false, Number.NEGATIVE_INFINITY), false);
    assert.equal(computeNextHeaderScrolledState(false, Number.POSITIVE_INFINITY), false);
  });
});
