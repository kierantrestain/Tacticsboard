import { makeLineup } from './data.js';

const run = (from,to) => ['run','#08e5f1',[from,to]];
const zone = (from,to) => ['zone','#ebc858',[from,to]];
const highlight = (point,edge) => ['highlight','#ebc858',[point,edge]];
const cone = point => ['cone','#ebc858',[point]];
const foot = (ownerId,dx = 20,dy = 0) => ({ownerId,dx,dy});
const placed = (x,y) => ({ownerId:null,x,y});

const motionArrows = {pass:'arrow',dribble:'dribble',lob:'lob',shot:'shot'};
function point([x,y]) {
  return {x,y};
}

function position(players,home = {},away = {}) {
  return players.map(player => {
    const coordinates = (player.team === 'home' ? home : away)[player.number];
    return coordinates ? {...player,...point(coordinates)} : {...player};
  });
}

function ballAt(where,players) {
  if (where.ownerId === null) return {x:where.x,y:where.y,ownerId:null};
  const player = players.find(item => item.id === where.ownerId);
  return {x:player.x + where.dx,y:player.y + where.dy,ownerId:player.id};
}

function stageSequence(players,steps) {
  const stages = steps.map((step,index) => {
    players = position(players,step.home,step.away);
    return {
      title:step.title,
      notes:step.notes,
      ...(step.motion ? {
        transition:step.motion,
        duration:step.duration,
        ballTiming:{release:step.release,arrival:step.arrival},
      } : {}),
      scene:{
        players,ball:ballAt(step.ball,players),
        marks:(step.marks ?? []).map(([type,color,coordinates],markIndex) =>
          ({id:`preset-${index + 1}-${markIndex + 1}`,type,color,points:coordinates.map(point)})),
      },
    };
  });
  // Derive each instructional arrow from the same checkpoints as the animation.
  stages.forEach((stage,index) => {
    const type = motionArrows[stage.transition];
    if (!type || !stages[index + 1]) return;
    const {x,y} = stage.scene.ball;
    const end = stages[index + 1].scene.ball;
    stage.scene.marks.unshift({
      id:`ball-action-${index + 1}`,
      type,
      color:type === 'dribble' ? '#08e5f1' : '#eef7e9',
      points:[{x,y},{x:end.x,y:end.y}],
    });
  });
  return stages;
}

function preset({name,category,description,formation,opposition,hideOpposition = false,steps}) {
  const stages = stageSequence([...makeLineup('home',formation),...makeLineup('away',opposition)],steps);
  return {
    name,category,description,homeFormation:formation,awayFormation:opposition,
    ...(hideOpposition ? {settings:{away:false}} : {}),
    scene:stages[0].scene,stages,
  };
}

