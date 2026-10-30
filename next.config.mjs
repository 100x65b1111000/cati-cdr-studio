/** @type {import('next').NextConfig} */
const nextConfig = {
  // The dev-tools mark is a 32x32 <button aria-expanded> fixed to the bottom-left of
  // every dev page. ui-check.mjs sweeps `[aria-expanded]` and asserts each one opens a
  // .menu, so in dev it picks the indicator up and reports a phantom popover per view.
  // Hiding it keeps the sweep honest instead of narrowing the sweep.
  devIndicators: false,

  // The hostname a peer machine browses from. Next blocks dev assets requested from an
  // origin it was not started with, and without this the page arrives without its
  // chunks. Hostname only, no scheme or port, so it covers every port this server runs
  // on — and it is a DHCP lease, so it has to change with the address.
  allowedDevOrigins: ['192.168.5.98']
};

export default nextConfig;
