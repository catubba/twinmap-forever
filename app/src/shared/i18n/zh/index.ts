// 简体中文 Twinmap: the notes on every key are in en/.
import app from './app'
import map from './map'
import items from './items'
import auction from './auction'
import settings from './settings'

export default {
  common: {
    close: '关闭',
  },
  // 码 attached to the number, as the game (GS SPELL_RANGE "%s码距离"); 米 the same way.
  units: {
    yards: '{n}码',
    metres: '{n}米',
  },
  news: {
    title: 'Twinmap 新内容',
    updatedFrom: '已从 {version} 更新。',
    again: '再次查看：{settings}，{button}。',
    button: '新内容',
    changed: '更改',
    fixed: '修复',
    done: '知道了',
    goTo: '打开{name}',
  },

  participate: {
    title: '帮助改进Twinmap',
    what: 'Twinmap可以从你在游戏中看到的内容中学习。如果你选择分享，它会发送有助于在地下城中更准确地找到你、并补全地图所缺内容的数据：地下城内的微缩地图、首领和稀有怪物死亡的位置、地下城的入口、训练师教授的内容、Questie没有收录的生物、物体和任务，以及Twinmap自身的错误。',
    anonymous: '这些数据都不会透露你是谁：没有名字，没有角色，没有账号。',
    later: '你可以随时在设置中改变主意。',
    full: '发送内容的完整列表',
    // Two buttons of four characters each, the same size.
    yes: '是，分享',
    no: '不，谢谢',
  },
  language: {
    step: '语言',
    title: '选择你的语言',
    intro: 'Twinmap的语言。来自游戏的名称（地区、NPC、物品）会保留你游戏所用的语言。',
    game: '你游戏的语言',
    later: '你可以随时在设置中更改。',
    // Shown in Chinese, so "your language" is named.
    newTitle: 'Twinmap现已支持简体中文',
    newIntro: '请选择Twinmap的语言。如不选择，将保持英语。',
    done: '完成',
    label: 'Twinmap的语言',
    hint: '立即生效。来自游戏的名称会保留游戏所用的语言。',
  },
  app,
  map,
  items,
  auction,
  settings,
}
