// The one reading of the OS preference plus the in-app opt-in. CSS can express it, but
// chart.js durations and any layout that only exists for the length of a ramp cannot, so
// every JS side of the decision has to come through here and stay in step with the
// stylesheet in src/index.css.
export function reducedMotion() {
  return (
    window.matchMedia('(prefers-reduced-motion: reduce)').matches &&
    document.documentElement.dataset.motion !== 'full'
  );
}
