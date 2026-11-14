export const teamInfo = {
  home: { name: 'Home', initials: 'H', color: '#253c84' },
  away: { name: 'Away', initials: 'A', color: '#202020' },
};

const backFour = [[3, 'LB'], [4, 'LCB'], [5, 'RCB'], [2, 'RB']];
const backThree = [[3, 'LCB'], [4, 'CB'], [5, 'RCB']];
const frontThree = [[11, 'LW'], [9, 'ST'], [7, 'RW']];
const twoForwards = [[11, 'LS'], [9, 'RS']];

const formationLines = {
  '4-3-3': [backFour, [[10, 'LCM'], [6, 'DM'], [8, 'RCM']], frontThree],
  '4-2-3-1': [
    backFour,
    [[6, 'LDM'], [8, 'RDM']],
    [[11, 'LW'], [10, 'AM'], [7, 'RW']],
    [[9, 'ST']],
  ],
  '4-4-2': [
    backFour,
    [[10, 'LM'], [6, 'LCM'], [8, 'RCM'], [7, 'RM']],
    twoForwards,
  ],
  '3-5-2': [
    backThree,
    [[2, 'LWB'], [10, 'LCM'], [6, 'DM'], [8, 'RCM'], [7, 'RWB']],
    twoForwards,
  ],
  '3-4-3': [
    backThree,
    [[2, 'LWB'], [6, 'LCM'], [8, 'RCM'], [10, 'RWB']],
    frontThree,
  ],
  '5-3-2': [
    [[2, 'LWB'], ...backThree, [7, 'RWB']],
    [[10, 'LCM'], [6, 'DM'], [8, 'RCM']],
    twoForwards,
  ],
};

export const formations = Object.keys(formationLines);

const lanePositions = {
  1: [312.5],
  2: [222, 403],
  3: [136, 312.5, 489],
  4: [108, 244, 381, 517],
  5: [89, 199, 312.5, 426, 536],
};

export function makeLineup(team, formation) {
  const lines = [[[1, 'GK']], ...(formationLines[formation] ?? formationLines['4-3-3'])];
  const depthPositions = lines.length === 5 ? [92, 207, 315, 410, 484] : [92, 218, 352, 484];

  return lines.flatMap((line, depth) =>
    line.map(([number, name], index) => {
      const x = depthPositions[depth];
      const y = lanePositions[line.length][index];
      return {
        id: `${team}-${number}`,
        team,
        number,
        name,
        x: team === 'away' ? 1000 - x : x,
        y: team === 'away' ? 625 - y : y,
      };
    }),
  );
}

function setPositions(lineup, positions) {
  return lineup.map(player => {
    const position = positions[player.number];
    return position ? { ...player, x: position[0], y: position[1] } : player;
  });
}

function mark(id, type, color, coordinates, text = '') {
  return { id, type, color, text, points: coordinates.map(([x, y]) => ({ x, y })) };
}

const mint = '#08e5f1';
const white = '#eef7e9';

export const templates = [
  {
    name: 'Build from the back',
    category: 'Build-up',
    description: 'Invite pressure through the middle, then release the right winger into space.',
    homeFormation: '4-3-3',
    awayFormation: '4-4-2',
    scene: {
      players: [
        ...setPositions(makeLineup('home', '4-3-3'), {
          2: [247, 515],
          3: [234, 108],
          4: [210, 222],
          5: [200, 382],
          6: [336, 315],
          7: [492, 521],
          8: [370, 432],
          9: [518, 304],
          10: [366, 167],
          11: [500, 108],
        }),
        ...setPositions(makeLineup('away', '4-4-2'), {
          7: [622, 491],
          8: [673, 423],
          9: [527, 216],
          10: [625, 120],
          11: [523, 405],
        }),
      ],
      ball: { x: 231, y: 235 },
      marks: [
        mark('buildup-space', 'highlight', '#f5f7e8', [[609, 509], [681, 509]]),
        mark('buildup-pivot', 'arrow', mint, [[242, 248], [315, 304]]),
        mark('buildup-outlet', 'arrow', mint, [[321, 332], [268, 488]]),
        mark('buildup-wide', 'arrow', mint, [[273, 517], [465, 521]]),
        mark('buildup-run', 'run', mint, [[521, 522], [706, 525]]),
      ],
    },
  },
  {
    name: 'High press',
    category: 'Out of possession',
    description: 'Use the forward to close the centre and press as the ball moves to the fullback.',
    homeFormation: '4-2-3-1',
    awayFormation: '4-3-3',
    scene: {
      players: [
        ...setPositions(makeLineup('home', '4-2-3-1'), {
          2: [388, 517],
          3: [388, 109],
          4: [371, 244],
          5: [371, 381],
          6: [500, 230],
          7: [628, 503],
          8: [500, 391],
          9: [659, 269],
          10: [573, 328],
          11: [628, 119],
        }),
        ...setPositions(makeLineup('away', '4-3-3'), {
          2: [811, 106],
          3: [811, 517],
          4: [815, 377],
          5: [813, 214],
          6: [710, 326],
          8: [653, 190],
          10: [653, 425],
        }),
      ],
      ball: { x: 830, y: 230 },
      marks: [
        mark('press-trap', 'zone', mint, [[752, 64], [891, 155]]),
        mark('press-pass', 'arrow', white, [[836, 219], [818, 127]]),
        mark('press-winger', 'run', mint, [[650, 118], [784, 112]]),
        mark('press-forward', 'run', mint, [[681, 265], [790, 225]]),
        mark('press-cover', 'run', mint, [[594, 330], [682, 326]]),
      ],
    },
  },
  {
    name: 'Corner routine',
    category: 'Set piece',
    description: 'Attack the near post while a late runner arrives through the space behind.',
    homeFormation: '4-3-3',
    awayFormation: '4-4-2',
    scene: {
      players: [
        ...setPositions(makeLineup('home', '4-3-3'), {
          2: [597, 426],
          3: [566, 170],
          4: [825, 299],
          5: [827, 392],
          6: [707, 315],
          7: [918, 102],
          8: [750, 451],
          9: [855, 262],
          10: [772, 207],
          11: [951, 54],
        }),
        ...setPositions(makeLineup('away', '4-4-2'), {
          1: [947, 318],
          2: [904, 225],
          3: [909, 398],
          4: [894, 343],
          5: [897, 284],
          6: [862, 337],
          7: [879, 112],
          8: [875, 415],
          9: [671, 404],
          10: [810, 186],
          11: [668, 219],
        }),
      ],
      ball: { x: 968, y: 32 },
      marks: [
        mark('corner-target', 'zone', mint, [[875, 179], [921, 254]]),
        mark('corner-delivery', 'arrow', white, [[967, 42], [916, 211]]),
        mark('corner-near-run', 'run', mint, [[866, 250], [885, 212]]),
        mark('corner-late-run', 'run', mint, [[770, 444], [837, 359]]),
      ],
    },
  },
];
