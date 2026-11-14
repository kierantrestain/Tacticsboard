import { makeLineup } from './data.js';

const pathColor = '#08e5f1';
const zoneColor = '#ebc858';
const passColor = '#eef7e9';

const pass = (from,to) => ['arrow',passColor,[from,to]];
const run = (from,to) => ['run',pathColor,[from,to]];
const dribble = (from,to) => ['dribble',pathColor,[from,to]];
const lob = (from,to) => ['lob',passColor,[from,to]];
const shot = (from,to) => ['shot',passColor,[from,to]];
const zone = (from,to) => ['zone',zoneColor,[from,to]];
const highlight = (point,edge) => ['highlight',zoneColor,[point,edge]];
const cone = point => ['cone',zoneColor,[point]];

function point([x,y]) {
  return {x,y};
}

function position(players,home = {},away = {}) {
  return players.map(player => {
    const locations = player.team === 'home' ? home : away;
    const coordinates = locations[player.number];
    return coordinates ? {...player, ...point(coordinates)} : {...player};
  });
}

function preset({name,category,description,formation,opposition,hideOpposition = false,steps}) {
  let players = [...makeLineup('home',formation), ...makeLineup('away',opposition)];
  let ball;
  const stages = steps.map((step,index) => {
    players = position(players,step.home,step.away);
    ball = step.ball ? point(step.ball) : {...ball};
    return {
      title:step.title,
      notes:step.notes,
      ...(step.transition ? {transition:step.transition,duration:step.duration ?? 1450} : {}),
      scene:{
        players,ball,
        marks:(step.marks ?? []).map(([type,color,coordinates],number) =>
          ({id:`preset-${index + 1}-${number + 1}`,type,color,points:coordinates.map(point)})),
      },
    };
  });
  return {
    name,category,description,homeFormation:formation,awayFormation:opposition,
    ...(hideOpposition ? {settings:{away:false}} : {}),
    scene:stages[0].scene, stages,
  };
}

