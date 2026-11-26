// 简体中文 物品: the notes on every key are in en/items.ts.
export default {
  unknownItem: '物品{id}',
  // GS SPELLS.
  unknownSpell: '法术{id}',

  // As the game's GS LASTONLINE_DAYS "%d天前".
  ago: {
    justNow: '刚刚',
    minutes: { other: '{count}分钟前' },
    hours: { other: '{count}小时前' },
    days: { other: '{count}天前' },
    weeks: { other: '{count}周前' },
  },

  places: {
    // GS BAGSLOT.
    bags: '背包',
    bank: '银行',
    // GS EQUIPPED.
    worn: '已装备',
    // GS KEYRING.
    keyring: '钥匙链',
  },

  types: {
    weaponOf: '武器 · {kind}',
    armorOf: '护甲 · {kind}',
    // GS OTHER.
    unknown: '其它',
    // ItemClass zhCN; gem and item enhancement from GS AUCTION_CATEGORY_*, money GS MONEY_COLON "金钱：", permanent ItemSubClass 14.0.
    classes: {
      consumable: '消耗品',
      container: '容器',
      weapon: '武器',
      gem: '宝石',
      armor: '护甲',
      reagent: '材料',
      projectile: '弹药',
      tradeGoods: '商品',
      itemEnhancement: '物品附魔',
      recipe: '配方',
      money: '金钱',
      quiver: '箭袋',
      quest: '任务',
      key: '钥匙',
      permanent: '永久',
      miscellaneous: '其它',
    },
    // ItemSubClass 2.x DisplayName zhCN.
    weapons: {
      axe: '斧',
      bow: '弓',
      gun: '枪械',
      mace: '锤',
      polearm: '长柄武器',
      sword: '剑',
      warglaive: '战刃',
      staff: '法杖',
      // ItemSubClass 2.11 and 2.12.
      exotic: '异种武器',
      fistWeapon: '拳套',
      miscellaneous: '其它',
      dagger: '匕首',
      thrown: '投掷武器',
      spear: '矛',
      crossbow: '弩',
      wand: '魔杖',
      fishingPole: '鱼竿',
    },
    // ItemSubClass 4.x DisplayName zhCN; sigil (4.10) is not in Forever's table: the retail name. Relic: GS INVTYPE_RELIC.
    armors: {
      miscellaneous: '其它',
      cloth: '布甲',
      leather: '皮甲',
      mail: '锁甲',
      plate: '板甲',
      cosmetic: '装饰品',
      shield: '盾牌',
      libram: '圣契',
      idol: '神像',
      totem: '图腾',
      sigil: '魔印',
      relic: '圣物',
    },
  },

  // The game's slot names (GS HEADSLOT ... RANGEDSLOT); "公会徽章" is the longest, about 40px at 9.5px.
  slots: {
    head: '头部',
    neck: '颈部',
    shoulder: '肩部',
    back: '背部',
    chest: '胸部',
    shirt: '衬衣',
    tabard: '公会徽章',
    wrist: '手腕',
    hands: '手部',
    waist: '腰部',
    legs: '腿部',
    feet: '脚',
    // GS FINGER0SLOT: the game names the slot, not the ring.
    ring: '手指',
    trinket: '饰品',
    mainHand: '主手',
    offHand: '副手',
    ranged: '远程',
  },

  // GS PLAYER_LEVEL_NO_SPEC_WITH_RACE: no space between race and class.
  character: {
    line: '等级 {level} {race}{class}',
    kind: '{race}{class}',
  },
  // ChrRaces zhCN.
  races: {
    human: '人类',
    orc: '兽人',
    dwarf: '矮人',
    nightElf: '暗夜精灵',
    undead: '亡灵',
    tauren: '牛头人',
    gnome: '侏儒',
    troll: '巨魔',
  },
  // ChrClasses zhCN.
  classes: {
    warrior: '战士',
    paladin: '圣骑士',
    hunter: '猎人',
    rogue: '潜行者',
    priest: '牧师',
    shaman: '萨满祭司',
    mage: '法师',
    warlock: '术士',
    druid: '德鲁伊',
  },
  // No plural in Chinese: the same names.
  classesAll: {
    warrior: '战士',
    paladin: '圣骑士',
    hunter: '猎人',
    rogue: '潜行者',
    priest: '牧师',
    shaman: '萨满祭司',
    mage: '法师',
    warlock: '术士',
    druid: '德鲁伊',
  },

  page: {
    noCharacter: '还没有角色。开启Twinmap Forever插件进行游戏，背包就会显示在这里，关闭游戏后也能查看。',
    // GS TYPE "类型".
    filter: '按名称或类型过滤',
    filterLabel: '过滤物品',
    whereLabel: '位置',
    all: '全部',
    // Each part as "label：amount", like GS SELL_PRICE "卖价" and GS MONEY_COLON "金钱：".
    worth: '卖价：{money}',
    auction: '拍卖行：{money}',
    money: '金钱：{money}',
  },

  doll: {
    label: '已装备',
    // GS CHARACTER_BUTTON "角色信息".
    open: '在游戏中打开角色信息窗口',
    keyHint: '按{key}键，除非你改过按键设置',
    waitNote: '窗口打开且角色没有被遮挡时，就会立即截图。',
    cancel: '取消',
    save: '保存…',
    retake: '重新截图',
    taken: '{ago}截图',
    none: '还没有{name}的截图',
    noneNote: '在游戏中打开角色信息窗口，就会自动截图。',
  },

  held: {
    bags: '背包',
    bagsNow: '当前状态',
    bagsAsOf: '{ago}的状态',
    bank: '银行',
    bankSeen: '{ago}查看',
    // GS BAG_NAME_BACKPACK "行囊"; ItemSubClass 1.11 "材料包"; GS KEYRING.
    backpack: '行囊和背包',
    reagents: '材料包',
    keyring: '钥匙链',
    bankBags: '银行和银行背包',
    // GS CONTAINER_SLOTS "%d格".
    used: '已用{used}/{count}格',
    // GS EMPTY "空".
    empty: { other: '空 · {count}格' },
  },

  bank: {
    none: '尚未查看银行',
    open: '在游戏中打开一次银行，其中的物品就会显示在这里，关闭游戏后也能查看。',
    where: '与任意主城的银行职员交谈。',
  },

  professions: {
    primary: '专业',
    secondary: '辅助技能',
    filter: '筛选配方',
    known: '已学会',
    unknown: '未学会',
    unknownNote: '数字：配方变为黄色时的技能等级。',
    optimal: '橙色：必定提升',
    medium: '黄色：可能提升',
    easy: '绿色：很少提升',
    trivial: '灰色：不再提升',
    noMatch: '没有符合的配方。',
    none: '尚无专业',
    learn: '在任意城市找专业训练师学习，其等级和配方会显示在这里。',
    also: '烹饪、急救和钓鱼也算在内。',
    unseen: '尚未查看配方',
    open: '在游戏中打开一次{profession}窗口，其配方就会显示在这里，关闭游戏后也能查看。',
    again: '在游戏中再打开一次{profession}窗口，其分类和未学会的配方也会显示在这里。',
    gathers: '{profession}没有配方，只显示等级。',
  },

  spellbook: {
    filter: '筛选法术',
    passive: '被动',
    noMatch: '没有符合的法术。',
    none: '尚无法术书',
    login: '使用最新版的Twinmap插件登录游戏，法术书中的法术就会显示在这里，关闭游戏后也能查看。',
  },

  talents: {
    spent: { other: '已用 {count} 点' },
    free: '剩余天赋点数：{count}',
    rank: '等级 {rank}/{most}',
    next: '下一等级：',
    need: { other: '在{tree}天赋中再分配{count}点' },
    none: '还没有天赋',
    learn: '天赋从10级开始，之后每升一级获得一点。在游戏的天赋窗口中分配后，会显示在这里。',
  },

  table: {
    columns: {
      item: '物品',
      character: '角色',
      type: '类型',
      where: '位置',
      qty: '数量',
      // GS SELL_PRICE.
      value: '卖价',
      auction: '拍卖行',
    },
    nothingLike: '{name}没有与“{typed}”相符的物品。',
    nothing: '这里什么都没有。',
    bagsNow: '背包：当前状态',
    bagsAsOf: '背包：{ago}的状态',
    bankSeen: '银行：{ago}最后一次打开',
    bankUnseen: '银行：尚未查看，在游戏中打开一次',
  },

  others: {
    title: '其他角色',
    where: '保存在这台电脑上',
    show: '显示{name}',
    // GS LASTONLINE "最后上线".
    seen: '{name}：最后上线{ago}',
  },

  popup: {
    sellPrice: '卖价：{price}',
    auction: '拍卖行：{price}',
    // GS AUCTION_PRICE_PER_ITEM "每个单位", shortened.
    each: '（每个{price}）',
    notOnSale: '拍卖行：无人出售',
    // After a first name: "Catubbio装备着，背包里有3个".
    wears: '装备着',
    inBags: '背包里有{count}个',
    inBank: '银行里有{count}个',
    noneHeld: '你的角色都没有这件物品',
    // The NPC after a colon, like GS MERCHANT "商人".
    soldBy: '商人：{npc}',
    soldByIn: '商人：{npc}，{zone}',
    perPack: '{price}（{count}个）',
    moreVendors: { other: '另有{count}名商人' },
    // Like GS WARDROBE_TOOLTIP_BOSS_DROP_FORMAT "首领掉落：%s".
    dropsFrom: '掉落：{npc}',
    dropsFromIn: '掉落：{npc}，{zone}',
    moreDrops: { other: '另有{count}个' },
    foundIn: '发现于：{object}',
    foundInIn: '发现于：{object}，{zone}',
  },

  npc: {
    sells: '出售{count}件',
    subSells: '{sub} · 出售{count}件',
    notLearned: '尚未学会{profession}',
    teaches: '只训练{classes}。',
    teachesPick: '只训练{classes}：选择一个角色，查看可以学习的技能。',
    learnNow: '现在可学 · {count}',
    // GS UNIT_LEVEL_TEMPLATE.
    atLevel: '等级 {level}',
    // The profession's skill points, spaced like the level.
    atSkill: '技能等级 {skill}',
    // GS TRADESKILL_NEXT_RANK_HEADER.
    nextRank: '下一级',
    sellsHeading: '出售 · {count}',
    // A spell's rank as the game writes it ("等级 1").
    rank: '等级 {rank}',
    nextNeeds: '技能等级 {skill}，等级 {level}',
    talent: '天赋',
    quest: '任务',
    questTaught: '任务奖励：{quest}',
    classQuest: '职业任务奖励',
    columns: {
      item: '物品',
      price: '价格',
      // GS BUTTON_LAG_AUCTIONHOUSE "拍卖行" without "行", for a narrow column.
      ah: '拍卖',
      bags: '背包',
      bank: '银行',
    },
    ahNote: '拍卖行的最低价（相同数量）',
    ahPrice: '拍卖：{price}',
    // GS ALREADY_LEARNED.
    known: '已经学会 · {count}',
    show: '显示',
    hide: '隐藏',
    noCharacter: '还没有角色：开启Twinmap Forever插件进行游戏。',
    recipesRead: '{name} · 最后一次打开{profession}窗口时的配方',
    recipesUnread: '{name} · 在游戏中打开一次{profession}窗口，即可查看已学会的配方',
    spellsNow: '{name}，等级 {level} · 当前的法术',
    spellsAsOf: '{name}，等级 {level} · {ago}的法术',
    bankSeen: '银行：{ago}查看 · {name}',
    bankUnseen: '银行尚未查看：在游戏中打开一次 · {name}',
  },

  // The shopping list (M10-F4): en/items.ts says where each text shows.
  shopping: {
    title: '购物清单',
    forWho: '{name}的清单',
    making: '制作 · {count}',
    makeFirst: '先制作 · {count}',
    missing: '缺少 · {count}',
    ready: '已备齐 · {count}',
    toBuy: '需购买 {price}',
    youKnow: '{profession} · 已学会',
    needs: '需要{profession} {skill}，当前 {have}',
    notKnown: '{profession} · 未学会',
    unread: '{profession} · 在游戏中打开一次该窗口',
    takes: '每次{items}',
    takesFor: '每{count}个需{items}',
    amount: '{item}×{count}',
    toLearn: '{profession} {skill}可学',
    make: '制作{count}个',
    of: '缺{missing}/{count}',
    folded: { other: '缺少{count}项' },
    foldedNone: '材料已全部备齐',
    fold: '折叠购物清单',
    unfold: '展开购物清单',
    fewer: '减少一个',
    more: '增加一个',
    add: '加入购物清单：{item}',
  },

  picker: {
    inGame: '游戏中',
    // GS LASTONLINE "最后上线".
    seen: '最后上线{ago}',
    list: '角色',
    // GS REMOVE.
    forget: '移除',
    note: '根据你游戏时插件提供的信息，保存在这台电脑上。右键点击一个角色即可将其移除。',
  },

  resize: '拖动以调整列宽',
}