export const extraTemplates = [
  preset({
    name:'Third-man combination',category:'Build-up',
    description:'Bounce the ball off the striker into a midfielder’s run beyond the press.',
    formation:'4-3-3',opposition:'4-4-2',
    steps:[
      {
        title:'Find the striker’s feet',motion:'pass',duration:2050,release:.12,arrival:.74,
        notes:'The centre-back threads the first pass. The striker checks toward it as the midfielder starts their run.',
        home:{4:[250,247],6:[355,308],8:[430,424],9:[567,315],7:[575,540]},
        away:{9:[380,238],11:[411,395],6:[610,248],8:[637,408]},
        ball:foot('home-4',20,6),marks:[run([448,422],[525,389])],
      },
      {
        title:'Set the third man',motion:'pass',duration:1650,release:.16,arrival:.67,
        notes:'The striker sets back and across to the midfielder. The winger stays wide to stretch the next defender.',
        home:{8:[530,390],9:[536,307]},away:{8:[615,409],11:[467,372]},
        ball:foot('home-9',-20,-3),marks:[zone([616,305],[722,422])],
      },
      {
        title:'Carry beyond the press',motion:'dribble',duration:1800,release:0,arrival:1,
        notes:'The midfielder receives on the half-turn and drives into the space ahead.',
        home:{8:[592,367],7:[630,542]},away:{8:[654,410]},
        ball:foot('home-8',20,-3),
      },
      {
        title:'The line is broken',
        notes:'The midfielder has the ball in front of the next line and a wide option on the right.',
        home:{8:[682,343],7:[696,538]},away:{8:[689,408]},
        ball:foot('home-8',22,0),
      },
    ],
  }),
  preset({
    name:'Switch to the weak side',category:'In possession',
    description:'Draw the block to one flank and find the free winger on the other.',
    formation:'4-3-3',opposition:'4-4-2',
    steps:[
      {
        title:'Make the block shift',motion:'pass',duration:2200,release:.11,arrival:.73,
        notes:'Hold both touchlines. The right winger returns the ball inside as defenders shift toward them.',
        home:{3:[414,133],6:[470,285],7:[629,532],8:[554,443],11:[617,100]},
        away:{2:[786,143],3:[789,451],6:[655,341],7:[634,257],8:[658,453],10:[687,529]},
        ball:foot('home-7',-21,-8),marks:[highlight([617,100],[678,100])],
      },
      {
        title:'Lift the diagonal',motion:'lob',duration:2450,release:.2,arrival:.88,
        notes:'The pivot takes the first touch away from pressure and switches to the winger’s front foot.',
        home:{6:[481,296],11:[646,103]},away:{7:[687,281],10:[631,456]},
        ball:foot('home-6',20,-6),marks:[zone([670,52],[766,158])],
      },
      {
        title:'Receive facing goal',motion:'dribble',duration:1750,release:0,arrival:1,
        notes:'The winger drives at the defender before the block can recover. The full-back supports inside.',
        home:{3:[544,132],11:[692,109]},away:{2:[789,129],7:[737,242]},
        ball:foot('home-11',21,-1),
      },
      {
        title:'Attack the isolated defender',
        notes:'The winger has space to cross or cut back. The nearest supporting player keeps the second pass available.',
        home:{3:[620,138],11:[777,166]},away:{2:[830,183],7:[793,238]},
        ball:foot('home-11',21,-1),
      },
    ],
  }),
  preset({
    name:'Overlap and cutback',category:'In possession',
    description:'Send the full-back outside the winger, then find a late runner behind the defence.',
    formation:'4-2-3-1',opposition:'4-4-2',
    steps:[
      {
        title:'Fix the full-back',motion:'dribble',duration:1750,release:0,arrival:1,
        notes:'The winger takes the ball inside. That pulls the defender across and opens the outside lane.',
        home:{2:[639,564],7:[713,513],8:[602,396],9:[842,310],10:[706,372]},
        away:{3:[783,504],4:[840,357],6:[762,350],8:[697,420]},
        ball:foot('home-7',19,-8),marks:[run([659,564],[740,564])],
      },
      {
        title:'Play in the overlap',motion:'pass',duration:1950,release:.2,arrival:.75,
        notes:'Wait until the full-back has run beyond the wide defender, then play into their stride.',
        home:{2:[743,564],7:[759,463],8:[654,403],10:[761,381]},
        away:{3:[798,430],4:[863,373]},ball:foot('home-7',20,8),
        marks:[run([760,562],[875,553])],
      },
      {
        title:'Cut back behind the line',motion:'pass',duration:1700,release:.16,arrival:.77,
        notes:'The striker pins the near-post defender. The full-back plays back to the midfielder arriving behind them.',
        home:{2:[887,550],7:[815,465],9:[898,317],10:[805,378]},
        away:{3:[851,475],4:[902,384],6:[795,323]},
        ball:foot('home-2',19,-10),marks:[zone([800,345],[870,406])],
      },
      {
        title:'Strike across goal',motion:'shot',duration:1300,release:.18,arrival:.68,
        notes:'The late runner meets the cutback and shoots across the goalkeeper.',
        home:{10:[842,368]},away:{1:[946,339],3:[855,503],6:[810,342]},
        ball:foot('home-10',18,-4),
      },
      {
        title:'Finish and cover the clearance',
        notes:'The shot reaches the far side of the net. The supporting midfielder holds the edge of the area.',
        home:{8:[731,406],10:[862,359]},away:{1:[956,319]},
        ball:placed(987,292),
      },
    ],
  }),
  preset({
    name:'4-4-2 mid-block',category:'Out of possession',
    description:'Protect the middle with two compact lines and slide when the opponent goes wide.',
    formation:'4-4-2',opposition:'4-3-3',
    steps:[
      {
        title:'Screen the centre',motion:'pass',duration:2250,release:.17,arrival:.74,
        notes:'The front two screen the pivot. Keep midfield and defence connected, with the far winger tucked in.',
        home:{2:[266,495],3:[266,132],4:[261,252],5:[261,375],6:[392,238],7:[393,474],8:[391,374],9:[507,374],10:[393,151],11:[507,255]},
        away:{2:[656,89],4:[701,245],5:[705,395],6:[603,311],11:[445,521]},
        ball:foot('away-4',-19,5),marks:[zone([278,197],[519,426])],
      },
      {
        title:'Shift as a unit',motion:'pass',duration:1800,release:.22,arrival:.76,
        notes:'The near winger presses from inside to out. The rest of the block slides over and denies the pass inside.',
        home:{2:[266,414],3:[266,95],4:[260,190],5:[261,291],6:[392,170],7:[391,396],8:[391,283],9:[492,304],10:[478,115],11:[511,207]},
        away:{2:[634,89],4:[728,211],6:[587,273]},ball:foot('away-2',-21,9),
        marks:[run([488,113],[570,103]),zone([270,126],[470,371])],
      },
      {
        title:'Force the return pass',
        notes:'The full-back can only go backward. As the ball returns to the centre-back, the block recovers its central shape.',
        home:{6:[394,205],8:[393,315],9:[502,331],10:[565,111],11:[499,232]},away:{4:[742,230]},
        ball:foot('away-4',-20,-6),
      },
    ],
  }),
  preset({
    name:'Five at the back',category:'Out of possession',
    description:'Defend a wide delivery, win the first contact, then secure the second ball.',
    formation:'5-3-2',opposition:'4-2-3-1',
    steps:[
      {
        title:'Guard the box',motion:'lob',duration:1900,release:.16,arrival:.88,
        notes:'The wing-back gets close to the wide player while the other four defenders keep their spacing.',
        home:{2:[165,142],3:[167,218],4:[164,309],5:[164,410],7:[165,483],6:[278,305],8:[289,420],10:[282,194],9:[385,374],11:[387,249]},
        away:{2:[401,108],7:[228,135],9:[248,311],10:[337,315],11:[263,463]},
        ball:foot('away-7',-21,7),marks:[zone([89,222],[214,405])],
      },
      {
        title:'Win the first contact',motion:'pass',duration:1600,release:.12,arrival:.7,
        notes:'The centre-back steps in front of the striker and directs the clearance to a supporting midfielder.',
        home:{3:[143,220],4:[133,306],5:[146,380],7:[141,439],6:[249,301]},
        away:{9:[177,354],10:[260,354]},ball:foot('home-4',17,10),
        marks:[highlight([150,316],[178,316])],
      },
      {
        title:'Secure the second ball',
        notes:'The midfielder receives facing out of the box. The back five stay organized behind the ball.',
        home:{6:[246,289],8:[265,393]},away:{10:[286,335]},
        ball:foot('home-6',20,-3),
      },
    ],
  }),
  preset({
    name:'Win it and counter',category:'Transition',
    description:'Play forward from a midfield recovery, release the runner, then attack the box.',
    formation:'4-2-3-1',opposition:'4-3-3',
    steps:[
      {
        title:'Recover in midfield',motion:'pass',duration:1550,release:.1,arrival:.72,
        notes:'The ball winner looks forward immediately. The striker checks to provide an outlet.',
        home:{6:[427,321],7:[494,497],9:[565,331],10:[468,259],11:[485,131]},
        away:{2:[746,121],3:[755,504],4:[710,363],5:[719,255],6:[463,352],8:[528,390],10:[493,246]},
        ball:foot('home-6',17,-4),marks:[run([513,495],[605,495])],
      },
      {
        title:'Release the wide runner',motion:'pass',duration:2000,release:.22,arrival:.76,
        notes:'The striker opens up and sends the wide runner into the channel. The runner stays onside until the ball leaves.',
        home:{7:[605,497],9:[584,335],10:[541,265],11:[586,131]},
        away:{3:[763,445],4:[742,347]},ball:foot('home-9',19,7),
      },
      {
        title:'Drive toward the box',motion:'dribble',duration:1750,release:0,arrival:1,
        notes:'The winger takes the ball in stride. The striker fills the middle lane for the cutback.',
        home:{7:[765,490],9:[722,325],11:[687,158]},away:{3:[812,446]},
        ball:foot('home-7',22,-8),
      },
      {
        title:'Create the cutback option',
        notes:'The winger reaches the outside of the box with the ball and the striker is ready for the next pass.',
        home:{7:[858,432],9:[825,321],11:[749,183]},away:{3:[867,391],4:[825,346]},
        ball:foot('home-7',22,-3),
      },
    ],
  }),
  preset({
    name:'Counterpress on loss',category:'Transition',
    description:'Attack the first touch, close the exit lanes, and regain possession.',
    formation:'3-4-3',opposition:'4-3-3',
    steps:[
      {
        title:'Spot the turnover',motion:'dribble',duration:1450,release:0,arrival:1,
        notes:'The away pivot collects possession and tries to turn out. The nearest home players close from different angles.',
        home:{2:[603,147],6:[579,260],8:[578,383],9:[674,306],10:[602,494],11:[657,184],7:[656,447]},
        away:{2:[736,126],5:[782,230],6:[635,349],8:[670,214],10:[677,447]},
        ball:foot('away-6',-17,3),marks:[run([582,379],[604,365]),run([661,309],[635,330]),run([588,269],[620,303])],
      },
      {
        title:'Cut off the inside pass',motion:'pass',duration:1400,release:.18,arrival:.62,
        notes:'The pivot is forced into a hurried pass. The home midfielder steps onto the passing lane while the forward blocks the return.',
        home:{6:[622,302],8:[598,376],9:[646,316]},away:{6:[625,347],8:[659,222]},
        ball:foot('away-6',-17,5),marks:[zone([584,285],[678,399])],
      },
      {
        title:'Regain and play out',motion:'pass',duration:1500,release:.24,arrival:.74,
        notes:'The intercepting midfielder gets control and uses the safer wide outlet.',
        home:{6:[619,288],7:[684,451],8:[616,376],9:[645,313]},away:{6:[626,350],8:[646,228],10:[689,485]},
        ball:foot('home-6',17,7),
      },
      {
        title:'Secure possession',
        notes:'The winger has controlled the outlet. The closest players offer support while the back line keeps its shape.',
        home:{7:[724,466],8:[654,374]},away:{10:[742,497]},
        ball:foot('home-7',18,-7),
      },
    ],
  }),
  preset({
    name:'Short corner overload',category:'Set piece',
    description:'Use the short pass to draw out a defender and release a cutback into the box.',
    formation:'4-3-3',opposition:'4-4-2',
    steps:[
      {
        title:'Offer the short pass',motion:'pass',duration:1450,release:.23,arrival:.76,
        notes:'The receiver checks toward the taker. Keep two runners on separate lines in the box.',
        home:{2:[668,414],4:[815,318],5:[813,379],6:[710,307],7:[914,494],8:[765,421],9:[889,355],10:[798,216],11:[947,578]},
        away:{1:[942,320],3:[905,431],4:[895,381],5:[900,280],6:[840,311],7:[879,142],8:[848,413],11:[746,256]},
        ball:placed(968,591),marks:[run([947,573],[949,506])],
      },
      {
        title:'Return behind the defender',motion:'pass',duration:1500,release:.17,arrival:.74,
        notes:'The short receiver pulls the defender out. The taker runs around the outside for the return.',
        home:{7:[919,510],11:[950,509],9:[896,353]},away:{3:[918,474]},
        ball:foot('home-7',17,10),marks:[zone([920,437],[974,480])],
      },
      {
        title:'Deliver the cutback',motion:'pass',duration:1550,release:.2,arrival:.73,
        notes:'The near runner attacks the first ball. The taker cuts back to the late runner inside the box.',
        home:{11:[947,455],8:[813,397],9:[909,337]},away:{4:[912,360],3:[940,466]},
        ball:foot('home-11',15,-10),
      },
      {
        title:'Meet the cutback',motion:'shot',duration:1300,release:.16,arrival:.69,
        notes:'The late runner meets the pass on their front foot and shoots early.',
        home:{8:[840,390]},away:{1:[946,349],4:[917,383],6:[850,337]},
        ball:foot('home-8',18,-8),
      },
      {
        title:'Finish behind the defender',
        notes:'The shot crosses the goal line. The players outside the area keep the counter covered.',
        home:{8:[859,380],9:[936,318]},away:{1:[958,337]},
        ball:placed(987,296),
      },
    ],
  }),
  preset({
    name:'Free-kick layoff',category:'Set piece',
    description:'Roll the ball away from the wall for a cleaner shot.',
    formation:'4-3-3',opposition:'4-4-2',
    steps:[
      {
        title:'Set the wall and runners',motion:'pass',duration:1450,release:.28,arrival:.72,
        notes:'The first player rolls the ball laterally. The shooter times their approach so the wall cannot close the new lane.',
        home:{6:[706,405],8:[717,338],9:[834,206],10:[735,453],11:[771,228]},
        away:{1:[949,310],2:[802,265],3:[855,473],4:[815,327],5:[819,365],6:[818,397],7:[859,188],8:[862,246]},
        ball:placed(736,351),marks:[highlight([818,363],[851,363])],
      },
      {
        title:'Strike outside the wall',motion:'shot',duration:1325,release:.16,arrival:.71,
        notes:'Shoot through the lane created by the layoff. The striker follows in case the goalkeeper can only parry it.',
        home:{10:[747,464],9:[876,245]},away:{1:[945,327],6:[822,394]},
        ball:foot('home-10',20,-3),marks:[run([887,246],[926,296])],
      },
      {
        title:'Follow the shot',
        notes:'The ball reaches the far side of the net. The players outside the box protect against a clearance.',
        home:{9:[918,296],10:[767,452]},away:{1:[957,312]},
        ball:placed(986,293),
      },
    ],
  }),
  preset({
    name:'Four-player passing diamond',category:'Training drill',
    description:'Circulate the ball all the way around the diamond with a supporting run.',
    formation:'4-3-3',opposition:'4-4-2',hideOpposition:true,
    steps:(() => {
      const cones = [cone([380,310]),cone([500,187]),cone([500,433]),cone([624,311])];
      return [
        {
          title:'Start at the base',motion:'pass',duration:1475,release:.13,arrival:.7,
          notes:'Players 4, 6, 8 and 10 occupy the four stations. Show early for the first pass.',
          home:{1:[88,86],2:[156,86],3:[225,86],4:[395,310],5:[293,86],6:[500,208],7:[361,86],8:[500,412],9:[429,86],10:[610,310],11:[498,86]},
          ball:foot('home-4',20,-2),marks:cones,
        },
        {
          title:'Set around the corner',motion:'pass',duration:1425,release:.18,arrival:.7,
          notes:'Player 6 receives on the back foot and transfers the ball across to player 10.',
          home:{4:[422,283],6:[503,212]},ball:foot('home-6',14,13),
          marks:[...cones,run([419,278],[459,246])],
        },
        {
          title:'Find the far station',motion:'pass',duration:1450,release:.19,arrival:.72,
          notes:'Player 10 checks their shoulder and plays to player 8, who opens up for the return.',
          home:{4:[465,250],6:[530,251],10:[608,311]},ball:foot('home-10',-18,-9),marks:cones,
        },
        {
          title:'Return to the first runner',motion:'pass',duration:1550,release:.2,arrival:.73,
          notes:'Player 8 passes into the run of player 4 on the other side of the diamond.',
          home:{4:[441,300],8:[500,407]},ball:foot('home-8',17,-13),marks:cones,
        },
        {
          title:'Complete the rotation',
          notes:'Player 4 receives the return and can start the pattern again.',
          home:{4:[398,316],6:[505,209]},ball:foot('home-4',20,-3),marks:cones,
        },
      ];
    })(),
  }),
];

