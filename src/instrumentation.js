// Next compiles this hook for the edge runtime as well, so the Node APIs live in
// instrumentation-node.js and are only reached on the Node server.
export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return;
  await import('./instrumentation-node');
}
