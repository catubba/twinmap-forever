// 简体中文 地图: the notes on every key are in en/map.ts.
export default {
  layers: {
    button: '筛选',
    buttonTip: '筛选（L）',
    menu: '地图筛选',
    hideAll: '隐藏全部{group}',
    showAll: '显示全部{group}',
    kinds: '{layer}种类',
    hideGrey: '隐藏灰色',
    hideGreyTip: '隐藏不再提高技能的种类',
    skill: '技能 {skill}',
    notLearned: '未学会',
    skillUnread: '尚未读取技能',
    groups: {
      // The character (glossary), never 你: "隐藏全部你" would not read.
      you: '角色',
      quests: '任务',
      // Town services, as the game's AVAILABLE_SERVICES "可以使用的服务".
      services: '服务',
      // Ore and herbs: what gathering professions collect.
      resources: '采集',
      world: '世界',
      group: '小队',
    },
    // Service layers follow the game's minimap tracking menu (MINIMAP_TRACKING_*), so the NPC, not the place.
    names: {
      arrow: '箭头',
      route: '路线',
      mypins: '我的标记',
      death: '尸体和墓地',
      // AVAILABLE_QUESTS shortened as MAP_LEGEND_HUB_TOOLTIP "可接的任务".
      available: '可接任务',
      // The game's map legend MAP_LEGEND_TURNIN.
      turnin: '可完成',
      objectives: '任务目标',
      lowlevel: '低等级任务',
      flight: '飞行管理员',
      inn: '旅店老板',
      vendors: '商人',
      repair: '修理',
      trainers: '训练师',
      bank: '银行职员',
      auction: '拍卖师',
      stable: '兽栏管理员',
      ore: '矿脉',
      herbs: '草药',
      zones: '地名',
      relief: '地形',
      caves: '洞穴',
      dungeons: '地下城',
      routes: '飞行路线',
      vessels: '船只和飞艇',
      bosses: '地下城首领',
      companions: '小队',
    },
  },

  continents: {
    easternKingdoms: '东部王国',
    kalimdor: '卡利姆多',
  },

  corner: {
    back: '返回{place}',
    view3d: '3D视图',
    view3dTip: '2D或3D视图（3）',
    turn: '随角色旋转',
    turnTip: '随角色旋转（N）',
    northUpTip: '北方朝上（N）',
    // Floors of a dungeon: 层, as the game's floor names (上层, 下层); 等级 is the character's level.
    levels: '层',
    levelsShown: '显示的层',
    everyRoom: '所有房间',
    roomsUpTo: '至第{level}层的房间',
    zoomIn: '放大',
    zoomInTip: '放大（+）',
    zoomOut: '缩小',
    zoomOutTip: '缩小（-）',
    // The map follows the character: the game's FOLLOW, keeping 追踪 for the arrow on a point.
    follow: '跟随',
    followTip: '跟随你的角色（F）',
  },

  offMap: '地图上没有这个地方。',
  // The game's FPS_ABBR.
  fps: '{fps} fps',
  nothingToSend: '没有可发送的内容。',

  pins: {
    rewardXp: '{xp} 经验值',
    lessXpFrom: '等级 {level} 起减少',
    lessXp: '已减少',
    entrance: '入口',
    shipTo: '船：{place}',
    zeppelinTo: '飞艇：{place}',
    entranceOf: '入口：{name}',
    // Rare as the game's map legend says it for creatures (MAP_LEGEND_RARE).
    rareBoss: '{name}（稀有）',
    graveyard: '墓地',
    corpse: '你的尸体',
    followed: '{name}，正在游戏中追踪',
    journey: '{name}，游戏中的行程',
    quest: {
      available: '可接任务',
      turnin: '可交任务',
      objective: '任务目标',
    },
    objective: {
      slay: '任务目标：击杀',
      loot: '任务目标：拾取',
      object: '任务目标：使用',
      talk: '任务目标：对话',
      event: '任务目标：前往',
    },
  },

  // Coordinates as numbers, with an ASCII comma; the space after the zone keeps its name apart from the digits.
  place: {
    coords: '{x}, {y}',
    inZone: '{zone} {x}, {y}',
  },

  // The direction first reads naturally.
  way: {
    north: '北{far}',
    northEast: '东北{far}',
    east: '东{far}',
    southEast: '东南{far}',
    south: '南{far}',
    southWest: '西南{far}',
    west: '西{far}',
    northWest: '西北{far}',
    onFoot: '步行{time}',
    mounted: '坐骑{time}',
  },

  label: {
    pinName: '标记名称',
    far: '{far}，{time}',
    dungeonMap: '地下城地图',
    raidMap: '团队副本地图',
    send: '发送到游戏',
    sending: '发送中',
    sent: '已发送',
    stopFollowing: '停止追踪',
    addToRoute: '加入路线',
    inRoute: '已在路线中',
    save: '保存',
    remove: '移除',
    noAnswer: '游戏尚未回应。脱离战斗后，游戏才会接收该标记。',
  },

  nextStop: {
    none: '没有路线。点击地图以添加途经点。',
    title: '下一个途经点',
    count: '{n}/{of}',
    complete: '路线已完成',
    // Other continent, or inside or outside a dungeon: "the current map" says it more plainly than "ground".
    elsewhere: '不在当前地图上',
    here: '已到达',
    minutes: '分钟（步行）',
    minutesMounted: '分钟（坐骑）',
    skip: '跳过',
    edit: '编辑路线',
    clear: '清除',
    unsent: '尚未发送到游戏',
    send: '发送路线到游戏',
    onItsWay: '正在发送到游戏。',
    moveUp: '上移{name}',
    moveDown: '下移{name}',
    remove: '移除{name}',
  },

  search: {
    placeholder: '搜索NPC、物品、任务、地区',
    field: '搜索',
    results: '搜索结果',
    none: '没有找到这个名字。',
    zone: '地区',
    myPin: '我的标记',
    myPinIn: '我的标记，{zone}',
    dungeon: '地下城',
    dungeonIn: '地下城，{zone}',
    raid: '团队副本',
    raidIn: '团队副本，{zone}',
    foundIn: '{what}，{zone}',
  },
}
