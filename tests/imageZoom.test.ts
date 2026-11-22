import test from 'node:test';
import assert from 'node:assert/strict';
import {
  clampZoomPan,
  clampZoomScale,
  computeHoverMagnifyTransform,
  computePinchTransform,
  computeZoomTowardFocalPoint,
  dampTransformStep,
  normalizeWheelZoomFactor,
} from '../src/utils/zoomMath';

test('normalizeWheelZoomFactor: handles gradual mouse-wheel, small continuous trackpad ticks, pinch ctrlKey, and ignores horizontal/zero deltas', () => {
  // Zero vertical movement is ignored (never zooms out)
  assert.equal(normalizeWheelZoomFactor(0, 0, 0, false), null);
  assert.equal(normalizeWheelZoomFactor(0, 25, 0, false), null);

  // Horizontal-dominant trackpad swipe without ctrlKey is ignored
  assert.equal(normalizeWheelZoomFactor(4, 20, 0, false), null);
  assert.equal(normalizeWheelZoomFactor(-3, -15, 0, false), null);

  // Small continuous trackpad movement produces a tiny, gradual change (< 2% per 4px tick, not ±35%)
  const smallIn = normalizeWheelZoomFactor(-4, 0, 0, false);
  const smallOut = normalizeWheelZoomFactor(4, 0, 0, false);
  assert.ok(smallIn !== null && smallIn > 1.002 && smallIn < 1.015);
  assert.ok(smallOut !== null && smallOut < 0.998 && smallOut > 0.985);
  // Exact multiplicative symmetry: zoom in then out returns to 1.0
  assert.ok(Math.abs(smallIn! * smallOut! - 1) < 1e-9);

  // Standard mouse wheel notch (100px pixel mode or 3 lines line mode) produces smooth gradual step (~18-20%)
  const wheelIn = normalizeWheelZoomFactor(-100, 0, 0, false);
  assert.ok(wheelIn !== null && wheelIn > 1.15 && wheelIn < 1.25);
  const lineModeIn = normalizeWheelZoomFactor(-3, 0, 1, false);
  assert.ok(lineModeIn !== null && lineModeIn > 1.05 && lineModeIn < 1.15);

  // Extreme single-event wheel spike is clamped so it never jumps violently
  const spikeIn = normalizeWheelZoomFactor(-2000, 0, 0, false);
  assert.ok(spikeIn !== null && spikeIn < 1.26);

  // Trackpad pinch (ctrlKey=true) responds cleanly to small pinch deltas
  const pinchIn = normalizeWheelZoomFactor(-10, 0, 0, true);
  const pinchOut = normalizeWheelZoomFactor(10, 0, 0, true);
  assert.ok(pinchIn !== null && pinchIn > 1.06 && pinchIn < 1.12);
  assert.ok(pinchOut !== null && pinchOut < 0.94 && pinchOut > 0.88);
});

test('computeZoomTowardFocalPoint: keeps exact image pixel anchored under cursor and clamps within min/max limits', () => {
  const size = { width: 400, height: 500 };

  // Zoom from 1.0x to 2.0x toward cursor at (-80, -100) relative to container center
  const focalX = -80;
  const focalY = -100;
  const z1 = computeZoomTowardFocalPoint({ scale: 1, x: 0, y: 0 }, 2.0, focalX, focalY, size, 1, 3.5);
  assert.equal(z1.scale, 2.0);
  // Under transform translate3d(x, y, 0) scale(s): image point u = -80 maps to s*u + x = 2*(-80) + x === -80 => x = +80
  assert.equal(z1.x, 80);
  assert.equal(z1.y, 100);

  // Zooming further from 2.0x to 3.0x around a different cursor position preserves that new cursor point
  const focal2X = 40;
  const focal2Y = -20;
  const uBefore = (focal2X - z1.x) / z1.scale;
  const vBefore = (focal2Y - z1.y) / z1.scale;
  const z2 = computeZoomTowardFocalPoint(z1, 3.0, focal2X, focal2Y, size, 1, 3.5);
  assert.equal(z2.scale, 3.0);
  const screenAfterX = z2.scale * uBefore + z2.x;
  const screenAfterY = z2.scale * vBefore + z2.y;
  assert.ok(Math.abs(screenAfterX - focal2X) < 1e-6);
  assert.ok(Math.abs(screenAfterY - focal2Y) < 1e-6);

  // Max scale limit strictly enforced
  const overMax = computeZoomTowardFocalPoint(z2, 9.0, 0, 0, size, 1, 3.5);
  assert.equal(overMax.scale, 3.5);

  // Zooming down to min scale resets pan cleanly to (0, 0)
  const atMin = computeZoomTowardFocalPoint(z2, 0.5, focal2X, focal2Y, size, 1, 3.5);
  assert.deepEqual(atMin, { scale: 1, x: 0, y: 0 });
});

