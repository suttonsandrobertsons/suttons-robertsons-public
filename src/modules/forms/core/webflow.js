/** Defer until after Finsweet (or similar) has inserted injected markup into the live DOM. */
export function scheduleAfterDomUpdate(fn) {
  const run = () => {
    try {
      Promise.resolve(fn()).catch(() => {});
    } catch {}
  };

  if (typeof requestAnimationFrame === 'function') {
    requestAnimationFrame(() => requestAnimationFrame(run));
    return;
  }

  setTimeout(run, 0);
}