const buildSteps = [
  {
    title:'Draw the first press',motion:'pass',duration:1600,release:.18,arrival:.74,
    notes:'Split the centre-backs. The left centre-back plays through the first line when the pivot opens a passing angle.',
    ball:foot('home-4',21,11),marks:[run([355,315],[355,342])],
  },
  {
    title:'Find the right-back',motion:'pass',duration:2050,release:.2,arrival:.76,
    notes:'The pivot receives facing forward. The right-back moves up the outside before the pivot plays into their feet.',
    home:{2:[291,491],6:[337,338],8:[394,412]},away:{9:[455,252],11:[489,379]},
    ball:foot('home-6',19,9),marks:[run([305,501],[368,507])],
  },
  {
    title:'Release the right winger',motion:'pass',duration:2080,release:.32,arrival:.76,
    notes:'As the winger runs behind the wide defender, the right-back sends the ball into their path.',
    home:{2:[369,506],6:[356,350],7:[535,541],8:[448,415]},away:{7:[601,488],9:[466,279],11:[514,411]},
    ball:foot('home-2',19,-5),marks:[run([558,539],[679,528])],
  },
  {
    title:'Carry into space',motion:'dribble',duration:1650,release:0,arrival:1,
    notes:'The right winger receives on the run. The supporting midfielder moves inside for the next pass.',
    home:{2:[420,497],7:[679,529],8:[529,408]},away:{7:[648,483],11:[562,419]},
    ball:foot('home-7',21,-8),
  },
  {
    title:'Break the line',
    notes:'The winger has driven into the attacking third with support inside and behind.',
    home:{7:[763,492],8:[618,395]},away:{7:[724,451]},
    ball:foot('home-7',20,-7),
  },
];

