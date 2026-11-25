// 简体中文 拍卖行: the notes on every key are in en/auction.ts.
export default {
  unknownItem: '物品{id}',

  house: {
    line: '拍卖行{number} · {side} · {ruleset}',
    // The game names no "ruleset": the realm list calls it the type (GS REALM_TYPE "类型").
    unknownRuleset: '服务器类型{id}',
  },
  // GS FACTION_ALLIANCE, FACTION_HORDE, FACTION_NEUTRAL.
  side: {
    alliance: '联盟',
    horde: '部落',
    neutral: '中立',
  },
  // GS GDAPI_REALMTYPE_*; the game's "PvP RP" written out.
  ruleset: {
    normal: '普通',
    pvp: 'PvP',
    roleplay: '角色扮演',
    roleplayPvp: '角色扮演PvP',
  },
  // GS OTHER, CATEGORY, SUBCATEGORY.
  category: {
    noClass: '其它',
    unknownClass: '分类{id}',
    unknownSub: '子类{id}',
  },
  // The game's slot names (GS INVTYPE_*): HOLDABLE "副手物品" tells the held item from the off hand weapon.
  slot: {
    head: '头部',
    neck: '颈部',
    shoulder: '肩部',
    shirt: '衬衣',
    chest: '胸部',
    waist: '腰部',
    legs: '腿部',
    feet: '脚',
    wrist: '手腕',
    hands: '手部',
    finger: '手指',
    trinket: '饰品',
    offHand: '副手',
    back: '背部',
    tabard: '公会徽章',
    heldInOffHand: '副手物品',
    relic: '圣物',
  },

  tools: {
    // Straight quotes on purpose: the search only understands " for an exact name.
    searchPlaceholder: '搜索拍卖行：名称，或"精确名称"',
    searchLabel: '搜索拍卖行',
    // The game's auction house search bar (GS AUCTION_HOUSE_SEARCH_BAR_FILTERS_LABEL "筛选").
    filters: '筛选',
    filtersOn: '筛选 · {count}',
    prices: '价格',
    // GS AUCTION_PRICE_PER_STACK "每组"; "每个" as AUCTION_HOUSE_PER_ITEM_LABEL "每个物品", shortened to pair with it.
    perUnit: '每个',
    perStack: '每组',
    pricesOf: '{time}的价格',
    notUpdated: '{age}，未更新',
    nextAround: '下次约{time}更新',
  },
  // GS MINUTES_ABBR "%d分钟", HOURS_ABBR "%d小时", DAYS_ABBR "%d天".
  age: {
    minutes: { other: '{count}分钟前' },
    hours: { other: '{count}小时前' },
    days: { other: '{count}天前' },
  },
  filters: {
    level: '等级{from}至{to}',
    from: '最低',
    to: '最高',
    quality: '质量',
    any: '全部',
    // GS ITEM_QUALITY0_DESC ... ITEM_QUALITY5_DESC.
    atLeast: {
      poor: '粗糙及以上',
      common: '普通及以上',
      uncommon: '优秀及以上',
      rare: '精良及以上',
      epic: '史诗及以上',
      legendary: '传说及以上',
    },
    lowestPrice: '最低价{from}至{to}',
    // Kept as g and s: the price field only reads g, s, c (shared/ah.ts), not the game's 金, 银, 铜.
    priceExample: '例：1g 50s',
    clear: '清除',
  },

  choose: {
    title: '选择拍卖行',
    intro: 'Twinmap显示你的角色出售物品的拍卖行价格。',
    told: '游戏显示，{who}所在的服务器类型为{ruleset}。',
    toldSide: '游戏显示，{who}所在的服务器类型为{ruleset}，阵营为{side}。',
    // GS REGION_ID "区域ID": "地区" is a zone.
    region: '区域',
    readFromGame: '（从游戏读取）',
    // The towns by their zhCN game names (AreaTable 35, 976, 2255).
    neutral: '中立拍卖行（藏宝海湾、加基森、永望镇）',
    note: '价格每小时从Blizzard获取一次。Twinmap为你的拍卖行下载约350KB数据，不会发送任何关于你的信息。',
    show: '显示价格',
    follow: '跟随我的角色',
    cancel: '取消',
  },
  errors: {
    noHouse: '这个拍卖行没有价格。',
    answered: 'prices.twinmap.app返回了{status}。',
    notPrices: 'prices.twinmap.app发送的不是价格数据。',
    unreachable: 'Twinmap无法连接到prices.twinmap.app。',
  },

  wait: {
    noPrices: '暂无价格',
    noEarlier: 'Twinmap没有这个拍卖行的历史价格可以显示。',
    worksAsBefore: 'Twinmap的其他功能照常运作。',
    again: '重试',
    getting: '正在获取价格',
    // {house} already starts with 拍卖行.
    of: '{house}，来源：prices.twinmap.app。',
  },

  nav: {
    yours: '我的',
    mine: '我的物品',
    alerts: '提醒',
    categories: '分类',
    all: '全部物品',
  },

  page: {
    back: '返回{place}',
    theSearch: '搜索结果',
    notOnSale: '此拍卖行目前没有出售。',
    // GS ITEM_MIN_LEVEL "需要等级 %d", ITEM_LEVEL "物品等级 %d", with the game's space.
    requiresLevel: '需要等级 {level}',
    itemLevel: '物品等级 {level}',
    lowest: '最低价',
    // Our choice: the median, "常见价", here and in browse and the chart.
    typical: '常见价',
    // GS AUCTION_HOUSE_BROWSE_HEADER_QUANTITY "可用".
    available: '可用',
    // What a vendor gives is the game's sell price (GS SELL_PRICE).
    vendorGives: '卖价',
    onSale: '当前在售，价格从低到高',
    // GS AUCTION_HOUSE_UNIT_PRICE_LABEL, AUCTION_HOUSE_QUANTITY_LABEL.
    priceEach: '单价',
    howMany: '数量',
    upToHere: '累计数量',
    costUpToHere: '累计花费',
    asAt: '这是拍卖行在{time}的状况。价格均为单价，当前在售情况可能有所不同。',
    youHave: '你拥有',
    have: '{count} · {who}，{place}',
    // Our choice: an item with no bonuses ("普通" is the Common quality).
    plain: '基础型',
    otherKind: '（{kind}）',
    none: '此拍卖行的任何角色都没有',
    // GS ROLL_DISENCHANT "分解".
    disenchant: '如果分解',
    expected: '预期',
    best: '最佳',
    notAllOnSale: '部分未在售',
    disenchantIt: '分解',
    sellIt: '拍卖',
    vendorIt: '卖给商人',
    draws: '{draws}，按{time}的最低价计算。',
    // "×" keeps the count off the name without a space.
    draw: '{item}×{count}（{chance}%）',
    alert: '提醒',
    // Reads with auction.when and the next line: "当最低价[低于]", then "[5]银".
    whenLowest: '当最低价{when}',
    silver: '{field}银',
    priceLabel: '价格（银）',
    now: '当前{price}',
    appearsNote: '在无货一小时后重新上架时。',
    // Our choice: "种类" for a kind of an item (its bonuses), here and in browse.kinds.
    kindOnly: '仅此种类（{kind}）',
    inGame: '同时在游戏中提醒我',
    alertSet: '提醒已设置。{see}',
    seeAlerts: '查看提醒',
    setAlert: '设置提醒',
    checked: 'Twinmap打开期间每小时检查一次。',
    playFirst: '要为角色设置提醒，请先开启插件并用该角色进行游戏。',
    findInGame: '在游戏中查找',
    // Straight quotes: this is what to type in the game's search for an exact name.
    quoted: '"{name}"',
    copy: '复制',
    copied: '已复制',
  },
  // After page.whenLowest "当最低价".
  when: {
    below: '低于',
    above: '高于',
    appears: '出现',
  },

  alerts: {
    item: '物品',
    whenLowest: '最低价条件',
    now: '当前',
    state: '状态',
    inGame: '游戏内',
    anyKind: '任意种类',
    below: '低于{price}',
    above: '高于{price}',
    notOnSale: '未在售',
    met: '{time}已触发',
    metAt: '{time}已触发，{price}',
    waiting: '等待中',
    sent: '已发送',
    // GS OFF "关".
    on: '开',
    off: '关',
    remove: '移除',
    none: '此拍卖行还没有提醒。打开一件物品，在其页面右侧设置提醒。',
    // "当前" and "注意" are the names of the tab Now and its part Attention (zh/app.ts).
    note: '提醒在每小时新价格到达时检查，仅限Twinmap打开期间。已触发的提醒会显示在这里和“当前”中的“注意”里；如果你选择，也会显示在游戏中。',
  },

  mine: {
    worthAh: '拍卖行价值',
    atVendor: '卖给商人',
    notOnSale: '当前未在售',
    items: { other: '{count}件物品' },
    where: '位置',
    everything: '全部',
    colItem: '物品',
    colWhere: '位置',
    colHowMany: '数量',
    colLowestEach: '最低单价',
    colAh: '拍卖行',
    colVendor: '商人',
    colBetter: '更划算',
    // The game's short "拍卖" (GS AUCTIONS).
    better: {
      ah: '拍卖',
      vendor: '商人',
    },
    notOnSaleRow: '未在售',
    none: '此拍卖行还没有角色。开启Twinmap Forever插件并登录一个角色，其背包物品就会显示在这里。',
    // The auction house cut as GS AUCTION_HOUSE_CUT_COLON "拍卖费"; the deposit as DEPOSIT_COLON "保管费".
    betterNote: '“更划算”已计入拍卖行收取的5%拍卖费，未计入保管费。',
    // One form; "区域" after {region} so EU and PvP never run together.
    guessed: {
      other: '{names}：按{region}区域、{ruleset}服务器计算，游戏尚未提供这项信息。',
    },
  },
  // GS BAGSLOT "背包", BANK "银行", EQUIPPED "已装备".
  place: {
    bags: '背包',
    bank: '银行',
    worn: '已装备',
  },
  held: {
    bags: '背包',
    bank: '银行',
    worn: '已装备',
  },

  browse: {
    name: '名称',
    lowest: '最低价',
    typical: '常见价',
    available: '可用',
    vendor: '商人',
    hours: '24小时',
    kinds: { other: '{count}种' },
    // Before the price: "低至1金".
    from: '低至',
    plainRow: '（基础型）',
    nothing: {
      typed: '没有符合“{typed}”的在售物品。',
      typedIn: '{category}中没有符合“{typed}”的在售物品。',
      filters: '没有符合这些筛选条件的在售物品。',
      filtersIn: '{category}中没有符合这些筛选条件的在售物品。',
    },
    more: '再显示{count}条（共{total}条）',
  },

  foot: {
    attribution: '{source}，通过Battle.net API获取。Twinmap与Blizzard无关联，也未获得其认可。',
    source: '拍卖数据：Blizzard Entertainment',
    approximate: '数量为近似值',
    hide: '隐藏此行',
  },

  chart: {
    label24h: '过去24小时的价格',
    label7d: '过去7天的价格',
    emptyHours: '这段时间尚未收集到价格',
    emptyDays: '这几天尚未收集到价格',
    pointHour: '{time}：常见价{typical}，最低价{lowest}，在售{count}件',
    pointDay: '{time}：常见价{typical}，最低价{lowest}，在售{count}件（各小时平均值）',
    today: '今天',
    // The game's coin names (GS GOLD_AMOUNT_SYMBOL, SILVER_AMOUNT_SYMBOL, COPPER_AMOUNT_SYMBOL).
    coin: {
      gold: '{amount}金',
      silver: '{amount}银',
      copper: '{amount}铜',
    },
    typical: '常见价（中位数）',
    lowest: '最低价',
    available: '可用',
    range: '图表范围',
    hours: '24小时',
    days: '7天',
    noteHours: '只绘制实际收集到的价格：每小时一个点。曲线会从这里开始延伸。',
    noteDays: '只绘制实际收集到的价格：每天一个点，取当天最低价和各小时平均值。曲线会从这里开始延伸。',
  },
}
