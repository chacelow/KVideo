type ArrowKey = 'ArrowLeft' | 'ArrowRight';
interface MediaTarget { currentTime: number; duration: number; playbackRate: number }

/** A press is either a release-to-seek tap or a held playback boost, never both. */
export function createArrowKeyGesture(getVideo: () => MediaTarget | null) {
  let key: ArrowKey | null = null;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let video: MediaTarget | null = null;
  let originalRate = 1;
  let holding = false;

  function cancel() {
    clearTimeout(timer);
    timer = undefined;
    if (holding && video) video.playbackRate = originalRate;
    holding = false;
    video = null;
    key = null;
  }

  return {
    down(next: ArrowKey) {
      if (key) return; // OS auto-repeat cannot start another gesture or seek.
      const target = getVideo();
      if (!target) return;
      key = next;
      video = target;
      timer = setTimeout(() => {
        if (video !== getVideo()) { cancel(); return; }
        originalRate = target.playbackRate;
        holding = true;
        target.playbackRate = next === 'ArrowRight' ? 3 : 0.5;
      }, 250);
    },
    up(released: ArrowKey) {
      if (key !== released) return;
      if (!holding && video && video === getVideo()) {
        const end = Number.isFinite(video.duration) ? video.duration : Infinity;
        video.currentTime = Math.max(0, Math.min(end, video.currentTime + (key === 'ArrowRight' ? 10 : -10)));
      }
      cancel();
    },
    cancel,
  };
}