const pressSteps = [
  {
    title:'Screen the pivot',motion:'pass',duration:1900,release:.22,arrival:.77,
    notes:'The centre-forward blocks the pivot. The centre-back sends the ball to the full-back on the touchline.',
    ball:foot('away-5',17,16),
    marks:[zone([752,64],[891,155]),run([650,118],[770,116]),run([681,265],[774,241])],
  },
  {
    title:'Trap the full-back',motion:'pass',duration:1650,release:.26,arrival:.64,
    notes:'The wide forward closes the line while the striker blocks the return pass. A midfielder steps into the pass back inside.',
    home:{11:[776,128],9:[782,240],10:[664,261],6:[561,231]},
    away:{2:[817,109],5:[833,211],6:[719,295]},ball:foot('away-2',13,14),
    marks:[zone([801,70],[870,158]),run([675,249],[723,193])],
  },
  {
    title:'Secure the interception',motion:'pass',duration:1650,release:.24,arrival:.71,
    notes:'The midfielder controls the interception and passes into the striker’s feet before the defence can turn.',
    home:{10:[735,173],11:[811,107],9:[823,246],6:[632,229]},
    away:{2:[830,126],5:[844,200],6:[719,278]},ball:foot('home-10',18,9),
    marks:[run([836,240],[869,244])],
  },
  {
    title:'Find the forward outlet',
    notes:'The striker receives facing goal. The winger and the ball-winning midfielder are available for the next action.',
    home:{9:[862,243],11:[873,124],10:[783,177]},away:{5:[875,196],6:[757,289]},
    ball:foot('home-9',20,0),
  },
];