export const extraTemplates = [
  preset({
    name:'Third-man combination', category:'Build-up',
    description:'Use a bounce pass to find a midfielder beyond the first line of pressure.',
    formation:'4-3-3', opposition:'4-4-2',
    steps:[
      {
        title:'Find the striker’s feet', transition:'pass',
        notes:'The centre-back plays through the pressing line. The midfielder starts their run while the striker checks toward the ball.',
        home:{4:[250,247],6:[355,308],8:[430,424],9:[567,315],7:[575,540]},
        away:{9:[380,238],11:[411,395],6:[592,252],8:[637,408]},
        ball:[270,251], marks:[pass([275,257],[542,312]),run([448,422],[555,382])],
      },
      {
        title:'Set the third man', transition:'pass', duration:1050,
        notes:'The striker sets the ball into the midfielder’s path. Keep the pass short so the next action can go forward.',
        home:{8:[560,390],9:[536,307]},away:{8:[602,376],11:[471,377]},ball:[516,304],
        marks:[pass([520,310],[578,373]),zone([599,305],[722,443])],
      },
      {
        title:'Break the line',
        notes:'The midfielder receives on the half turn. The winger stays wide to stretch the next defender.',
        home:{8:[592,367],7:[630,542]},away:{8:[651,403]},ball:[613,362],
        marks:[run([620,360],[691,342])],
      },
    ],
  }),
  preset({
    name:'Switch to the weak side', category:'In possession',
    description:'Draw the block toward one touchline before finding the free winger on the other side.',
    formation:'4-3-3', opposition:'4-4-2',
    steps:[
      {
        title:'Make the block shift', transition:'pass',
        notes:'Hold width on both sides. Use the near winger and full-back to bring the opposition across before returning the ball inside.',
        home:{3:[414,133],6:[470,285],7:[629,532],8:[554,443],11:[617,100]},
        away:{2:[786,143],3:[789,451],6:[655,341],7:[634,257],8:[658,453],10:[687,529]},
        ball:[608,529], marks:[pass([602,515],[484,306]),highlight([617,100],[682,100])],
      },
      {
        title:'Lift the diagonal', transition:'lob', duration:1750,
        notes:'Take the first touch away from pressure and play the switch to the winger’s front foot.',
        home:{6:[473,296],11:[664,101]},away:{7:[687,281],10:[631,456]},ball:[492,290],
        marks:[lob([501,287],[662,104]),zone([670,52],[766,158])],
      },
      {
        title:'Receive facing goal',
        notes:'The winger attacks the defender before the block can recover. The full-back supports underneath.',
        home:{3:[544,132],11:[692,109]},away:{2:[771,129],7:[737,242]},ball:[713,108],
        marks:[run([721,117],[794,174])],
      },
    ],
  }),
  preset({
    name:'Overlap and cutback', category:'In possession',
    description:'Send the full-back outside the winger and cut the ball back into a late runner.',
    formation:'4-2-3-1', opposition:'4-4-2',
    steps:[
      {
        title:'Fix the full-back', transition:'pass',
        notes:'The winger carries inside to engage the defender rather than releasing the overlap immediately.',
        home:{2:[639,564],7:[733,513],8:[602,396],9:[842,310],10:[706,372]},
        away:{3:[787,501],4:[840,357],6:[762,350],8:[697,420]},ball:[751,505],
        marks:[run([657,563],[864,555]),pass([759,516],[844,549])],
      },
      {
        title:'Run to the byline', transition:'pass',
        notes:'The overlapping full-back gets beyond the defender. The striker holds the near-post defender while the attacking midfielder arrives late.',
        home:{2:[901,550],7:[782,470],9:[897,317],10:[801,378]},away:{3:[854,499],4:[898,351]},
        ball:[921,535],marks:[pass([914,515],[820,371]),zone([805,346],[864,407])],
      },
      {
        title:'Finish the cutback', transition:'shot', duration:1050,
        notes:'Arrive on the move and strike across the goalkeeper with the first touch when possible.',
        home:{10:[838,370]},away:{1:[945,344],6:[798,321]},ball:[854,365],marks:[shot([854,365],[988,299])],
      },
      {
        title:'Hold the edge of the area',
        notes:'The supporting midfielder stays outside the area to recycle a clearance.',
        home:{8:[724,406]},ball:[988,299],
      },
    ],
  }),
  preset({
    name:'4-4-2 mid-block', category:'Out of possession',
    description:'Protect the middle with two tight lines, then shift as the opponent goes wide.',
    formation:'4-4-2', opposition:'4-3-3',
    steps:[
      {
        title:'Screen the centre', transition:'pass',
        notes:'The front two screen the pivot. Keep midfield and defence connected, with the far winger tucked in.',
        home:{2:[266,495],3:[266,132],4:[261,252],5:[261,375],6:[392,238],7:[393,474],8:[391,374],9:[507,374],10:[393,151],11:[507,255]},
        away:{2:[656,89],4:[701,245],5:[705,395],6:[603,311],11:[445,521]},
        ball:[680,251],marks:[zone([278,197],[519,426]),pass([685,236],[657,111])],
      },
      {
        title:'Shift as a unit',
        notes:'The near winger presses from inside to out. The rest of the block slides together, leaving the far touchline open.',
        home:{2:[266,414],3:[266,95],4:[260,190],5:[261,291],6:[392,170],7:[391,396],8:[391,283],9:[492,304],10:[490,115],11:[511,207]},
        away:{2:[634,89],6:[587,273]},ball:[612,98],
        marks:[run([515,115],[591,103]),zone([267,126],[478,371])],
      },
    ],
  }),
  preset({
    name:'Five at the back', category:'Out of possession',
    description:'Protect the box and defend a wide delivery with a compact back five.',
    formation:'5-3-2', opposition:'4-2-3-1',
    steps:[
      {
        title:'Guard the box', transition:'lob',
        notes:'The wing-back gets close to the wide player while the other four defenders hold the central line.',
        home:{2:[165,142],3:[167,218],4:[164,309],5:[164,410],7:[165,483],6:[278,305],8:[289,420],10:[282,194],9:[385,374],11:[387,249]},
        away:{2:[401,108],7:[228,135],9:[248,311],10:[337,315],11:[263,463]},
        ball:[207,142],marks:[lob([210,145],[161,346]),zone([89,222],[214,405])],
      },
      {
        title:'Defend the first contact',
        notes:'The near centre-back attacks the cross. The rest of the line protects the second ball and far post.',
        home:{3:[143,220],4:[133,306],5:[142,371],7:[141,421],6:[245,308]},
        away:{9:[158,328],10:[261,319]},ball:[152,338],
        marks:[highlight([152,338],[184,338]),run([248,306],[201,327])],
      },
    ],
  }),
  preset({
    name:'Win it and counter', category:'Transition',
    description:'Play forward immediately after a midfield recovery and release the fastest runner.',
    formation:'4-2-3-1', opposition:'4-3-3',
    steps:[
      {
        title:'Recover in midfield', transition:'pass', duration:1100,
        notes:'The ball winner’s first look is forward. The striker checks to offer a clean outlet before defenders can reset.',
        home:{6:[427,321],7:[494,497],9:[565,331],10:[468,259],11:[485,131]},
        away:{2:[746,121],3:[755,504],4:[710,363],5:[719,255],6:[453,345],8:[528,390],10:[493,246]},
        ball:[444,318],marks:[pass([446,318],[551,327]),run([510,491],[723,506])],
      },
      {
        title:'Release the runner', transition:'pass',
        notes:'The striker turns or lays the pass off early. The wide runner bends the run to stay onside.',
        home:{7:[678,506],9:[584,335],10:[541,265],11:[586,131]},away:{3:[763,466],4:[742,347]},
        ball:[604,342],marks:[pass([615,347],[742,495])],
      },
      {
        title:'Drive toward the box',
        notes:'The wide runner receives with options for a cutback or a shot. The striker fills the middle lane.',
        home:{7:[765,490],9:[735,325],11:[687,158]},away:{3:[815,459]},ball:[787,482],
        marks:[dribble([787,477],[870,407])],
      },
    ],
  }),
  preset({
    name:'Counterpress on loss', category:'Transition',
    description:'Attack the opponent’s first touch and close the two nearest passing routes.',
    formation:'3-4-3', opposition:'4-3-3',
    steps:[
      {
        title:'Spot the turnover', transition:'dribble', duration:1250,
        notes:'The nearest player presses the ball. The next two players cut off the easy passes instead of chasing the same opponent.',
        home:{2:[603,147],6:[579,260],8:[578,383],9:[654,317],10:[602,494],11:[657,184],7:[656,447]},
        away:{2:[736,126],5:[782,230],6:[635,349],8:[670,214],10:[677,447]},ball:[619,350],
        marks:[run([589,380],[606,351]),run([648,309],[626,335]),run([593,267],[628,291])],
      },
      {
        title:'Close the exit lanes',
        notes:'Force play backward or into traffic. Keep the back line ready to defend a long pass.',
        home:{6:[624,292],8:[606,364],9:[628,313]},away:{6:[625,346]},ball:[610,344],
        marks:[zone([576,283],[677,399]),highlight([610,344],[639,344])],
      },
    ],
  }),
  preset({
    name:'Short corner overload', category:'Set piece',
    description:'Create a two-against-one at the corner, then attack the space behind the first defender.',
    formation:'4-3-3', opposition:'4-4-2',
    steps:[
      {
        title:'Offer the short pass', transition:'pass', duration:1000,
        notes:'The receiver checks toward the taker. Keep two runners on different lines in the box.',
        home:{2:[668,414],4:[815,318],5:[813,379],6:[710,307],7:[914,494],8:[765,421],9:[889,355],10:[798,216],11:[947,578]},
        away:{1:[942,320],3:[905,431],4:[895,381],5:[900,280],6:[840,311],7:[879,142],8:[848,413],11:[746,256]},
        ball:[968,591],marks:[pass([963,581],[925,508]),run([943,569],[961,473])],
      },
      {
        title:'Return the ball around the defender', transition:'pass', duration:1000,
        notes:'Draw the defender onto the short receiver, then play behind them for the corner taker.',
        home:{7:[922,498],11:[950,482],9:[896,353]},away:{3:[913,461]},ball:[936,507],
        marks:[pass([940,497],[951,463]),zone([909,435],[975,485])],
      },
      {
        title:'Deliver from a better angle',
        notes:'The near runner attacks the first ball. The late runner waits for the cutback.',
        home:{11:[943,458],8:[817,385],9:[907,336]},away:{4:[910,360]},ball:[958,445],
        marks:[pass([958,437],[910,337])],
      },
    ],
  }),
  preset({
    name:'Free-kick layoff', category:'Set piece',
    description:'Shift the ball away from the wall for a cleaner shooting lane.',
    formation:'4-3-3', opposition:'4-4-2',
    steps:[
      {
        title:'Set the wall and runners', transition:'pass', duration:900,
        notes:'The first player rolls the ball laterally. The shooter times their approach so the strike arrives before the wall can step.',
        home:{6:[706,405],8:[719,337],9:[834,206],10:[764,442],11:[771,228]},
        away:{1:[949,310],2:[802,265],3:[855,473],4:[815,327],5:[819,370],6:[818,413],7:[859,188],8:[862,246]},
        ball:[735,348],marks:[pass([739,351],[762,421]),highlight([812,367],[842,367])],
      },
      {
        title:'Strike outside the wall', transition:'shot', duration:1050,
        notes:'Shoot through the lane created by the layoff. The striker follows for a rebound.',
        home:{10:[752,426],9:[875,236]},away:{1:[941,337],6:[824,409]},ball:[770,422],
        marks:[shot([771,422],[985,319]),run([878,247],[920,303])],
      },
      {
        title:'Follow the shot',
        notes:'Keep players ready for a save or block. The players outside the area protect the counter.',
        home:{9:[908,297]},ball:[985,319],
      },
    ],
  }),
  preset({
    name:'Four-player passing diamond', category:'Training drill',
    description:'Train receive-and-set passes with a supporting run around the outside.',
    formation:'4-3-3', opposition:'4-4-2',hideOpposition:true,
    steps:[
      {
        title:'Start at the base', transition:'pass', duration:1100,
        notes:'Players 4, 6, 8 and 10 work in a diamond. The remaining home players wait outside the working area.',
        home:{1:[88,86],2:[156,86],3:[225,86],4:[395,310],5:[293,86],6:[500,208],7:[361,86],8:[500,412],9:[429,86],10:[610,310],11:[498,86]},
        ball:[417,309],marks:[cone([380,310]),cone([500,187]),cone([500,433]),cone([624,311]),pass([424,302],[484,225])],
      },
      {
        title:'Set around the corner', transition:'pass', duration:1050,
        notes:'Receive on the back foot and turn the pass around the corner. The first passer moves to the next station.',
        home:{4:[430,260],6:[505,213]},ball:[522,222],
        marks:[cone([380,310]),cone([500,187]),cone([500,433]),cone([624,311]),pass([525,224],[593,296]),run([440,254],[479,208])],
      },
      {
        title:'Complete the diamond',
        notes:'Send the next pass down to the third station. Check shoulders and call before the ball travels.',
        home:{4:[478,218],6:[553,253]},ball:[590,303],
        marks:[cone([380,310]),cone([500,187]),cone([500,433]),cone([624,311]),pass([594,319],[513,391])],
      },
    ],
  }),
];

