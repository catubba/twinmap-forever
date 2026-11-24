// 简体中文 Twinmap: the notes on every key are in en/.
export default {
  // GS SETTINGS.
  title: '设置',
  categories: {
    label: '类别',
    general: '常规',
    appearance: '外观',
    game: '游戏和插件',
    privacy: '隐私',
    about: '关于 Twinmap',
  },
  // Back is 返回; GS BACK 后退 is a step back in a list of pages.

  gameFolder: {
    title: '游戏文件夹',
    notFound: '未找到',
    change: '更改文件夹',
    choose: '选择游戏文件夹',
  },

  layout: {
    title: '布局',
    mapLeft: '地图在左侧',
    mapRight: '地图在右侧',
  },

  window: {
    title: '窗口',
    onTop: '让Twinmap始终显示在其他窗口上方',
    // GS FONT_SIZE.
    textSize: '字体大小',
    gpu: '使用硬件加速',
    gpuHint: '如果地图闪烁或一直黑屏，请关闭此项。关闭后3D视图会变慢。',
    restartNeeded: '重新启动Twinmap后生效。',
    // GS RESTART.
    restartNow: '立即重新启动',
  },

  phone: {
    title: '手机和平板',
    share: '在我的其他设备上显示地图',
    codeLabel: '旁边的地址，以二维码形式供手机相机扫描',
    scan: '扫描二维码，或打开',
    homeOnly: '仅限你家庭网络中的设备。Windows可能会询问一次是否允许。',
  },

  participate: {
    share: '分享关于Forever世界的匿名数据',
    // Worded as participate.what in zh/index.ts. Chat is 聊天, as the game (GS CHAT).
    what: '除非你手动开启，否则保持关闭。Twinmap会发送有助于在地下城中更准确地找到你、并补全地图所缺内容的数据：地下城内的微缩地图、首领和稀有怪物死亡的位置、地下城的入口、训练师教授的内容、Questie没有收录的生物、物体和任务，以及Twinmap自身的错误。绝不发送名字、角色、账号、聊天内容或屏幕上的其他内容。关闭后便不再发送任何内容。',
  },

  found: {
    title: 'Twinmap找到的内容',
    // Addon is 插件, as the game's AddOns button (GS ADDONS).
    addon: 'Twinmap Forever插件',
    // Services is 服务, as the group of the map.
    questie: 'NPC、服务和任务',
    // GS OPTIONAL.
    optional: '可选',
    installed: '已安装',
    get: '从CurseForge获取',
    map: '地图',
    mapLooking: '正在查找',
    mapNoGame: '等待游戏文件夹',
    mapBuilding: '正在生成，{percent}%',
    mapFailed: '未生成：{message}',
    mapReady: '已就绪，游戏版本{version}',
  },

  version: {
    updates: '启动时自动更新。插件通过CurseForge更新。',
    // "Bug" in Latin letters, as the game (GS SEND_BUG 提交Bug, GS BUG_BUTTON Bug及建议).
    report: '提交Bug或建议',
    firstRun: '重新进行首次设置',
  },

  keys: {
    // Key Bindings in the game (GS KEY_BINDINGS).
    title: '按键设置',
    layers: '图层',
    // The map following the character is GS FOLLOW 跟随 (glossary); "打开/关闭" as GS BINDING_NAME_TOGGLEMINIMAPROTATION.
    follow: '打开/关闭跟随',
    north: '地图随角色转向，或保持北方朝上',
    side: '地图移到面板另一侧',
    // GS VIDEO_OPTIONS_FULLSCREEN.
    fullScreen: '全屏幕',
    // Chinese keyboards print Ctrl (GS CTRL_KEY "CTRL键").
    ctrl: 'Ctrl',
    zoom: '字体大小，在地图外也可用Ctrl+鼠标滚轮',
    // 信息卡: our word for the label that opens on a point.
    close: '关闭信息卡、图层或设置',
    // 键 after it: the Arrow of the route is 箭头.
    arrows: '方向键',
    move: '移动和缩放地图',
    // The game's name of the button (GS KEY_BUTTON2): the drag goes in turn, as in German and Korean.
    rightDrag: '鼠标右键',
    turn: '按住拖动：旋转地图',
    // GS KEY_SPACE.
    space: '空格键',
    label: '地图中央地点的信息卡',
  },

  about: {
    // Names under the licence and the trademark stay as their owners write them.
    what: '用于第二块屏幕的World of Warcraft: Forever实时地图。基于GNU General Public License第3版的自由软件。不提供任何担保。',
    notAffiliated: '与Blizzard Entertainment无关联，也未获其认可。World of Warcraft是Blizzard Entertainment, Inc.的商标。',
    built: { other: '构建所用：内含{count}个项目的许可证' },
    seeText: '查看全文',
  },

  feedback: {
    // Feedback is 反馈 (glossary).
    title: '反馈',
    // A GitHub issue is "Issue", as Chinese GitHub users say.
    intro: '发现了Bug，或者有什么想法？告诉我们。在这里写下来并点击“发送”，或者在GitHub上提交Issue，或者发电子邮件。发出之前，你能看到其中的每一个字。',
    placeholder: '发生了什么，或者你希望有什么功能',
    message: '你的消息',
    email: '你的电子邮件（如需回复）',
    withLog: '附上日志',
    // GS SEND_LABEL.
    send: '发送',
    sending: '正在发送',
    github: '在GitHub上提交Issue',
    letter: '写电子邮件',
    sent: '已发送。谢谢。',
    carries: '点击“发送”会把你的消息交给Twinmap开发者：你写的文字和这里显示的详细信息；你的电子邮件和日志只有在你添加后才会一并发送。点击“发送”之前，什么都不会发出。',
    privacy: '隐私',
    noGithub: '没有GitHub账号？请用英语或意大利语写信至{email}。',
    details: 'Twinmap添加到你消息中的内容',
    logCopy: '如果是Bug，日志会有帮助：它是Twinmap对自身运行情况的记录（启动、找到游戏、地图、连接）。把它附在要发送的内容中，或者复制后粘贴到Issue或电子邮件里。',
    log: '如果是Bug，日志会有帮助：它是Twinmap对自身运行情况的记录（启动、找到游戏、地图、连接）。把它附在要发送的内容中。',
    copyDetails: '复制详细信息',
    copyLog: '复制日志',
    copied: '已复制',
    close: '关闭',
    letterTop: '发生了什么，或者你希望有什么功能：',
    fails: {
      empty: '请先写下你的消息。',
      tooLong: '你的消息太长了：最多{most}个字符。',
      tooMany: '短时间内发送的消息太多。请等一分钟后再发送。',
      badEmail: '电子邮件地址似乎不正确。',
      notDelivered: '消息未能送达。请稍后再试，或者使用GitHub或电子邮件。',
      noAnswer: '服务器没有响应。请检查网络连接后再发送。',
    },
  },
}
