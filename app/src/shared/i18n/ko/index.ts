// 한국어 Twinmap: the notes on every key are in en/.
import app from './app'
import map from './map'
import items from './items'
import auction from './auction'
import settings from './settings'

export default {
  common: {
    close: '닫기',
  },

  participate: {
    title: 'Twinmap 개선에 참여',
    // Twinmap is read 트윈맵: the particles after it follow the final ㅂ.
    what: 'Twinmap은 게임에서 보이는 것을 통해 배울 수 있습니다. 공유하면 던전 안에서 위치를 더 정확하게 찾고 지도에 없는 정보를 채우는 데 도움이 되는 정보를 보냅니다. 던전 안의 미니맵, 우두머리와 희귀 몬스터가 처치되는 위치, 던전 입구, 상급자가 가르치는 기술, Questie에 없는 생물, 물체, 퀘스트, 그리고 Twinmap 자체의 오류입니다.',
    anonymous: '모두 익명입니다. 이름, 캐릭터, 계정은 포함되지 않습니다.',
    later: '설정에서 언제든지 바꿀 수 있습니다.',
    full: '보내는 정보 전체 목록',
    // Two nouns of the same size, as the game's buttons.
    yes: '공유하기',
    no: '공유 안 함',
  },
  language: {
    step: '언어',
    title: '언어 선택',
    intro: 'Twinmap의 언어입니다. 게임에서 가져온 이름(지역, NPC, 아이템)은 게임 언어 그대로 표시됩니다.',
    game: '게임 언어',
    later: '설정에서 언제든지 바꿀 수 있습니다.',
    // Shown in Korean, so "your language" is named.
    newTitle: '이제 Twinmap을 한국어로 사용할 수 있습니다',
    newIntro: 'Twinmap의 언어를 선택하십시오. 선택하지 않으면 영어로 유지됩니다.',
    done: '완료',
    settingsTitle: '언어',
    label: 'Twinmap 언어',
    hint: '바로 적용됩니다. 게임에서 가져온 이름은 게임 언어 그대로 표시됩니다.',
  },
  app,
  map,
  items,
  auction,
  settings,
}
