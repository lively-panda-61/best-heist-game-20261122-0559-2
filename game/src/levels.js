// The three heists. Each level is one room: walls are rectangles, guards walk
// closed patrol loops, cameras sweep from fixed mounts, loot waits to be lifted
// and the exit is the way out. Coordinates are in the 1280x720 logical field.
// Waypoints never sit inside a wall and no patrol line crosses one.
export const LEVELS = [
  {
    name: 'The Gallery',
    subtitle: 'Lift the Moonlit Portrait, then slip out the east door.',
    playerStart: { x: 60, y: 640 },
    exit: { x: 1140, y: 80, w: 70, h: 70, label: 'EXIT' },
    walls: [
      { x: 300, y: 0, w: 24, h: 260 },
      { x: 300, y: 420, w: 24, h: 300 },
      { x: 640, y: 180, w: 24, h: 280 },
      { x: 900, y: 0, w: 24, h: 200 },
      { x: 900, y: 360, w: 24, h: 360 },
      { x: 520, y: 520, w: 220, h: 24 },
      { x: 980, y: 520, w: 180, h: 24 },
    ],
    guards: [
      { waypoints: [{ x: 420, y: 150 }, { x: 560, y: 150 }, { x: 560, y: 420 }, { x: 420, y: 420 }] },
      { waypoints: [{ x: 980, y: 300 }, { x: 1120, y: 300 }, { x: 1120, y: 480 }, { x: 980, y: 480 }] },
    ],
    cameras: [
      { x: 660, y: 72, angle: Math.PI / 2 },
      { x: 330, y: 680, angle: -Math.PI / 2 },
    ],
    loot: [
      { x: 1150, y: 620, name: 'Moonlit Portrait', kind: 'painting', required: true, value: 500 },
      { x: 700, y: 100, name: 'Porcelain Vase', kind: 'vase', required: false, value: 150 },
      { x: 420, y: 620, name: 'Coin Stack', kind: 'coins', required: false, value: 100 },
      { x: 150, y: 120, name: 'Marble Bust', kind: 'bust', required: false, value: 120 },
    ],
  },
  {
    name: 'The Vault Floor',
    subtitle: 'The Star Diamond sits in the middle of the floor. Take it and run.',
    playerStart: { x: 60, y: 60 },
    exit: { x: 1140, y: 620, w: 70, h: 70, label: 'EXIT' },
    walls: [
      { x: 200, y: 0, w: 24, h: 300 },
      { x: 200, y: 460, w: 24, h: 260 },
      { x: 560, y: 200, w: 24, h: 320 },
      { x: 880, y: 0, w: 24, h: 240 },
      { x: 880, y: 400, w: 24, h: 320 },
      { x: 420, y: 560, w: 260, h: 24 },
      { x: 1000, y: 180, w: 200, h: 24 },
    ],
    guards: [
      { waypoints: [{ x: 320, y: 120 }, { x: 480, y: 120 }, { x: 480, y: 300 }, { x: 320, y: 300 }] },
      { waypoints: [{ x: 700, y: 480 }, { x: 820, y: 480 }, { x: 820, y: 640 }, { x: 700, y: 640 }] },
      { waypoints: [{ x: 980, y: 500 }, { x: 1120, y: 500 }, { x: 1120, y: 620 }, { x: 980, y: 620 }] },
    ],
    cameras: [
      { x: 580, y: 72, angle: Math.PI / 2 },
      { x: 900, y: 680, angle: -Math.PI / 2 },
      { x: 1240, y: 360, angle: Math.PI },
    ],
    loot: [
      { x: 640, y: 360, name: 'Star Diamond', kind: 'diamond', required: true, value: 500 },
      { x: 1000, y: 100, name: 'Gold Bars', kind: 'bars', required: false, value: 180 },
      { x: 300, y: 640, name: 'Cash Bundle', kind: 'cash', required: false, value: 120 },
      { x: 1100, y: 300, name: 'Jade Idol', kind: 'idol', required: false, value: 150 },
    ],
  },
  {
    name: 'The Rooftop',
    subtitle: 'Grab the gold, reach the helipad, and vanish into the night.',
    playerStart: { x: 60, y: 360 },
    exit: { x: 1100, y: 80, w: 90, h: 90, label: 'HELIPAD' },
    walls: [
      { x: 320, y: 120, w: 24, h: 300 },
      { x: 320, y: 540, w: 24, h: 180 },
      { x: 700, y: 0, w: 24, h: 220 },
      { x: 700, y: 380, w: 24, h: 340 },
      { x: 1000, y: 200, w: 24, h: 200 },
      { x: 480, y: 480, w: 200, h: 24 },
    ],
    guards: [
      { waypoints: [{ x: 420, y: 200 }, { x: 600, y: 200 }, { x: 600, y: 380 }, { x: 420, y: 380 }] },
      { waypoints: [{ x: 800, y: 480 }, { x: 980, y: 480 }, { x: 980, y: 640 }, { x: 800, y: 640 }] },
      { waypoints: [{ x: 1050, y: 120 }, { x: 1200, y: 120 }, { x: 1200, y: 280 }, { x: 1050, y: 280 }] },
    ],
    cameras: [
      { x: 740, y: 72, angle: Math.PI / 2 },
      { x: 360, y: 680, angle: -Math.PI / 2 },
    ],
    loot: [
      { x: 1120, y: 620, name: 'Rooftop Gold', kind: 'bars', required: true, value: 500 },
      { x: 500, y: 100, name: 'Briefcase', kind: 'case', required: false, value: 150 },
      { x: 850, y: 600, name: 'Sapphire Jewels', kind: 'diamond', required: false, value: 180 },
      { x: 150, y: 80, name: 'Bearer Bonds', kind: 'cash', required: false, value: 100 },
    ],
  },
];