function nextCoreStage(scene, {title,notes,home,away,ball,marks = [],transition,duration}) {
  return {
    title,notes,transition,duration,
    scene:{
      players:position(scene.players,home,away),
      ball:point(ball),
      marks:marks.map(([type,color,coordinates],index) =>
        ({id:`phase-mark-${index}`,type,color,points:coordinates.map(point)})),
    },
  };
}

function highPressStages(template) {
  const first = {
    title:'Screen the pivot',notes:template.description,
    transition:'pass',duration:1250,scene:template.scene,
  };
  const press = nextCoreStage(first.scene,{
    title:'Trap the full-back',
    notes:'The wide forward curves their approach to close the line, while the striker shuts off the pass back inside.',
    home:{11:[786,119],9:[783,231],10:[663,299],6:[565,221]},
    away:{2:[817,109],5:[822,205],6:[720,295]},
    ball:[830,123],transition:'pass',duration:1100,
    marks:[zone([803,66],[874,154]),pass([831,128],[758,178]),run([665,290],[728,197])],
  });
  const win = nextCoreStage(press.scene,{
    title:'Win the second pass',
    notes:'The next midfielder steps onto the loose ball. The winger and striker turn upfield to support the transition.',
    home:{10:[741,174],11:[825,97],9:[821,243],6:[661,228]},
    away:{2:[821,127],5:[835,202],6:[714,274]},
    ball:[760,181],transition:'pass',duration:1300,
    marks:[pass([761,182],[874,242]),run([834,239],[868,241])],
  });
  const attack = nextCoreStage(win.scene,{
    title:'Play forward from the recovery',
    notes:'Look to play into the striker before the opposition back line can reset.',
    home:{9:[856,237],11:[881,127],10:[789,178]},away:{5:[855,202],6:[755,278]},ball:[879,240],
  });
  return [first,press,win,attack];
}

