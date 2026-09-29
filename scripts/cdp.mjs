// The two pieces of DevTools Protocol plumbing that more than one tool here
// needs. Kept small on purpose: everything else stays in its own command.
//
// WHY wheelUntilSettled EXISTS. `window.scrollTo` is the scroll-shaped version
// of `el.click()`: it moves a number, and a page that scrolls an inner element
// never hears about it. leolist.cc sets `html { overflow: hidden }` and scrolls
// its listing column, so scrollTo left scrollY at 0 through six attempts while
// an IntersectionObserver waited for a scroll that never happened — and a
// filmstrip of 759 photos measured as ZERO (2026-09-29). A dispatched wheel
// event goes through the compositor and hits whatever the real scroller is.
//
// This repository's own rule, applied to scrolling: geometry proves a control
// is PRESENT, never that it WORKS, and only a trusted event proves the latter.

/** Open a CDP websocket and return { send, close, on }. */
export async function connect(wsUrl) {
  const ws = new WebSocket(wsUrl);
  await new Promise((resolve, reject) => {
    ws.addEventListener('open', resolve, { once: true });
    ws.addEventListener('error', reject, { once: true });
  });

  let seq = 0;
  const pending = new Map();
  const listeners = [];
  ws.addEventListener('message', (ev) => {
    const msg = JSON.parse(ev.data);
    if (msg.id && pending.has(msg.id)) {
      const { resolve, reject } = pending.get(msg.id);
      pending.delete(msg.id);
      msg.error ? reject(new Error(msg.error.message)) : resolve(msg.result);
      return;
    }
    for (const fn of listeners) fn(msg);
  });

  const send = (method, params = {}, sessionId) =>
    new Promise((resolve, reject) => {
      const id = ++seq;
      pending.set(id, { resolve, reject });
      ws.send(JSON.stringify(sessionId ? { id, method, params, sessionId } : { id, method, params }));
    });

  return { send, on: (fn) => listeners.push(fn), close: () => ws.close() };
}

/**
 * Drive the page's REAL scroller with wheel events until nothing new appears.
 *
 * `measure` is a JS expression returning a number that grows as lazy content
 * hydrates. Scrolling stops once it has been unchanged for `stableRounds`
 * rounds, so a short page costs a couple of seconds and a long one keeps going
 * — rather than a fixed count that is always wrong in one direction.
 *
 * `maxRounds` is the honesty valve, not a target: the result carries
 * `settled: false` when it ran out, so a caller can say "still growing" rather
 * than report a number it knows is short. A 100-row leolist index was still
 * growing at 40 rounds of 800px (2026-09-29), which is why `verify` asks for
 * far more than the default and `watch --scroll` deliberately asks for less —
 * one is a check, the other is a refresh you pay for on every save.
 */
export async function wheelUntilSettled(
  send,
  sessionId,
  { measure, maxRounds = 40, deltaY = 1000, settleMs = 600, stableRounds = 4, x = 600, y = 400 } = {},
) {
  const read = async () => {
    const r = await send('Runtime.evaluate', { expression: measure, returnByValue: true }, sessionId);
    return Number(r?.result?.value) || 0;
  };

  let last = await read();
  const first = last;
  let stable = 0;
  let rounds = 0;

  while (rounds < maxRounds && stable < stableRounds) {
    await send(
      'Input.dispatchMouseEvent',
      { type: 'mouseWheel', x, y, deltaX: 0, deltaY, pointerType: 'mouse' },
      sessionId,
    );
    await new Promise((r) => setTimeout(r, settleMs));
    rounds += 1;
    const now = await read();
    stable = now === last ? stable + 1 : 0;
    last = now;
  }

  return { rounds, before: first, after: last, settled: stable >= stableRounds };
}
