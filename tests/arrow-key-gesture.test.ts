import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createArrowKeyGesture } from '../lib/player/arrow-key-gesture';

test('right tap seeks ten seconds only on release, not on OS repeats', (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const video = { currentTime: 20, duration: 100, playbackRate: 1.25 };
  const keys = createArrowKeyGesture(() => video);
  keys.down('ArrowRight');
  keys.down('ArrowRight');
  assert.equal(video.currentTime, 20);
  t.mock.timers.tick(100);
  keys.up('ArrowRight');
  assert.equal(video.currentTime, 30);
  t.mock.timers.tick(300);
  assert.equal(video.playbackRate, 1.25);
});

test('right hold boosts and left hold slows without seeking; release restores rate', (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const video = { currentTime: 20, duration: 100, playbackRate: 1.5 };
  const keys = createArrowKeyGesture(() => video);
  keys.down('ArrowRight');
  t.mock.timers.tick(250);
  assert.equal(video.playbackRate, 3);
  keys.down('ArrowRight');
  keys.up('ArrowRight');
  assert.equal(video.playbackRate, 1.5);
  assert.equal(video.currentTime, 20);
  keys.down('ArrowLeft');
  t.mock.timers.tick(250);
  assert.equal(video.playbackRate, 0.5);
  keys.up('ArrowLeft');
  assert.equal(video.playbackRate, 1.5);
  assert.equal(video.currentTime, 20);
});

test('left tap clamps at zero and cancelled holds do not stick or seek', (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const video = { currentTime: 4, duration: 100, playbackRate: 2 };
  const keys = createArrowKeyGesture(() => video);
  keys.down('ArrowLeft');
  keys.up('ArrowLeft');
  assert.equal(video.currentTime, 0);
  keys.down('ArrowRight');
  keys.cancel();
  t.mock.timers.tick(300);
  keys.up('ArrowRight');
  assert.equal(video.currentTime, 0);
  assert.equal(video.playbackRate, 2);
  keys.down('ArrowRight');
  t.mock.timers.tick(250);
  keys.cancel();
  assert.equal(video.playbackRate, 2);
});
