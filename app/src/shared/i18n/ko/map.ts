// 한국어 지도: the notes on every key are in en/map.ts.
export default {
  layers: {
    button: '필터',
    buttonTip: '필터 (L)',
    menu: '지도 필터',
    // Group after a colon: a particle after {group} would change with its last syllable.
    hideAll: '모두 숨기기: {group}',
    showAll: '모두 표시: {group}',
    kinds: '종류: {layer}',
    hideGrey: '회색 숨기기',
    hideGreyTip: '더 이상 숙련도가 오르지 않는 것 숨기기',
    skill: '숙련도 {skill}',
    notLearned: '배우지 않음',
    skillUnread: '숙련도를 아직 읽지 않음',
    groups: {
      // The character, never "당신" or "나".
      you: '캐릭터',
      quests: '퀘스트',
      // Town services: the everyday word, the game has no heading for them.
      services: '편의 시설',
      // Ore and herbs: what gathering professions collect, as the game's "채집".
      resources: '채집',
      world: '세계',
      group: '파티',
    },
    // Service layers follow the game's minimap tracking menu (glossary), so the NPC, not the place.
    names: {
      arrow: '화살표',
      route: '경로',
      mypins: '내 핀',
      death: '시체 및 무덤',
      // Under the heading 퀘스트, as the game's AVAILABLE_QUESTS.
      available: '가능한 퀘스트',
      // The game's map legend for quests to hand in.
      turnin: '완료',
      objectives: '임무',
      lowlevel: '저레벨 퀘스트',
      flight: '비행 조련사',
      inn: '여관주인',
      vendors: '상인',
      repair: '장비 수리',
      trainers: '상급자',
      bank: '은행원',
      auction: '경매인',
      stable: '야수 관리인',
      ore: '광물',
      herbs: '약초',
      zones: '지명',
      relief: '지형',
      levels: '지역 레벨',
      caves: '동굴',
      dungeons: '던전',
      routes: '비행 경로',
      vessels: '배와 비행선',
      bosses: '던전 우두머리',
      companions: '파티',
    },
  },

  continents: {
    easternKingdoms: '동부 왕국',
    kalimdor: '칼림도어',
  },

  corner: {
    // Place after a colon, so no particle follows the name.
    back: '뒤로: {place}',
    view3d: '3D 보기',
    view3dTip: '2D 또는 3D 보기 (3)',
    turn: '캐릭터에 맞춰 회전',
    turnTip: '캐릭터에 맞춰 회전 (N)',
    northUpTip: '북쪽을 위로 (N)',
    // Floors of a dungeon: "층", since "레벨" is the character's level.
    levels: '층',
    levelsShown: '표시된 층',
    everyRoom: '모든 방',
    roomsUpTo: '{level}층까지의 방',
    parts: '구역',
    partTip: '{part}구역',
    route: '경로',
    routeTip: '일반적인 진행 경로, 우두머리 순서대로',
    routeRoughTip: '일반적인 진행 경로, 우두머리 순서대로: 대략적, 공략 기준',
    zoomIn: '확대',
    zoomInTip: '확대 (+)',
    zoomOut: '축소',
    zoomOutTip: '축소 (-)',
    // The map follows the character: "따라가기", keeping "추적" for the game's arrow on a point.
    follow: '따라가기',
    followTip: '캐릭터 따라가기 (F)',
    dungeonsOff: '3D 던전이 꺼져 있습니다',
    dungeonsOffText: "3D 던전은 실험적 기능입니다. 이 던전을 3D로 보려면 설정에서 '3D 던전 (실험적)'을 켜세요.",
    dungeonsOpen: '설정 열기',
    dungeonsLater: '나중에',
  },

  offMap: '이곳은 지도에 없습니다.',
  fps: '{fps} FPS',
  nothingToSend: '보낼 것이 없습니다.',

  pins: {
    rewardXp: '경험치 {xp}',
    lessXpFrom: '{level}레벨부터 감소',
    lessXp: '감소됨',
    entrance: '입구',
    doors: {
      front: '정문',
      back: '뒷문',
      purple: '보라색 입구',
      orange: '주황색 입구',
      north: '북쪽 입구',
      west: '서쪽 입구',
      east: '동쪽 입구',
      eastBack: '동쪽 뒷문',
    },
    shipTo: '배: {place}',
    zeppelinTo: '비행선: {place}',
    entranceOf: '입구: {name}',
    // Rare as the game's map legend says it for creatures (glossary).
    rareBoss: '{name} (희귀)',
    graveyard: '무덤',
    corpse: '내 시체',
    followed: '{name}, 게임에서 추적 중',
    journey: '{name}, 게임 속 이동 경로',
    quest: {
      available: '수락 가능한 퀘스트',
      turnin: '완료할 퀘스트',
      // The game's QUEST_OBJECTIVES.
      objective: '퀘스트 임무',
    },
    objective: {
      slay: '임무: 처치',
      loot: '임무: 획득',
      object: '임무: 사용',
      talk: '임무: 대화',
      event: '임무: 방문',
    },
  },

  // x and y come from toFixed (a dot, as 42.3), so the comma between them stays unambiguous.
  place: {
    coords: '{x}, {y}',
    inZone: '{zone} {x}, {y}',
  },

  way: {
    north: '{far} 북쪽',
    northEast: '{far} 북동쪽',
    east: '{far} 동쪽',
    southEast: '{far} 남동쪽',
    south: '{far} 남쪽',
    southWest: '{far} 남서쪽',
    west: '{far} 서쪽',
    northWest: '{far} 북서쪽',
    onFoot: '도보 {time}',
    mounted: '탈것 {time}',
  },

  label: {
    pinName: '핀 이름',
    far: '{far}, {time}',
    dungeonMap: '던전 지도',
    raidMap: '공격대 지도',
    send: '게임으로 전송',
    sending: '전송 중',
    sent: '전송됨',
    stopFollowing: '추적 중지',
    addToRoute: '경로에 추가',
    inRoute: '경로에 포함됨',
    save: '저장',
    remove: '삭제',
    noAnswer: '아직 게임의 응답이 없습니다. 전투가 끝나면 핀이 게임에 전달됩니다.',
  },

  nextStop: {
    none: '경로가 없습니다. 지도를 클릭하여 경유지를 추가하십시오.',
    title: '다음 경유지',
    count: '{n}/{of}',
    complete: '경로 완료',
    // Other continent, or inside or outside a dungeon: "your current map" says it more plainly than "ground".
    elsewhere: '현재 지도에 없음',
    // The character has arrived at the stop.
    here: '도착',
    minutes: '분 (도보)',
    minutesMounted: '분 (탈것)',
    skip: '건너뛰기',
    // Three buttons side by side: the band is about the route already, so the verb alone.
    edit: '편집',
    clear: '초기화',
    unsent: '아직 게임에 없음',
    send: '게임으로 전송',
    onItsWay: '게임으로 전송 중입니다.',
    moveUp: '위로: {name}',
    moveDown: '아래로: {name}',
    remove: '삭제: {name}',
  },

  search: {
    // Without the verb, beside the magnifier, as in French and German.
    placeholder: 'NPC, 아이템, 퀘스트, 지역',
    field: '검색',
    results: '검색 결과',
    none: '해당 이름의 결과가 없습니다.',
    zone: '지역',
    myPin: '내 핀',
    myPinIn: '내 핀, {zone}',
    dungeon: '던전',
    dungeonIn: '던전, {zone}',
    raid: '공격대',
    raidIn: '공격대, {zone}',
    foundIn: '{what}, {zone}',
  },
  daylight: {
    ring: '빛의 시간',
    ringTip: '끌어서 해를 옮깁니다. 클릭하면 게임 시간으로 돌아갑니다.',
  },
}
