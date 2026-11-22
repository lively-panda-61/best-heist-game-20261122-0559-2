// A small seeded random generator (mulberry32) so a level's patrol jitter and
// the screenshot scenes are reproducible from a seed.
export function createRandom(seed) {
  let state = seed >>> 0;
  return function next() {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

/** Integer in [min, max] from a generator made by createRandom. */
export function randomInt(random, min, max) {
  return min + Math.floor(random() * (max - min + 1));
}

/** Pick one element of an array from a generator made by createRandom. */
export function randomPick(random, items) {
  return items[Math.floor(random() * items.length)];
}
