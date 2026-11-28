// 한국어 Twinmap: the notes on every key are in en/.
export default {
  // The game's menu entry (GS GAMEMENU_OPTIONS).
  title: '설정',
  categories: {
    label: '분류',
    general: '일반',
    appearance: '모양',
    graphics: '그래픽',
    game: '게임 및 애드온',
    privacy: '개인정보',
    about: 'Twinmap 정보',
  },

  gameFolder: {
    title: '게임 폴더',
    notFound: '찾을 수 없음',
    change: '폴더 변경',
    choose: '게임 폴더 선택',
  },

  distances: {
    label: '거리',
    yards: '야드',
    metres: '미터',
  },

  layout: {
    label: '지도',
    left: '왼쪽',
    right: '오른쪽',
    hint: 'M 키로 언제든지 반대쪽으로 옮길 수 있습니다.',
    custom: '지도 위치는 직접 만든 배치를 따릅니다. {edit}에서 옮기십시오.',
  },

  mapLook: {
    label: '2D 지도',
    tiles: '미니맵',
    parchment: '세계 지도',
    hint: '세계 지도는 게임 지도처럼 모든 지역을 탐험한 상태로, Twinmap의 장소 이름 없이 그립니다. 3D 보기는 미니맵을 그대로 씁니다.',
  },

  arrow: {
    title: '화살표',
    colour: '색상',
    size: '크기',
    default: '기본값',
  },

  icons: {
    label: '지도 아이콘',
    game: '게임',
    hint: '수락 가능한 퀘스트, 완료할 퀘스트, 임무에 쓰입니다. 선택한 아이콘에 없는 것은 Twinmap 아이콘으로 표시됩니다.',
  },

  objectives: {
    label: '임무',
    icons: '아이콘',
    areas: '영역',
    hint: '영역은 게임 지도처럼 Questie가 각 임무를 표시하는 곳을 둘러싸 그려집니다.',
  },

  graphics: {
    view3d: '3D 보기',
    buildings: '건물',
    cost: '각 항목은 메모리와 그래픽 카드 시간을 사용합니다. 이 창에만 저장되며, 휴대폰이나 태블릿은 따로 저장합니다.',
    trees: '나무',
    density: '나무 수',
    few: '적게',
    some: '보통',
    many: '많이',
    treesHint: '빽빽한 숲은 성기게 하고 캐릭터 주변에는 나뭇잎을 그리지 않아 땅과 길이 보입니다.',
    objects: '사물',
    objectsHint: '울타리, 수레, 가로등, 천막, 화로.',
    ground: '가까운 땅 텍스처',
    groundHint: '가까이에서는 게임의 텍스처로 땅을 그려 선명하게 보입니다.',
    dungeons: '3D 던전 (실험적)',
    dungeonsHint: '3D 보기에서 던전과 공격대를 방이 위에서 열린 모습으로 보여 줍니다. 아직 만드는 중이라 틀리거나 느릴 수 있습니다.',
    card: '그래픽 카드',
  },

  window: {
    // Twinmap is read 트윈맵: the particles after it follow the final ㅂ.
    onTop: 'Twinmap을 항상 다른 창 위에 표시',
    // GS FONT_SIZE.
    textSize: '글자 크기',
    gpu: '하드웨어 가속 사용',
    gpuHint: '지도가 깜박이거나 검게 나오면 끄십시오. 끄면 3D 보기가 느려집니다.',
    restartNeeded: 'Twinmap을 다시 시작하면 적용됩니다.',
    restartNow: '지금 다시 시작',
  },

  phone: {
    title: '휴대폰 및 태블릿',
    share: '내 다른 기기에 지도 표시',
    codeLabel: '옆의 주소를 휴대폰 카메라로 읽을 수 있는 코드',
    scan: '코드를 스캔하거나 다음 주소를 여십시오',
    homeOnly: '홈 네트워크에 있는 기기에서만 사용할 수 있습니다. Windows에서 한 번 허용을 요청할 수 있습니다.',
  },

  participate: {
    share: 'Forever 세계에 대한 익명 데이터 공유',
    // Worded as participate.what in ko/index.ts. Chat is "대화", as the game (GS CHAT).
    what: '직접 켜지 않으면 꺼져 있습니다. Twinmap은 던전 안에서 위치를 더 정확하게 찾고 지도에 없는 정보를 채우는 데 도움이 되는 정보를 보냅니다. 던전 안의 미니맵, 우두머리와 희귀 몬스터가 처치되는 위치, 던전 입구, 상급자가 가르치는 기술, Questie에 없는 생물, 물체, 퀘스트, 그리고 Twinmap 자체의 오류입니다. 이름, 캐릭터, 계정, 대화, 화면의 나머지 부분은 절대 보내지 않습니다. 끄면 더 이상 아무것도 보내지 않습니다.',
  },

  found: {
    inFolder: '폴더에서 찾은 항목',
    addon: 'Twinmap Forever 애드온',
    questie: 'NPC, 편의 시설, 퀘스트',
    // GS OPTIONAL.
    optional: '선택 사항',
    installed: '설치됨',
    get: 'CurseForge에서 받기',
    map: '지도',
    mapLooking: '찾는 중',
    mapNoGame: '게임 폴더 대기 중',
    mapBuilding: '생성 중, {percent}%',
    mapFailed: '생성 실패: {message}',
    mapReady: '준비 완료, 게임 버전 {version}',
  },

  version: {
    updates: '시작할 때 자동으로 업데이트됩니다. 애드온은 CurseForge를 통해 업데이트됩니다.',
    report: '버그 또는 아이디어 제보',
    firstRun: '첫 단계 다시 진행',
  },

  keys: {
    // Key Bindings in the game (GS KEY_BINDINGS).
    title: '단축키 설정',
    layers: '필터',
    // The game's "켜기/끄기" (GS BINDING_NAME_TOGGLEMINIMAPROTATION); Follow is "추적" (glossary).
    follow: '추적 켜기/끄기',
    north: '캐릭터 방향에 맞춰 지도 회전, 또는 북쪽이 위',
    side: '지도를 패널 반대쪽으로',
    spaces: '위쪽 섹션, 왼쪽부터 차례로',
    // GS VIDEO_OPTIONS_FULLSCREEN.
    fullScreen: '전체 화면',
    // Korean keyboards print Ctrl (GS CTRL_KEY "CTRL 키").
    ctrl: 'Ctrl',
    // "+" between the keys: no particle after Ctrl.
    zoom: '글자 크기, 지도 밖에서는 Ctrl + 마우스 휠로도 조절',
    // "정보 카드": our word for the label that opens on a point.
    close: '정보 카드, 필터, 설정 창 닫기',
    // "키" after it: the Arrow of the route is "화살표".
    arrows: '화살표 키',
    move: '지도 이동 및 확대/축소',
    // The game's name of the button (GS KEY_BUTTON2): the drag goes in turn, as in German.
    rightDrag: '오른쪽 마우스 버튼',
    turn: '누른 채 끌기: 지도 회전',
    // GS KEY_SPACE.
    space: '스페이스 바',
    label: '지도 중앙 지점의 정보 카드',
  },

  about: {
    what: '두 번째 화면에 띄우는 World of Warcraft: Forever 실시간 지도입니다. GNU General Public License 버전 3에 따른 자유 소프트웨어입니다. 어떠한 보증도 제공하지 않습니다.',
    notAffiliated: 'Blizzard Entertainment와 제휴 관계가 없으며 Blizzard Entertainment의 승인을 받지 않았습니다. World of Warcraft는 Blizzard Entertainment, Inc.의 상표입니다.',
    built: { other: '제작에 사용: 포함된 프로젝트 {count}개의 라이선스' },
    seeText: '전문 보기',
  },

  feedback: {
    // Feedback is "의견 보내기" (glossary).
    title: '의견 보내기',
    // A GitHub issue is "이슈", as Korean GitHub users say.
    intro: '버그를 발견했거나 아이디어가 있습니까? 알려 주십시오. 여기에 작성하고 "보내기"를 누르거나, GitHub에 이슈를 올리거나, 이메일을 보내십시오. 보내기 전에 모든 내용을 직접 확인할 수 있습니다.',
    placeholder: '무슨 일이 있었는지, 또는 원하는 기능',
    message: '메시지',
    email: '이메일 주소 (답변을 원할 경우)',
    withLog: '로그 첨부',
    // GS SEND_LABEL.
    send: '보내기',
    sending: '보내는 중',
    github: 'GitHub에 이슈 올리기',
    letter: '이메일 쓰기',
    sent: '보냈습니다. 감사합니다.',
    carries: '"보내기"를 누르면 작성한 내용과 여기에 표시된 세부 정보가 Twinmap 개발자에게 전달됩니다. 이메일 주소와 로그는 추가한 경우에만 전달됩니다. "보내기"를 누르기 전에는 아무것도 보내지 않습니다.',
    privacy: '개인정보 보호',
    // The address goes after a colon: no particle after it.
    noGithub: 'GitHub 계정이 없습니까? 영어나 이탈리아어로 이메일을 보내 주십시오: {email}',
    details: 'Twinmap이 메시지에 추가하는 정보',
    logCopy: '버그라면 로그가 도움이 됩니다. 로그는 Twinmap에 일어난 일을 Twinmap이 직접 남긴 기록입니다(시작, 게임 발견, 지도, 연결). 보낼 내용에 추가하거나, 복사해서 이슈나 이메일에 붙여 넣으십시오.',
    log: '버그라면 로그가 도움이 됩니다. 로그는 Twinmap에 일어난 일을 Twinmap이 직접 남긴 기록입니다(시작, 게임 발견, 지도, 연결). 보낼 내용에 추가하십시오.',
    copyDetails: '세부 정보 복사',
    copyLog: '로그 복사',
    copied: '복사됨',
    close: '닫기',
    letterTop: '무슨 일이 있었는지, 또는 원하는 기능:',
    fails: {
      empty: '먼저 메시지를 작성하십시오.',
      tooLong: '메시지가 너무 깁니다. 최대 {most}자까지 쓸 수 있습니다.',
      tooMany: '짧은 시간에 메시지를 너무 많이 보냈습니다. 1분 후에 다시 보내십시오.',
      badEmail: '이메일 주소가 올바르지 않은 것 같습니다.',
      notDelivered: '메시지를 전달하지 못했습니다. 나중에 다시 시도하거나 GitHub 또는 이메일을 이용하십시오.',
      noAnswer: '서버가 응답하지 않습니다. 연결 상태를 확인하고 다시 보내십시오.',
    },
  },
}
