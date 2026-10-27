/** @type {import('next').NextConfig} */
const nextConfig = {
  // The dev-tools mark is a 32x32 <button aria-expanded> fixed to the bottom-left of
  // every dev page. ui-check.mjs sweeps `[aria-expanded]` and asserts each one opens a
  // .menu, so in dev it picks the indicator up and reports a phantom popover per view.
  // Hiding it keeps the sweep honest instead of narrowing the sweep.
  devIndicators: false
};

export default nextConfig;
