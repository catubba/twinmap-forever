// Русский Twinmap: the notes on every key are in en/, the rules and the glossary in the design notes (l10n.md).
import app from './app'
import map from './map'
import items from './items'
import auction from './auction'
import settings from './settings'

export default {
  common: {
    close: 'Закрыть',
  },
  units: {
    yards: '{n} м',
    metres: '{n} м',
  },
  news: {
    title: 'Что нового в Twinmap',
    updatedFrom: 'Обновлено с версии {version}.',
    again: 'Открыть снова: {settings}, {button}.',
    button: 'Что нового',
    changed: 'Изменено',
    fixed: 'Исправлено',
    done: 'Понятно',
    goTo: 'Открыть: {name}',
  },

  participate: {
    title: 'Помогите улучшить Twinmap',
    // "свои ошибки": "свои" points back to Twinmap, the subject, so the name need not be declined.
    what: 'Twinmap может учиться на том, что вы видите в игре. Если вы согласитесь делиться данными, Twinmap будет отправлять то, что помогает точнее определять ваше место в подземельях и дополнять то, чего не хватает карте: мини-карту в подземельях, места гибели боссов и редких существ, входы в подземелья, то, чему учат учителя, существ, объекты и задания, которых не знает Questie, и свои ошибки.',
    // Account as the game says it: "учетная запись".
    anonymous: 'Ничто из этого не говорит, кто вы: ни имени, ни персонажа, ни учетной записи.',
    later: 'Вы можете передумать в любой момент в параметрах.',
    full: 'Что отправляется: полный список',
    yes: 'Да, делиться',
    no: 'Нет, спасибо',
  },
  language: {
    step: 'Язык',
    title: 'Выберите язык',
    intro: 'Язык Twinmap. Названия из игры (зоны, NPC, предметы) остаются на языке вашей игры.',
    game: 'язык вашей игры',
    later: 'Вы можете изменить его в любой момент в параметрах.',
    newTitle: 'Twinmap теперь говорит на вашем языке',
    newIntro: 'Выберите язык Twinmap. Если ничего не выбрать, останется английский.',
    done: 'Готово',
    label: 'Язык Twinmap',
    hint: 'Меняется сразу. Названия из игры остаются на языке игры.',
  },
  app,
  map,
  items,
  auction,
  settings,
}
