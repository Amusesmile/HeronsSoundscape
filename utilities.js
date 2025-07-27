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

function getRandomInt(min, max) {
  min = Math.ceil(min);   // Round up to ensure min is inclusive
  max = Math.floor(max);  // Round down to ensure max is inclusive
  return Math.floor(Math.random() * (max - min + 1)) + min;
}