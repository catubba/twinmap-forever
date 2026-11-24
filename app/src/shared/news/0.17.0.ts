// What's new of 0.17.0 in the other languages of the app: the section of CHANGELOG.md, entry by entry in the same order.
import type { News } from '../news'

export default {
  langs: {
    frFR: `### New

- **Twinmap sur Mac.** Twinmap fonctionne maintenant sur les Mac Apple Silicon (macOS 14 ou plus récent) avec le client macOS de WoW: Forever. Un téléchargement pour Mac arrive bientôt ; en attendant, le README sur GitHub explique comment la construire. Merci à markus-barta.
- **Nouveautés.** Après une mise à jour, Twinmap montre une fois ce qui a changé dans les versions que vous avez sautées. Options, À propos de Twinmap, Nouveautés les montre à nouveau.
- **Temps d’arrivée à votre vitesse.** Le temps sur l’étiquette d’un point et sur la bande de la prochaine étape suit maintenant la vitesse de votre personnage, et sur une monture il le dit : « 0:50 en monture ». Merci à Stalioot.
- **Mètres.** Twinmap en anglais ou en chinois peut écrire les distances en mètres : Options, Général, Distances. Les chiffres restent ceux du jeu, comme dans les clients du jeu en d’autres langues : seule l’unité change.
- **La ligne sur le côté du jeu.** Dans les options de l’addon, Position a maintenant aussi Bord de gauche et Bord de droite, quand le haut de la fenêtre du jeu est caché ou hors de l’écran, par exemple un jeu étiré sur deux écrans.

### Changed

- **Options dans une fenêtre.** Les options s’ouvrent au-dessus de la carte, avec leurs catégories dans une colonne à gauche. Chaque choix tient sur une ligne, et le côté de la carte est maintenant dans Apparence.
- **Calques s’appelle maintenant Filtres.** Le bouton en haut de la carte et son menu ont un nom plus clair. La touche L l’ouvre toujours.

### Fixed

- **Suivi dans les donjons avec la minicarte dans le coin.** Avec une minicarte de certaines largeurs collée au coin supérieur droit de l’écran, Twinmap ne suivait pas votre personnage dans les donjons. C’est corrigé.
- **Plus de « addon plus ancien que l’app » par erreur.** Une ligne lue pendant que le jeu la redessinait pouvait faire dire à Twinmap que l’addon était trop ancien, avec la même version des deux côtés. Twinmap ne croit plus qu’une ligne qui se vérifie.
`,
    deDE: `### New

- **Twinmap auf dem Mac.** Twinmap läuft jetzt auf Macs mit Apple Silicon (macOS 14 oder neuer) mit dem macOS-Client von WoW: Forever. Ein Download für den Mac folgt bald; bis dahin erklärt das README auf GitHub, wie man es baut. Danke an markus-barta.
- **Neuigkeiten.** Nach einem Update zeigt Twinmap einmal, was sich in den übersprungenen Versionen geändert hat. Optionen, Über Twinmap, Neuigkeiten zeigt es erneut.
- **Ankunftszeiten in deinem Tempo.** Die Zeit im Infofeld eines Punkts und auf dem Band des nächsten Halts richtet sich jetzt nach der Geschwindigkeit deines Charakters, und auf einem Reittier sagt sie es: „0:50 beritten“. Danke an Stalioot.
- **Meter.** Mit Twinmap auf Englisch oder Chinesisch schreibt Optionen, Allgemein, Entfernungen die Entfernungen in Metern. Die Zahlen bleiben die des Spiels, wie in den Clients des Spiels in anderen Sprachen: Nur die Einheit ändert sich.
- **Die Linie an der Seite des Spiels.** In den Optionen des Addons hat Position jetzt auch Linker Rand und Rechter Rand, wenn der obere Rand des Spielfensters verdeckt oder außerhalb des Bildschirms ist, etwa bei einem Spiel über zwei Bildschirme.

### Changed

- **Optionen in einem Fenster.** Die Optionen öffnen sich über der Karte, mit ihren Kategorien in einer Spalte links. Jede Wahl ist eine Zeile, und die Seite der Karte steht jetzt unter Darstellung.
- **Ebenen heißen jetzt Filter.** Die Schaltfläche oben auf der Karte und ihr Menü haben einen klareren Namen. Die Taste L öffnet sie weiterhin.

### Fixed

- **In Dungeons verfolgt, auch mit der Minikarte in der Ecke.** Mit einer Minikarte mancher Breiten direkt an der oberen rechten Ecke des Bildschirms folgte Twinmap deinem Charakter in Dungeons nicht. Jetzt schon.
- **Kein falsches „Addon älter als die App“ mehr.** Eine Linie, die gelesen wurde, während das Spiel sie neu zeichnete, konnte Twinmap sagen lassen, das Addon sei zu alt, obwohl beide dieselbe Version hatten. Twinmap glaubt jetzt nur einer Linie, deren Prüfsumme stimmt.
`,
    esES: `### New

- **Twinmap en Mac.** Twinmap ya funciona en los Mac con Apple Silicon (macOS 14 o posterior) con el cliente de macOS de WoW: Forever. Pronto habrá descarga para Mac; mientras tanto, el README en GitHub explica cómo compilarla. Gracias a markus-barta.
- **Novedades.** Tras una actualización, Twinmap muestra una vez lo que ha cambiado en las versiones que te has saltado. Opciones, Acerca de Twinmap, Novedades lo vuelve a mostrar.
- **Tiempos de llegada a tu velocidad.** El tiempo en la etiqueta de un punto y en la banda de la próxima parada va ahora a la velocidad de tu personaje, y en montura lo dice: «0:50 en montura». Gracias a Stalioot.
- **Metros.** Con Twinmap en inglés o en chino, Opciones, General, Distancias escribe las distancias en metros. Los números siguen siendo los del juego, como en los clientes del juego en otros idiomas: solo cambia la unidad.
- **La línea en el lateral del juego.** En las opciones del addon, Posición tiene ahora también Borde izquierdo y Borde derecho, para cuando la parte de arriba de la ventana del juego queda tapada o fuera de la pantalla, por ejemplo con el juego estirado sobre dos pantallas.

### Changed

- **Opciones en una ventana.** Las opciones se abren encima del mapa, con sus categorías en una columna a la izquierda. Cada elección es una fila, y el lado del mapa está ahora en Apariencia.
- **Capas ahora se llama Filtros.** El botón de arriba del mapa y su menú tienen un nombre más claro. La tecla L lo sigue abriendo.

### Fixed

- **Seguimiento en mazmorras con el minimapa en la esquina.** Con un minimapa de ciertos anchos pegado a la esquina superior derecha de la pantalla, Twinmap no seguía a tu personaje dentro de las mazmorras. Ahora sí.
- **Se acabó el «addon más antiguo que la aplicación» por error.** Una línea leída mientras el juego la redibujaba podía hacer que Twinmap dijera que el addon era demasiado antiguo, con la misma versión en los dos. Twinmap ahora solo se fía de una línea que cuadra.
`,
    esMX: `### New

- **Twinmap en Mac.** Twinmap ya funciona en las Mac con Apple Silicon (macOS 14 o posterior) con el cliente de macOS de WoW: Forever. Pronto habrá descarga para Mac; mientras tanto, el README en GitHub explica cómo compilarla. Gracias a markus-barta.
- **Novedades.** Después de una actualización, Twinmap muestra una vez lo que cambió en las versiones que te saltaste. Opciones, Acerca de Twinmap, Novedades lo vuelve a mostrar.
- **Tiempos de llegada a tu velocidad.** El tiempo en la etiqueta de un punto y en la banda de la próxima parada va ahora a la velocidad de tu personaje, y en montura lo dice: "0:50 en montura". Gracias a Stalioot.
- **Metros.** Con Twinmap en inglés o en chino, Opciones, General, Distancias escribe las distancias en metros. Los números siguen siendo los del juego, como en los clientes del juego en otros idiomas: solo cambia la unidad.
- **La línea en el costado del juego.** En las opciones del addon, Posición ahora también tiene Borde izquierdo y Borde derecho, para cuando la parte de arriba de la ventana del juego queda tapada o fuera de la pantalla, por ejemplo con el juego estirado sobre dos pantallas.

### Changed

- **Opciones en una ventana.** Las opciones se abren encima del mapa, con sus categorías en una columna a la izquierda. Cada opción es una fila, y el lado del mapa ahora está en Apariencia.
- **Capas ahora se llama Filtros.** El botón de arriba del mapa y su menú tienen un nombre más claro. La tecla L lo sigue abriendo.

### Fixed

- **Seguimiento en calabozos con el minimapa en la esquina.** Con un minimapa de ciertos anchos pegado a la esquina superior derecha de la pantalla, Twinmap no seguía a tu personaje dentro de los calabozos. Ahora sí.
- **Ya no sale "addon más antiguo que la aplicación" por error.** Una línea leída mientras el juego la volvía a dibujar podía hacer que Twinmap dijera que el addon era demasiado antiguo, con la misma versión en los dos. Twinmap ahora solo confía en una línea que cuadra.
`,
    ruRU: `### New

- **Twinmap на Mac.** Twinmap теперь работает на Mac с Apple Silicon (macOS 14 или новее) с клиентом WoW: Forever для macOS. Загрузка для Mac появится скоро, а пока в README на GitHub написано, как ее собрать. Спасибо markus-barta.
- **Что нового.** После обновления Twinmap один раз показывает, что изменилось в пропущенных версиях. Параметры, О Twinmap, Что нового показывает это снова.
- **Время в пути с вашей скоростью.** Время на карточке точки и на полосе следующей остановки теперь считается по скорости вашего персонажа, а верхом об этом сказано: «0:50 верхом». Спасибо Stalioot.
- **Метры.** Если Twinmap на английском или китайском, Параметры, Общие, Расстояния пишет расстояния в метрах. Числа остаются игровыми, как в клиентах игры на других языках: меняется только единица.
- **Полоса сбоку от игры.** В настройках аддона у пункта Положение теперь есть также Левый край и Правый край, на случай если верх окна игры закрыт или за пределами экрана, например когда игра растянута на два экрана.

### Changed

- **Параметры в отдельном окне.** Параметры открываются поверх карты, с разделами в столбце слева. Каждый выбор занимает одну строку, а сторона карты теперь в разделе Внешний вид.
- **Слои теперь называются Фильтры.** Кнопка вверху карты и ее меню получили более понятное название. Клавиша L по-прежнему открывает их.

### Fixed

- **Слежение в подземельях с миникартой в углу.** Если миникарта некоторой ширины стояла вплотную к правому верхнему углу экрана, Twinmap не следил за персонажем в подземельях. Теперь следит.
- **Больше никаких ложных «аддон старше приложения».** Полоса, считанная, пока игра ее перерисовывала, могла заставить Twinmap сказать, что аддон слишком старый, хотя версии совпадали. Теперь Twinmap верит только полосе с верной контрольной суммой.
`,
    koKR: `### New

- **Mac용 Twinmap.** 이제 Twinmap은 Apple Silicon Mac(macOS 14 이상)에서 WoW: Forever의 macOS 클라이언트와 함께 실행됩니다. Mac용 다운로드는 곧 제공됩니다. 그때까지는 GitHub의 README에 빌드하는 방법이 있습니다. markus-barta님께 감사드립니다.
- **새로운 기능.** 업데이트 후 Twinmap은 건너뛴 버전에서 바뀐 내용을 한 번 보여 줍니다. 설정, Twinmap 정보, 새로운 기능에서 다시 볼 수 있습니다.
- **내 속도로 계산하는 도착 시간.** 지점의 정보 카드와 다음 정류지 띠에 표시되는 시간이 이제 캐릭터의 실제 속도로 계산되며, 탈것을 타고 있으면 그렇게 표시됩니다: "탈것 0:50". Stalioot님께 감사드립니다.
- **미터.** Twinmap이 영어나 중국어일 때 설정, 일반, 거리에서 거리를 미터로 표시할 수 있습니다. 숫자는 다른 언어의 게임 클라이언트처럼 게임의 숫자 그대로이며, 단위만 바뀝니다.
- **게임 옆면의 띠.** 애드온 옵션의 위치에 이제 왼쪽 가장자리와 오른쪽 가장자리도 있습니다. 게임 창 위쪽이 가려지거나 화면 밖에 있을 때, 예를 들어 게임을 두 화면에 걸쳐 늘린 경우에 사용하십시오.

### Changed

- **창으로 열리는 설정.** 설정이 지도 위에 열리고, 분류가 왼쪽 열에 있습니다. 모든 선택이 한 줄이며, 지도의 위치는 이제 모양에 있습니다.
- **레이어가 이제 필터입니다.** 지도 위쪽의 버튼과 그 메뉴의 이름이 더 알기 쉬워졌습니다. L 키로 계속 열 수 있습니다.

### Fixed

- **미니맵이 구석에 있어도 던전에서 추적.** 일부 너비의 미니맵이 화면 오른쪽 위 구석에 딱 붙어 있으면 Twinmap이 던전 안에서 캐릭터를 따라가지 못했습니다. 이제 따라갑니다.
- **잘못된 "애드온이 앱보다 오래됨" 표시 해결.** 게임이 다시 그리는 도중에 읽은 띠 때문에, 양쪽 버전이 같은데도 Twinmap이 애드온이 너무 오래되었다고 표시할 수 있었습니다. 이제 Twinmap은 검사가 맞는 띠만 믿습니다.
`,
    zhCN: `### New

- **Mac 版 Twinmap。** Twinmap 现在可以在 Apple Silicon Mac（macOS 14 或更高版本）上配合 WoW: Forever 的 macOS 客户端运行。Mac 下载即将提供；在此之前，构建方法见 GitHub 上的 README。感谢 markus-barta。
- **新内容。** 更新后，Twinmap 会显示一次你跳过的版本中的变化。设置、关于 Twinmap、新内容可以再次查看。
- **按你的速度计算到达时间。** 地点信息卡和下一站横条上的时间现在按你角色的实际速度计算，骑乘时也会注明：“坐骑0:50”。感谢 Stalioot。
- **米。** Twinmap 为英文或中文时，设置、常规、距离可以用米显示距离。数字仍是游戏本身的数字，与其他语言的游戏客户端一样：只换单位。
- **游戏侧边的线条。** 插件选项的位置中现在还有左侧边缘和右侧边缘，适用于游戏窗口顶部被遮住或在屏幕外的情况，例如游戏横跨两个屏幕。

### Changed

- **设置改为窗口。** 设置在地图上方打开，类别在左侧一列。每个选项占一行，地图的左右位置现在在外观中。
- **图层现在叫筛选。** 地图顶部的按钮及其菜单换了更清楚的名字。L 键仍可打开。

### Fixed

- **小地图在角落时也能在地下城中跟随。** 某些宽度的小地图紧贴屏幕右上角时，Twinmap 在地下城中不跟随你的角色。现已修复。
- **不再误报“插件比应用旧”。** 在游戏重绘时读到的线条可能让 Twinmap 误报插件太旧，即使两边版本相同。现在 Twinmap 只相信校验通过的线条。
`,
  },
  go: {
    "What's new.": 'settings',
    'Metres.': 'settings',
    'Settings in a window.': 'settings',
    'Layers is now Filters.': 'layers',
  },
} satisfies News