const cornerSteps = [
  {
    title:'Deliver to the near post',motion:'lob',duration:2250,release:.24,arrival:.89,
    notes:'Start from the corner arc. The near runner darts across the defender while the late runner holds behind the line.',
    ball:placed(968,32),marks:[zone([881,178],[942,249]),run([866,250],[908,206]),run([772,445],[810,401])],
  },
  {
    title:'Lay the ball back',motion:'pass',duration:1700,release:.19,arrival:.73,
    notes:'The near runner redirects the delivery behind the defence. The late runner arrives on a different line.',
    home:{9:[909,204],4:[848,292],5:[859,393],8:[813,402]},
    away:{1:[947,284],2:[943,242],5:[913,286],8:[887,406]},ball:foot('home-9',19,9),
    marks:[run([819,402],[848,381])],
  },
  {
    title:'Strike the second ball',motion:'shot',duration:1360,release:.24,arrival:.7,
    notes:'The late runner meets the layoff and shoots across the goalkeeper.',
    home:{8:[850,373],9:[914,220]},away:{1:[948,297],8:[900,400]},
    ball:foot('home-8',18,-6),
  },
  {
    title:'Finish across goal',
    notes:'The ball crosses the goal line. The near runner follows in and the player on the edge covers a clearance.',
    home:{8:[871,360],9:[932,275],6:[728,320]},away:{1:[957,315],8:[913,381]},
    ball:placed(987,323),
  },
];

