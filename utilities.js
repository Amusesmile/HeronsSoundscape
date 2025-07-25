const _timers = {};

function startClock(label = 'default') {
  _timers[label] = performance.now();
}

function endClock(label = 'default') {
  const end = performance.now();
  if (_timers[label] !== undefined) {
    const duration = Math.round(end - _timers[label]);
    console.log(`${label} took ${duration}ms`);
    delete _timers[label]; // optional: clean up after timing
  } else {
    console.warn(`No startClock('${label}') called`);
  }
}