function cornerStages(template) {
  const first = {
    title:'Set up the corner',notes:template.description,
    transition:'lob',duration:1700,scene:template.scene,
  };
  const delivery = nextCoreStage(first.scene,{
    title:'Meet the near-post delivery',
    notes:'The near runner darts across the defender while the late runner waits above the penalty spot. Redirect the ball across the six-yard area.',
    home:{9:[913,204],4:[857,296],5:[850,384],8:[803,412]},
    away:{1:[947,286],2:[918,241],5:[912,284],8:[883,394]},ball:[931,212],
    transition:'pass',duration:1050,
    marks:[pass([931,214],[864,375]),run([813,405],[849,382])],
  });
  const strike = nextCoreStage(delivery.scene,{
    title:'Strike the second ball',
    notes:'The late runner arrives behind the defenders and shoots across the goalkeeper.',
    home:{8:[846,372],9:[912,225]},away:{1:[950,297],8:[902,386]},ball:[867,367],
    transition:'shot',duration:1100,
    marks:[shot([868,367],[986,319])],
  });
  const finish = nextCoreStage(strike.scene,{
    title:'Follow the finish',
    notes:'The near runner follows the shot. The player on the edge of the area protects against a clearance.',
    home:{8:[880,357],9:[931,278],6:[729,320]},away:{1:[950,317],8:[912,363]},
    ball:[986,319],
  });
  return [first,delivery,strike,finish];
}

export function coreTemplateStages(template) {
  if (template.name === 'High press') return highPressStages(template);
  if (template.name === 'Corner routine') return cornerStages(template);
  return null;
}