export function coreTemplateStages(template) {
  const steps = {
    'Build from the back':buildSteps,
    'High press':pressSteps,
    'Corner routine':cornerSteps,
  }[template.name];
  return steps ? stageSequence(template.scene.players,steps) : null;
}

export const motionDemoTemplate = preset({
  name:'From build-up to finish',category:'Animation',
  description:'Watch a grounded pass, a controlled dribble, a lofted pass and a shot in one sequence.',
  formation:'4-3-3',opposition:'4-4-2',
  steps:[
    {
      title:'Play out under pressure',motion:'pass',duration:1800,release:.22,arrival:.76,
      notes:'The centre-back slides a ground pass into the pivot, who checks into the gap between the two pressers.',
      home:{4:[245,236],6:[365,323],8:[433,440],9:[505,261],11:[505,128]},
      away:{6:[619,324],8:[642,414],9:[445,231],11:[458,403]},
      ball:foot('home-4',20,9),
    },
    {
      title:'Carry through midfield',motion:'dribble',duration:2200,release:0,arrival:1,
      notes:'The pivot carries beyond the press with short touches, waiting for the striker’s run.',
      home:{6:[371,333],8:[465,432],9:[560,260]},away:{9:[427,245],11:[461,385]},
      ball:foot('home-6',17,-7),marks:[run([577,253],[680,238])],
    },
    {
      title:'Lift the pass behind the line',motion:'lob',duration:2400,release:.36,arrival:.89,
      notes:'The striker runs from onside across the centre-back before the pivot clips the pass into the channel.',
      home:{6:[502,337],8:[555,419],9:[637,235]},away:{4:[755,272],5:[785,386],6:[624,355],8:[650,432]},
      ball:foot('home-6',21,-3),marks:[run([658,233],[811,269])],
    },
    {
      title:'Receive and shoot',motion:'shot',duration:1300,release:.23,arrival:.72,
      notes:'The striker cushions the ball and shoots low toward the far side, beyond the goalkeeper’s reach.',
      home:{9:[827,268],8:[676,392],7:[758,519]},away:{4:[803,302],5:[847,369],1:[946,298]},
      ball:foot('home-9',19,5),
    },
    {
      title:'Finish in the far side of the net',
      notes:'The shot crosses the goal line. The supporting runners remain available for a second ball.',
      home:{9:[850,279],8:[696,379],7:[794,492]},away:{1:[954,296],4:[824,313],5:[852,349]},
      ball:placed(987,332),
    },
  ],
});
