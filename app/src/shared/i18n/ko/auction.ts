// 한국어 경매장: the notes on every key are in en/auction.ts.
export default {
  unknownItem: '아이템 {id}',

  house: {
    line: '경매장 {number} · {side} · {ruleset}',
    // Our choice: the game names no "ruleset"; the realm list calls it the type (GS REALM_TYPE "종류").
    unknownRuleset: '서버 종류 {id}',
  },
  // GS FACTION_ALLIANCE, FACTION_HORDE, FACTION_NEUTRAL.
  side: {
    alliance: '얼라이언스',
    horde: '호드',
    neutral: '중립',
  },
  // GS GDAPI_REALMTYPE_*.
  ruleset: {
    normal: '일반',
    pvp: '전쟁',
    roleplay: '롤플레이',
    roleplayPvp: '전쟁 롤플레이',
  },
  category: {
    noClass: '기타',
    // Our choice: "직업" would read as a character class (GS CATEGORY, SUBCATEGORY).
    unknownClass: '범주 {id}',
    unknownSub: '하위 범주 {id}',
  },
  // The game's slot names (GlobalStrings INVTYPE_*): the game writes "보조장비" for both kinds of off hand.
  slot: {
    head: '머리',
    neck: '목',
    shoulder: '어깨',
    shirt: '속옷',
    chest: '가슴',
    waist: '허리',
    legs: '다리',
    feet: '발',
    wrist: '손목',
    hands: '손',
    finger: '손가락',
    trinket: '장신구',
    offHand: '보조장비',
    back: '등',
    tabard: '휘장',
    heldInOffHand: '보조장비',
    relic: '성물',
  },

  tools: {
    // Straight quotes on purpose: the search only understands " for an exact name.
    searchPlaceholder: '경매장 검색: 이름 또는 "정확한 이름"',
    searchLabel: '경매장 검색',
    filters: '필터',
    filtersOn: '필터 · {count}',
    prices: '가격',
    // GS AUCTION_PRICE_PER_ITEM "개당", AUCTION_PRICE_PER_STACK "묶음당".
    perUnit: '개당',
    perStack: '묶음당',
    pricesOf: '{time} 기준 가격',
    notUpdated: '{age}, 갱신되지 않음',
    nextAround: '다음 갱신 {time}경',
  },
  // GS MINUTES_ABBR "%d분", HOURS_ABBR "%d시간", DAYS_ABBR "%d일".
  age: {
    minutes: { other: '{count}분 전' },
    hours: { other: '{count}시간 전' },
    days: { other: '{count}일 전' },
  },
  filters: {
    level: '레벨 {from} ~ {to}',
    from: '최소',
    to: '최대',
    quality: '품질',
    any: '전체',
    // GS ITEM_QUALITY0_DESC ... ITEM_QUALITY5_DESC.
    atLeast: {
      poor: '하급 이상',
      common: '일반 이상',
      uncommon: '고급 이상',
      rare: '희귀 이상',
      epic: '영웅 이상',
      legendary: '전설 이상',
    },
    lowestPrice: '최저가 {from} ~ {to}',
    // Kept as g and s: the price field only reads g, s, c (shared/ah.ts), not the game's 골, 실, 코.
    priceExample: '예: 1g 50s',
    clear: '초기화',
  },

  choose: {
    title: '경매장 선택',
    intro: 'Twinmap은 캐릭터가 아이템을 판매하는 경매장의 가격을 표시합니다.',
    // Rewritten as a list after a colon, so no particle follows {who} or {ruleset}.
    told: '게임에서 읽은 정보: 캐릭터 {who}, {ruleset} 서버.',
    toldSide: '게임에서 읽은 정보: 캐릭터 {who}, {ruleset} 서버, {side}.',
    // The game writes "지역" for a Battle.net region too (GS REGION_ID "지역 ID").
    region: '지역',
    readFromGame: '(게임에서 읽음)',
    // The towns by their koKR game names (AreaTable 35, 976, 2255).
    neutral: '중립 경매장 (무법항, 가젯잔, 눈망루 마을)',
    note: '가격은 Blizzard에서 1시간마다 받아 옵니다. Twinmap은 이 경매장에 대해 약 350KB를 내려받으며, 플레이어에 관한 정보는 보내지 않습니다.',
    show: '가격 보기',
    follow: '내 캐릭터에 맞추기',
    cancel: '취소',
  },
  errors: {
    noHouse: '이 경매장의 가격이 없습니다.',
    // After a colon: no particle on the number.
    answered: 'prices.twinmap.app 응답: {status}.',
    notPrices: 'prices.twinmap.app에서 가격이 아닌 다른 데이터를 보냈습니다.',
    unreachable: 'Twinmap이 prices.twinmap.app에 연결할 수 없습니다.',
  },

  wait: {
    noPrices: '아직 가격 없음',
    noEarlier: 'Twinmap에 이 경매장의 이전 가격이 없습니다.',
    worksAsBefore: 'Twinmap의 다른 기능은 그대로 작동합니다.',
    again: '다시 시도',
    getting: '가격 불러오는 중',
    // Labels with colons, so {house} needs no particle.
    of: '대상: {house}, 출처: prices.twinmap.app.',
  },

  nav: {
    yours: '내 목록',
    mine: '내 아이템',
    // Our choice: "알림" for an alert, here and on the item's page.
    alerts: '알림',
    categories: '범주',
    all: '모든 아이템',
  },

  page: {
    // After a colon: no particle on {place}.
    back: '돌아가기: {place}',
    theSearch: '검색 결과',
    // GS ITEM_MIN_LEVEL "최소 요구 레벨 %d", ITEM_LEVEL "아이템 레벨 %d".
    requiresLevel: '최소 요구 레벨 {level}',
    itemLevel: '아이템 레벨 {level}',
    lowest: '최저가',
    typical: '보통 가격',
    // GS AUCTION_HOUSE_BROWSE_HEADER_QUANTITY "구매 가능 수량".
    available: '구매 가능 수량',
    // What a vendor gives is the game's sell price (GS SELL_PRICE).
    vendorGives: '판매 가격',
    onSale: '현재 판매 중, 낮은 가격순',
    // GS AUCTION_HOUSE_UNIT_PRICE_LABEL, AUCTION_HOUSE_QUANTITY_LABEL.
    priceEach: '개당 가격',
    howMany: '수량',
    upToHere: '누적 수량',
    costUpToHere: '누적 금액',
    asAt: '{time} 기준 경매장 상태입니다. 가격은 개당 가격이며, 지금 판매 중인 물품과 다를 수 있습니다.',
    youHave: '보유 중',
    have: '{count} · {who}, {place}',
    // Our choice: an item with no bonuses.
    plain: '기본형',
    otherKind: '({kind})',
    none: '이 경매장의 어느 캐릭터에도 없음',
    // GS ROLL_DISENCHANT "마력 추출".
    disenchant: '마력 추출 시',
    expected: '예상',
    best: '최선',
    notAllOnSale: '일부 판매 없음',
    disenchantIt: '마력 추출',
    sellIt: '경매장 판매',
    vendorIt: '상인 판매',
    draws: '{draws}, {time} 최저가 기준.',
    draw: '{item} {count} ({chance}%)',
    alert: '알림',
    // Reads with auction.when and the next line: "최저가가 [기준 가격보다 낮아질 때]", then "기준 가격: [5] 실버".
    // Korean puts the verb last, so the price moves to its own labelled line.
    whenLowest: '최저가가 {when}',
    silver: '기준 가격: {field} 실버',
    priceLabel: '가격 (실버)',
    now: '현재 {price}',
    appearsNote: '판매 물품이 없는 1시간이 지난 뒤 다시 판매될 때.',
    // Our choice: "종류" for a kind of an item (its bonuses), here and in browse.kinds.
    kindOnly: '이 종류만 ({kind})',
    inGame: '게임에서도 알림',
    alertSet: '알림을 설정했습니다. {see}',
    seeAlerts: '알림 보기',
    setAlert: '알림 설정',
    checked: 'Twinmap이 열려 있는 동안 1시간마다 확인합니다.',
    playFirst: '알림을 설정하려면 애드온을 켠 상태로 캐릭터로 접속하십시오.',
    findInGame: '게임에서 찾기',
    // Straight quotes: this is what to type in the game's search for an exact name.
    quoted: '"{name}"',
    copy: '복사',
    copied: '복사됨',
  },
  // After page.whenLowest "최저가가": the price is "기준 가격", typed on the next line.
  when: {
    below: '기준 가격보다 낮아질 때',
    above: '기준 가격보다 높아질 때',
    appears: '다시 나타날 때',
  },

  alerts: {
    item: '아이템',
    // The column reads with its cells: "최저가 조건 | 1골보다 낮아질 때".
    whenLowest: '최저가 조건',
    now: '현재',
    state: '상태',
    inGame: '게임 알림',
    anyKind: '모든 종류',
    // "보다" does not change with the last syllable.
    below: '{price}보다 낮아질 때',
    above: '{price}보다 높아질 때',
    notOnSale: '판매 없음',
    met: '{time}에 충족',
    metAt: '{time}에 충족, {price}',
    waiting: '대기 중',
    sent: '전송됨',
    on: '켜짐',
    off: '꺼짐',
    remove: '삭제',
    none: '이 경매장에 설정한 알림이 아직 없습니다. 아이템을 열고 페이지 오른쪽에서 알림을 설정하십시오.',
    // "지금" and "주의" must match the names of the tab Now and its part Attention (ko/app.ts), in quotes.
    note: '알림은 새 가격이 들어오는 1시간마다, Twinmap이 열려 있는 동안에만 확인합니다. 조건이 충족된 알림은 여기와 "현재" 탭의 "주의" 항목에 표시되며, 원하면 게임에도 표시됩니다.',
  },

  mine: {
    worthAh: '경매장 가치',
    atVendor: '상인 판매가',
    notOnSale: '현재 판매 없음',
    items: { other: '아이템 {count}개' },
    where: '위치',
    everything: '전체',
    colItem: '아이템',
    colWhere: '위치',
    colHowMany: '수량',
    colLowestEach: '개당 최저가',
    colAh: '경매장',
    colVendor: '상인',
    colBetter: '유리한 쪽',
    // No short form for the auction house in Korean: the game's short "경매" (GS AUCTIONS).
    better: {
      ah: '경매',
      vendor: '상인',
    },
    notOnSaleRow: '판매 없음',
    none: '이 경매장의 캐릭터가 아직 없습니다. Twinmap Forever 애드온을 켜고 캐릭터로 접속하면 가방 내용이 여기에 표시됩니다.',
    // "보증금", the game's deposit at the auction house (GS DEPOSIT_COLON); "수수료" as GS AUCTION_HOUSE_CUT_COLON.
    betterNote: '"유리한 쪽"은 경매장이 가져가는 5% 수수료를 계산에 넣으며, 보증금은 넣지 않습니다.',
    // One form; {names} before a colon and {ruleset} before "서버", so no particle follows a name.
    guessed: {
      other: '{names}: {region} 지역, {ruleset} 서버로 간주합니다. 게임에서 아직 이 정보를 받지 못했습니다.',
    },
  },
  // GS BAGSLOT, BANK, CURRENTLY_EQUIPPED "착용 중인 아이템".
  place: {
    bags: '가방',
    bank: '은행',
    worn: '착용 중',
  },
  held: {
    bags: '가방',
    bank: '은행',
    worn: '착용 중',
  },

  browse: {
    name: '이름',
    lowest: '최저가',
    typical: '보통 가격',
    available: '구매 가능 수량',
    vendor: '상인',
    hours: '24시간',
    kinds: { other: '{count}종' },
    from: '최소',
    plainRow: '(기본형)',
    // "에" after the closing quote does not change; {category} after a colon.
    nothing: {
      typed: '"{typed}"에 맞는 판매 물품이 없습니다.',
      typedIn: '"{typed}"에 맞는 판매 물품이 없습니다. 범주: {category}.',
      filters: '이 필터에 맞는 판매 물품이 없습니다.',
      filtersIn: '이 필터에 맞는 판매 물품이 없습니다. 범주: {category}.',
    },
    more: '{total}개 중 {count}개 더 보기',
  },

  foot: {
    attribution: '{source}, Battle.net API 제공. Twinmap은 Blizzard와 제휴하거나 Blizzard의 보증을 받지 않았습니다.',
    source: '경매 데이터: Blizzard Entertainment',
    approximate: '수량은 근삿값',
  },

  chart: {
    label24h: '최근 24시간 가격',
    label7d: '최근 7일 가격',
    emptyHours: '이 시간대에는 아직 수집된 가격 없음',
    emptyDays: '이 날짜에는 아직 수집된 가격 없음',
    pointHour: '{time}: 보통 {typical}, 최저 {lowest}, 판매 중 {count}개',
    pointDay: '{time}: 보통 {typical}, 최저 {lowest}, 판매 중 {count}개 (시간별 평균)',
    today: '오늘',
    // The game's coin letters (GS GOLD_AMOUNT_SYMBOL, SILVER_AMOUNT_SYMBOL, COPPER_AMOUNT_SYMBOL).
    coin: {
      gold: '{amount}골',
      silver: '{amount}실',
      copper: '{amount}코',
    },
    typical: '보통 가격 (중앙값)',
    lowest: '최저가',
    available: '구매 가능 수량',
    range: '차트 기간',
    hours: '24시간',
    days: '7일',
    noteHours: '실제로 수집한 가격만 표시합니다: 1시간에 한 점. 선은 여기서부터 이어집니다.',
    noteDays: '실제로 수집한 가격만 표시합니다: 하루에 한 점, 그날의 최저가와 시간별 평균. 선은 여기서부터 이어집니다.',
  },
}
