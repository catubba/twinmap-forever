// 한국어 Twinmap: the notes on every key are in en/app.ts.
export default {
  top: {
    sections: '섹션',
    now: '현재',
    map: '지도',
    character: '캐릭터',
    inventory: '소지품',
    professions: '전문 기술',
    spellbook: '마법책',
    auctionSearch: '경매장 검색',
    item: '아이템',
    auctionHouse: '경매장',
    // The game's own short name (GS BUTTON_LAG_AUCTIONHOUSE).
    auctionHouseShort: '경매',
    pause: 'Twinmap 일시 정지',
    resume: 'Twinmap 재개',
    sendsLeft: { other: '전송 {count}회 남음' },
    // The app's own term (l10n.md): the game has no Feedback button. Named again in tiles.failedHelp.
    feedback: '의견 보내기',
    feedbackHint: '버그 또는 아이디어 제보',
    settings: '설정',
  },

  layout: {
    edit: '배치 편집 ({ctrl}+E)',
    editKey: '배치 편집',
    hint: '탭을 패널 가장자리로 끌면 옆에 놓이고, 가운데로 끌면 함께 묶입니다.',
    addPanel: '패널 추가',
    pull: '패널로 끌어 꺼내거나, 클릭하여 현재 아래에 놓으십시오',
    reset: '이 작업 공간 초기화',
    restore: '기본 작업 공간 복원',
    restoreSure: '모든 작업 공간을 처음 상태로 되돌리시겠습니까?',
    restoreYes: '복원',
    restoreNo: '취소',
    done: '완료',
    hintSpaces: '위쪽: 작업 공간을 끌면 순서가 바뀌고, 두 번 클릭하면 이름을 바꿀 수 있습니다.',
    newSpace: '새 작업 공간',
    spacesMost: '작업 공간은 최대 {most}개',
    unnamed: '작업 공간',
    rename: '작업 공간 이름',
    deleteSpace: '작업 공간 삭제',
    deleteSure: '작업 공간 "{name}"을(를) 삭제하시겠습니까? 배치는 사라지고, 패널은 다른 작업 공간에 남습니다.',
    deleteYes: '삭제',
    deleteNo: '유지',
  },

  link: {
    paused: '일시 정지됨',
    closed: '게임 실행 안 됨',
    closedLine: '게임이 실행되지 않았습니다. 지도는 계속 사용할 수 있으며, 접속하면 위치가 표시됩니다.',
    minimized: '게임 최소화됨',
    minimizedLine: '게임이 최소화되었습니다. 게임 창이 화면에 다시 나타나면 위치가 표시됩니다.',
    updateApp: '앱 업데이트',
    updateAddon: '애드온 업데이트',
    // The protocol numbers after a colon, so no particle follows them.
    newerAddon: 'Twinmap Forever 애드온이 이 앱보다 새 버전입니다(프로토콜: 애드온 {addon}, 앱 {app}). Twinmap을 닫았다가 다시 여십시오. 시작할 때 스스로 업데이트됩니다.',
    newerAddonMac: 'Twinmap Forever 애드온이 이 앱보다 새 버전입니다(프로토콜: 애드온 {addon}, 앱 {app}). macOS용 최신 Twinmap을 내려받으십시오. macOS가 열지 않으면 "시스템 설정 > 개인정보 보호 및 보안"에서 "그래도 열기"를 선택하십시오.',
    olderAddon: 'Twinmap Forever 애드온이 이 앱보다 이전 버전입니다(프로토콜: 애드온 {addon}, 앱 {app}). CurseForge에서 애드온을 업데이트한 다음 게임을 다시 시작하십시오.',
    connecting: '연결 중',
    lost: '연결 끊김',
    // "the strip is not paused" said as "sending is not paused": the strip has no name the player knows.
    lostLine: '게임에서 신호가 없습니다. 게임에 접속한 다음, Twinmap Forever 애드온이 켜져 있고 전송이 일시 정지되지 않았는지 확인하십시오.',
    screenRecording: 'Twinmap이 아직 게임 창을 읽을 수 없습니다. "시스템 설정 > 개인정보 보호 및 보안 > 화면 및 시스템 오디오 녹음"에서 Twinmap을 켜십시오(목록에 없으면 + 버튼으로 추가하십시오). 그런 다음 Twinmap을 다시 여십시오.',
    combat: '전투 중, 위치만',
    connected: '연결됨',
    // "미니맵 회전", as the game's setting (GS ROTATE_MINIMAP).
    minimapTurns: '던전 안의 위치는 미니맵에서 읽는데, 미니맵이 회전하는 동안에는 읽을 수 없습니다. 게임에서 "미니맵 회전"을 끄십시오.',
    noRooms: 'Twinmap에는 이 던전의 이미지가 없습니다. 이곳에서는 위치가 표시되지 않습니다.',
    noMinimap: '던전 안의 위치는 미니맵에서 읽는데, 게임이 미니맵 정보를 보내지 않습니다. Twinmap Forever 애드온을 업데이트하고 미니맵을 화면에 띄워 두십시오.',
    looking: '위치를 찾는 중입니다. 위치는 게임의 미니맵에서 읽습니다. 미니맵이 가려지지 않게 화면에 띄워 두십시오.',
  },

  map: {
    addonMissing: '게임에 Twinmap Forever 애드온이 없어 위치를 받을 수 없습니다. CurseForge에서 받은 다음 게임을 다시 시작하십시오.',
    getAddon: 'CurseForge에서 받기',
    paused: 'Twinmap이 일시 정지되었습니다. 지도는 마지막 위치에 머물고 캐릭터를 따라가지 않습니다.',
    resume: '재개',
    unknownZone: '알 수 없는 지역',
  },

  tiles: {
    builtOnce: '처음 한 번, 그리고 게임 업데이트 후에만 진행됩니다.',
    // Rewritten so no particle follows the game's name or _forever_.
    noGameHelp: '_forever_ 폴더가 들어 있는 World of Warcraft: Forever 설치 폴더를 선택하십시오.',
    // "런처", as Korean players say it.
    failedHelp: 'Twinmap이 게임 파일을 읽지 못했습니다. 런처가 게임을 업데이트하거나 복구하는 중이면 런처를 닫은 다음 다시 시도하십시오. 다시 실패하면 런처에서 게임을 복구하고 "의견 보내기"로 알려 주십시오.',
    looking: '게임을 찾는 중입니다.',
    noGame: '게임 폴더를 찾을 수 없습니다.',
    converting: '게임 파일로 지도를 만드는 중입니다({percent}%).',
    ready: '지도: 타일 {tiles}개 준비됨, 게임 {version}, 방 {rooms}개',
    readyReading: '지도: 타일 {tiles}개 준비됨, 게임 {version}, 방 읽는 중',
    readyNoRooms: '지도: 타일 {tiles}개 준비됨, 게임 {version}, 방 읽기 실패({problem})',
    failed: '지도를 만들 수 없습니다: {message}',
    chooseFolder: '게임 폴더 선택',
    retry: '다시 시도',
  },

  elsewhere: {
    title: '컴퓨터에서 설정 완료',
    text: '컴퓨터의 Twinmap은 아직 설정 중입니다. 남은 단계는 컴퓨터에 표시됩니다. 설정이 끝나면 지도가 이곳에 자동으로 열립니다.',
  },

  panel: {
    close: '닫기',
    open: '퀘스트 및 주변',
    mapLeft: '지도 왼쪽으로 (M)',
    mapRight: '지도 오른쪽으로 (M)',
    // The name after a colon, so no particle follows it.
    showing: '보는 중: {name}',
    backTo: '돌아가기: {name}',
    // As the game (GS UNIT_LEVEL_TEMPLATE).
    level: '레벨 {level}',
    levelPercent: '레벨 {level}, {percent}%',
    xp: '경험치 {xp} / {max}',
    experience: '경험치',
    emptyExperience: 'Twinmap Forever 애드온을 켜고 플레이하면 레벨이 여기에 표시됩니다.',
    emptyItem: '가방, 은행, 소지품 또는 경매장 검색에서 아이템을 클릭하면 여기에 가격이 표시됩니다.',
    widthHint: '끌어서 크기를 조절합니다. 두 번 클릭하면 초기화됩니다.',
  },

  now: {
    attention: '주의',
    inGame: '게임 내',
    pins: '내 핀',
    quests: '퀘스트',
    nearby: '주변',
    // As the game (GS MAP_LEGEND_TURNIN, GS OBJECTIVES_LABEL).
    handIn: '완료',
    objective: '임무',
    quest: '퀘스트',
    entrance: '입구',
    corpse: '시체',
    // The game's own names (minimap tracking): short enough in Korean for the cell.
    flight: '비행 조련사',
    inn: '여관',
    bank: '은행',
    auction: '경매장',
    stable: '야수 관리인',
    trainer: '상급자',
    repair: '장비 수리',
    vendor: '상인',
    onSale: '판매 중',
    cheaper: '더 저렴함',
    dearer: '더 비쌈',
    otherContinent: '다른 대륙',
    finding: '이동 경로 찾는 중',
    // Rewritten so no particle follows Shortest Path.
    updateHint: 'Shortest Path, Twinmap Forever 애드온을 업데이트하면 전체 이동 경로가 여기에 표시됩니다',
    emptyAttention: '지금은 확인할 것이 없습니다. 죽음이나 조건이 충족된 경매장 알림이 여기에 표시됩니다.',
    emptyPins: '저장한 핀이 아직 없습니다. 지도에서 장소를 클릭하고 저장하면 여기에 표시됩니다.',
    emptyQuests: '퀘스트 목록에 퀘스트가 없습니다. 게임에서 퀘스트를 수락하면 여기에 표시됩니다.',
    emptyNearby: '주변에 아무도 없습니다. 이동하면 주변의 상인, 상급자, 비행 조련사가 여기에 표시됩니다.',
    allOut: '현재의 모든 블록이 각자의 패널에 있습니다. 패널을 닫으면 그 블록이 여기로 돌아옵니다.',
  },

  journey: {
    // "이동 경로", not "경로": 경로 is Twinmap's own Route.
    name: '이동 경로',
    seconds: '{seconds}초',
    minutes: '{minutes}분',
    hours: '{hours}시간 {minutes}분',
  },

  death: {
    corpse: '내 시체',
  },

  send: {
    pointNoZone: '이 지점은 게임이 표시할 수 있는 지역에 있지 않습니다.',
    stopNoZone: '게임이 표시할 수 있는 지역 밖에 있는 경유지가 있습니다.',
    notConnected: '게임이 연결되지 않았습니다.',
    notListening: '게임이 아직 받을 준비가 되지 않았습니다. 계속 이 상태라면 애드온을 업데이트하고 게임을 다시 시작하십시오.',
    reload: '다시 보내려면 게임에서 /reload를 입력하십시오.',
    restart: '게임을 한 번 다시 시작하십시오. 다음에 시작할 때부터 Twinmap에서 보낸 내용을 받을 수 있습니다.',
    pin: '핀',
    stop: '경유지',
  },

  firstRun: {
    steps: '단계',
    building: '지도 만드는 중',
    secondsLeft: { other: '약 {count}초 남음' },
    minutesLeft: { other: '약 {count}분 남음' },
    skip: '건너뛰고 지도 보기',
    back: '뒤로',
    next: '다음',
    toMap: '지도로 이동',
    chooseFolder: '게임 폴더 선택',
    chooseAnother: '다른 폴더 선택',
    getAddon: 'CurseForge에서 Twinmap Forever 받기',
    // The name before a verb with no particle.
    getOptional: 'CurseForge에서 {name} 받기',
    retry: '다시 시도',
    photosensitivity: '광과민성 경고: 애드온은 게임 창 가장자리에 있는 1픽셀 줄의 색을 1초에 여러 번 바꾸어 데이터를 보냅니다. 게임 안의 애드온 설정에서 전송을 늦추거나 일시 정지할 수 있습니다.',
    game: {
      title: '게임 찾기',
      intro: 'Twinmap은 World of Warcraft: Forever 설치 위치를 알아야 합니다. 이 폴더는 읽기만 하며 그 안의 어떤 것도 바꾸지 않습니다.',
      found: '찾았습니다.',
      notFound: '이 PC에서 게임을 찾지 못했습니다.',
      choose: '게임이 설치된 폴더, 즉 _forever_ 폴더가 들어 있는 폴더를 선택하십시오.',
    },
    map: {
      title: '지도 만들기',
      intro: 'Twinmap은 이 PC의 게임 파일로 지도를 그리므로 항상 게임 버전과 일치합니다. 처음 한 번 만들고, 게임이 업데이트된 뒤에만 다시 만듭니다. 아무것도 내려받지 않습니다.',
      waiting: '게임 폴더를 기다리는 중입니다.',
      opening: '게임 파일을 여는 중입니다.',
      reading: '게임에 들어 있는 세계 이미지를 읽는 중입니다.',
      failed: '지도를 만들 수 없습니다.',
      ready: '지도가 준비되었습니다.',
      tiles: '타일 {count}개, 게임 버전 {version}.',
    },
    addon: {
      title: '애드온 받기',
      intro: 'Twinmap Forever 애드온이 캐릭터의 위치를 이 앱에 알려 줍니다. 다른 애드온처럼 CurseForge에서 설치합니다.',
      installed: '설치되었습니다.',
      // "버전" after the number carries the particle, whatever the number ends with.
      inFolder: '게임의 AddOns 폴더에 Twinmap Forever {version} 버전이 있습니다.',
      notYet: '아직 설치되지 않았습니다.',
      howTo: 'CurseForge 앱으로 설치하십시오. 이 앱이 없으면 같은 페이지에서 파일을 내려받아 _forever_\\Interface\\AddOns 폴더에 압축을 푸십시오.',
      howToMac: 'CurseForge 앱으로 설치하십시오. 이 앱이 없으면 같은 페이지에서 파일을 내려받아 _forever_/Interface/AddOns 폴더에 압축을 푸십시오.',
      notices: '애드온이 설치되면 이 페이지가 자동으로 알아챕니다.',
    },
    extras: {
      title: '선택 애드온',
      intro: '모두 필수는 아닙니다. 설치되어 있으면 Twinmap이 더 많은 정보를 보여 줍니다.',
      questie: 'QuestieDB: 설치됨. 지도에 서비스를 제공하는 NPC, 광물, 약초, 퀘스트 목록의 퀘스트가 표시됩니다. Questie도 실행 중이면 Questie에 표시되는 퀘스트가 받을 수 있는 퀘스트까지 그대로 표시됩니다.',
      noQuestie: 'QuestieDB: 설치되지 않음. CurseForge 앱에서 Twinmap Forever와 함께 설치됩니다. 없으면 지도에 NPC, 편의 시설, 퀘스트가 표시되지 않습니다.',
      shortestPath: 'Shortest Path: 설치됨. 지도에 이동 경로가 표시되고, 게임으로 보낸 지점까지 도로를 따라 안내됩니다.',
      noShortestPath: 'Shortest Path: 설치되지 않음. 설치하면 지도에 계획한 이동 경로가 표시되고, 게임으로 보낸 지점까지 도로를 따라 안내됩니다.',
    },
    play: {
      title: '게임 시작',
      intro: 'World of Warcraft: Forever 실행 후 캐릭터로 접속하십시오. 위치가 이곳에 자동으로 표시됩니다.',
      connected: '연결되었습니다. 위치를 받고 있습니다.',
      silent: '게임은 열려 있지만 아직 애드온에서 아무것도 오지 않습니다.',
      minimized: '게임이 최소화되었습니다. 게임 창을 화면에 다시 띄우십시오.',
      waiting: '게임을 기다리는 중입니다.',
      // "애드온", as the koKR character list button (GS ADDONS).
      tick: '캐릭터 선택 화면에서 "애드온"을 열고 Twinmap Forever가 선택되어 있는지 확인하십시오.',
    },
  },

  update: {
    updating: '업데이트 중',
    updatingTo: '{version} 버전으로 업데이트 중',
    installing: '{version} 버전 설치 중',
    reopen: '잠시 후 Twinmap이 다시 열립니다',
    downloading: '새 버전 내려받는 중',
  },

  web: {
    noAnswer: '컴퓨터의 Twinmap이 응답하지 않았습니다.',
    chooseOnComputer: '컴퓨터의 Twinmap에서 게임 폴더를 선택하십시오.',
  },

  main: {
    pickFolder: 'World of Warcraft: Forever 설치 위치',
    notGame: '이 폴더에는 World of Warcraft: Forever가 없습니다. _forever_ 폴더가 들어 있는 폴더를 선택하십시오.',
    savePicture: '이미지 저장: {name}',
    noNetwork: '이 컴퓨터는 홈 네트워크에 연결되어 있지 않습니다.',
    portTaken: '{port}번 포트를 다른 프로그램이 사용 중입니다.',
    scanAgain: '컴퓨터에서 Twinmap 설정을 열고 코드를 다시 스캔하십시오.',
    nothingToSend: '보낼 내용이 없습니다.',
    cannotWrite: 'Twinmap이 게임 폴더의 애드온 옆에 파일을 쓸 수 없었습니다.',
  },

  found: {
    npc: 'NPC',
    // The giver after a colon, so no particle follows the name.
    quest: '퀘스트, 제공: {giver}',
    questLevel: '퀘스트, 레벨 {level}, 제공: {giver}',
    soldBy: '상인: {name}',
    // As the game's "우두머리 전리품: %s".
    droppedBy: '전리품: {name}',
    // "출처": the name can be an object (a chest, a plant), where a place particle would not fit.
    foundIn: '출처: {name}',
    questNumber: '퀘스트 {id}',
    // Under an NPC: the game's names of the NPCs themselves (minimap tracking).
    services: {
      flight: '비행 조련사',
      inn: '여관주인',
      vendor: '상인',
      repair: '장비 수리',
      trainer: '상급자',
      bank: '은행원',
      auction: '경매인',
      stable: '야수 관리인',
    },
  },
}