test('computePinchTransform: scales smoothly around two-finger midpoint with simultaneous pan and bounds clamping', () => {
  const size = { width: 360, height: 480 };
  const start = { scale: 1, x: 0, y: 0 };

  // Two fingers double distance while midpoint stays at (60, -80)
  const pinched = computePinchTransform(start, 100, 200, 60, -80, 60, -80, size, 1, 3.5);
  assert.equal(pinched.scale, 2);
  // Point u=60 stays at 60: 2*60 + x = 60 => x = -60; point v=-80 stays at -80: 2*(-80) + y = -80 => y = +80
  assert.equal(pinched.x, -60);
  assert.equal(pinched.y, 80);

  // Simultaneous pan: midpoint shifts +20px right and -10px up while keeping 2x zoom
  const pannedPinch = computePinchTransform(start, 100, 200, 60, -80, 80, -90, size, 1, 3.5);
  assert.equal(pannedPinch.scale, 2);
  assert.equal(pannedPinch.x, -40);
  assert.equal(pannedPinch.y, 70);

  // Pinching below minScale snaps back to 1x centered
  const unpinched = computePinchTransform({ scale: 1.5, x: 40, y: -30 }, 150, 75, 0, 0, 0, 0, size, 1, 3.5);
  assert.deepEqual(unpinched, { scale: 1, x: 0, y: 0 });
});

test('computeHoverMagnifyTransform & clampZoomPan: unified coordinate system eliminates transformOrigin snap', () => {
  const size = { width: 400, height: 400 };
  // Top-left hover (norm 0, 0) at 2.0x -> maxX = 200, x = +200, y = +200
  const topLeft = computeHoverMagnifyTransform(0, 0, 2.0, size, 1, 3.5);
  assert.deepEqual(topLeft, { scale: 2, x: 200, y: 200 });

  // Center hover (norm 0.5, 0.5) -> x = 0, y = 0
  const center = computeHoverMagnifyTransform(0.5, 0.5, 2.0, size, 1, 3.5);
  assert.deepEqual(center, { scale: 2, x: 0, y: 0 });

  // Clamping enforces container bounds
  assert.deepEqual(clampZoomPan(999, -999, 2.0, size), { x: 200, y: -200 });
  assert.deepEqual(clampZoomPan(50, 50, 1.0, size), { x: 0, y: 0 });
  assert.equal(clampZoomScale(Number.NaN, 1, 3.5), 1);
});

test('dampTransformStep: smoothly converges monotonically toward target with zero overshoot or jitter', () => {
  let state = { scale: 1, x: 0, y: 0 };
  const target = { scale: 2.2, x: -120, y: 80 };
  let prevScale = state.scale;
  let settled = false;

  for (let frame = 0; frame < 60; frame++) {
    const step = dampTransformStep(state, target, 1 / 60, 18);
    assert.ok(step.next.scale >= prevScale, 'scale must progress monotonically without oscillation');
    assert.ok(step.next.scale <= target.scale, 'scale must never overshoot target');
    prevScale = step.next.scale;
    state = step.next;
    if (step.settled) {
      settled = true;
      break;
    }
  }

  assert.equal(settled, true);
  assert.deepEqual(state, target);
});
