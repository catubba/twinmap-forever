// 한국어 아이템: the notes on every key are in en/items.ts.
export default {
  unknownItem: '아이템 {id}',
  // GS SPELLS.
  unknownSpell: '주문 {id}',

  // "방금 전" rather than "방금", so it reads after "최종 접속" and before "기준" like the others.
  ago: {
    justNow: '방금 전',
    minutes: { other: '{count}분 전' },
    hours: { other: '{count}시간 전' },
    days: { other: '{count}일 전' },
    weeks: { other: '{count}주 전' },
  },

  places: {
    bags: '가방',
    bank: '은행',
    // GS CURRENTLY_EQUIPPED.
    worn: '착용 중',
    // GS KEYRING.
    keyring: '열쇠고리',
  },

  types: {
    weaponOf: '무기 · {kind}',
    armorOf: '방어구 · {kind}',
    // GS OTHER.
    unknown: '기타',
    // ItemClass koKR; gem and item enhancement from GS AUCTION_CATEGORY_*, money GS MONEY, permanent ItemSubClass 0.6.
    classes: {
      consumable: '소비 용품',
      container: '가방',
      weapon: '무기',
      gem: '보석',
      armor: '방어구',
      reagent: '재료',
      projectile: '투사체',
      tradeGoods: '직업 용품',
      itemEnhancement: '아이템 강화',
      recipe: '제조법',
      money: '돈',
      quiver: '화살통',
      quest: '퀘스트',
      key: '열쇠',
      permanent: '영구',
      miscellaneous: '기타',
    },
    // ItemSubClass 2.x DisplayName koKR. Polearm: Forever's row says "장창류", the verbose form; the short "장창" as retail and the other rows.
    weapons: {
      axe: '도끼',
      bow: '활',
      gun: '총',
      mace: '둔기',
      polearm: '장창류',
      sword: '도검',
      warglaive: '전투검',
      staff: '지팡이',
      // ItemSubClass 2.11 and 2.12.
      exotic: '특수 무기',
      fistWeapon: '장착 무기',
      miscellaneous: '기타',
      dagger: '단검',
      thrown: '투척 무기',
      spear: '창',
      crossbow: '석궁',
      wand: '마법봉',
      fishingPole: '낚싯대',
    },
    // ItemSubClass 4.x DisplayName koKR; sigil (4.10) is not in Forever's table: the retail name. Relic: GS INVTYPE_RELIC.
    armors: {
      miscellaneous: '기타',
      cloth: '천',
      leather: '가죽',
      mail: '사슬',
      plate: '판금',
      cosmetic: '장식',
      shield: '방패',
      libram: '성서',
      idol: '우상',
      totem: '토템',
      sigil: '인장',
      relic: '성물',
    },
  },

  // The game's slot names (GS HEADSLOT ... RANGEDSLOT).
  slots: {
    head: '머리',
    neck: '목',
    shoulder: '어깨',
    back: '등',
    chest: '가슴',
    shirt: '속옷',
    tabard: '겉옷',
    wrist: '손목',
    hands: '손',
    waist: '허리',
    legs: '다리',
    feet: '발',
    // GS FINGER0SLOT: the game names the slot, not the ring.
    ring: '손가락',
    trinket: '장신구',
    mainHand: '주장비',
    offHand: '보조장비',
    // GS RANGEDSLOT "원거리 장비" without "장비", to fit 44px.
    ranged: '원거리',
  },

  // GS PLAYER_LEVEL_NO_SPEC_WITH_RACE.
  character: {
    line: '{level} 레벨 {race} {class}',
    kind: '{race} {class}',
  },
  // ChrRaces koKR.
  races: {
    human: '인간',
    orc: '오크',
    dwarf: '드워프',
    nightElf: '나이트 엘프',
    undead: '언데드',
    tauren: '타우렌',
    gnome: '노움',
    troll: '트롤',
  },
  // ChrClasses koKR.
  classes: {
    warrior: '전사',
    paladin: '성기사',
    hunter: '사냥꾼',
    rogue: '도적',
    priest: '사제',
    shaman: '주술사',
    mage: '마법사',
    warlock: '흑마법사',
    druid: '드루이드',
  },
  // No plural in Korean: the same names, followed by the invariant particle "만" in npc.teaches.
  classesAll: {
    warrior: '전사',
    paladin: '성기사',
    hunter: '사냥꾼',
    rogue: '도적',
    priest: '사제',
    shaman: '주술사',
    mage: '마법사',
    warlock: '흑마법사',
    druid: '드루이드',
  },

  page: {
    noCharacter: '아직 캐릭터가 없습니다. Twinmap Forever 애드온을 켜고 플레이하면 게임을 종료한 뒤에도 가방이 여기에 표시됩니다.',
    // GS TYPE "종류".
    filter: '이름 또는 종류로 필터',
    filterLabel: '아이템 필터',
    whereLabel: '위치',
    all: '전체',
    // Each part as "label: amount", like the game's "돈:" (GS MONEY_COLON) and GS SELL_PRICE.
    worth: '판매 가격: {money}',
    auction: '경매장: {money}',
    money: '돈: {money}',
  },

  doll: {
    label: '착용 중',
    // GS CHARACTER_BUTTON "캐릭터 정보".
    open: '게임에서 캐릭터 정보 창을 여십시오',
    keyHint: '단축키를 바꾸지 않았다면 {key}',
    waitNote: '창이 열려 있고 캐릭터를 가리는 것이 없으면 바로 사진을 찍습니다.',
    cancel: '취소',
    save: '저장…',
    retake: '다시 찍기',
    taken: '촬영: {ago}',
    // "의" does not change with the name's last syllable.
    none: '{name}의 사진이 아직 없습니다',
    noneNote: '게임에서 캐릭터 정보 창을 열면 사진이 자동으로 찍힙니다.',
  },

  held: {
    bags: '가방',
    bagsNow: '현재 상태',
    bagsAsOf: '{ago} 기준',
    bank: '은행',
    bankSeen: '{ago} 확인',
    // GS BAG_NAME_BACKPACK "배낭"; ItemSubClass 1.11 "재료 가방"; GS KEYRING.
    backpack: '배낭과 가방',
    reagents: '재료 가방',
    keyring: '열쇠고리',
    bankBags: '은행과 은행 가방',
    used: '{count}칸 중 {used}칸 사용',
    // GS CONTAINER_SLOTS "%d칸".
    empty: { other: '비어 있음 · {count}칸' },
  },

  bank: {
    none: '아직 은행을 열어 보지 않았습니다',
    open: '게임에서 은행을 한 번 여십시오. 게임을 종료한 뒤에도 은행에 있는 물건이 여기에 표시됩니다.',
    where: '아무 수도에서나 은행원에게 말을 거십시오.',
  },

  table: {
    columns: {
      item: '아이템',
      character: '캐릭터',
      type: '종류',
      where: '위치',
      qty: '수량',
      value: '가격',
      auction: '경매장',
    },
    // The name before a colon, the typed text before a noun: no particle after either.
    nothingLike: '{name}: "{typed}" 검색 결과가 없습니다.',
    nothing: '아무것도 없습니다.',
    bagsNow: '가방: 현재 상태',
    bagsAsOf: '가방: {ago} 기준',
    bankSeen: '은행: {ago} 마지막으로 확인',
    bankUnseen: '은행을 아직 열어 보지 않았습니다: 게임에서 한 번 여십시오',
  },

  others: {
    title: '다른 캐릭터',
    where: '이 PC에 저장됨',
    show: '{name} 보기',
    // GS LASTONLINE "최종 접속".
    seen: '{name}: 최종 접속 {ago}',
  },

  popup: {
    sellPrice: '판매 가격: {price}',
    auction: '경매장: {price}',
    // GS AUCTION_PRICE_PER_ITEM "개당".
    each: '(개당 {price})',
    notOnSale: '경매장: 판매 중인 물품 없음',
    // After a first name, with no particle: "Catubbio 착용 중, 가방에 3개".
    wears: '착용 중',
    inBags: '가방에 {count}개',
    inBank: '은행에 {count}개',
    noneHeld: '이 아이템을 가진 캐릭터가 없습니다',
    // The NPC after a colon, like "상인: {npc}" in the glossary.
    soldBy: '상인: {npc}',
    soldByIn: '상인: {npc}, {zone}',
    perPack: '{count}개당 {price}',
    moreVendors: { other: '외 상인 {count}명' },
    // Like the game's "우두머리 전리품: %s" (GS WARDROBE_TOOLTIP_BOSS_DROP_FORMAT).
    dropsFrom: '전리품: {npc}',
    dropsFromIn: '전리품: {npc}, {zone}',
    moreDrops: { other: '외 {count}마리' },
    // The object after a colon, like the lines above.
    foundIn: '발견 장소: {object}',
    foundInIn: '발견 장소: {object}, {zone}',
  },

  npc: {
    sells: '판매 {count}개',
    subSells: '{sub} · 판매 {count}개',
    notLearned: '아직 배우지 않음: {profession}',
    // "만" does not change with the name's last syllable.
    teaches: '{classes}만 가르칩니다.',
    teachesPick: '{classes}만 가르칩니다. 배울 수 있는 기술을 보려면 캐릭터를 선택하십시오.',
    learnNow: '배울 수 있음 · {count}',
    // GS UNIT_LEVEL_TEMPLATE.
    atLevel: '레벨 {level}',
    // The profession's skill points.
    atSkill: '숙련도 {skill}',
    // GS TRADESKILL_NEXT_RANK_HEADER.
    nextRank: '다음 등급',
    sellsHeading: '판매 · {count}',
    // A spell's rank as the game writes it (Spell NameSubtext_lang "1 레벨").
    rank: '{rank} 레벨',
    nextNeeds: '숙련도 {skill}, 레벨 {level}',
    talent: '특성',
    quest: '퀘스트',
    questTaught: '퀘스트 보상: {quest}',
    classQuest: '직업 퀘스트 보상',
    columns: {
      item: '아이템',
      price: '가격',
      // GS BUTTON_LAG_AUCTIONHOUSE "경매", short for a narrow column.
      ah: '경매',
      bags: '가방',
      bank: '은행',
    },
    ahNote: '경매장 최저가 (같은 수량 기준)',
    ahPrice: '경매 {price}',
    // GS USED "이미 습득".
    known: '이미 습득 · {count}',
    show: '표시',
    hide: '숨기기',
    noCharacter: '아직 캐릭터가 없습니다. Twinmap Forever 애드온을 켜고 플레이하십시오.',
    // The profession as a label before a colon.
    recipesRead: '{name} · {profession}: 창을 마지막으로 열었을 때의 제조법',
    recipesUnread: '{name} · {profession}: 배운 제조법을 보려면 게임에서 창을 한 번 여십시오',
    // {level} can be "?": "레벨 ?" reads.
    spellsNow: '{name}, 레벨 {level} · 현재 주문',
    spellsAsOf: '{name}, 레벨 {level} · {ago} 기준 주문',
    bankSeen: '은행: {ago} 확인 · {name}',
    bankUnseen: '은행을 아직 열어 보지 않았습니다: 게임에서 한 번 여십시오 · {name}',
  },

  picker: {
    inGame: '접속 중',
    seen: '최종 접속 {ago}',
    list: '캐릭터',
    forget: '삭제',
    note: '플레이하는 동안 애드온이 알려 준 정보로 이 컴퓨터에 저장됩니다. 캐릭터를 오른쪽 클릭하면 삭제할 수 있습니다.',
  },

  resize: '끌어서 크기 조절',
}
