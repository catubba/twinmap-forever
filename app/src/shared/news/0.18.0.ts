// What's new of 0.18.0 in the other languages of the app: the section of CHANGELOG.md, entry by entry in the same order.
import type { News } from '../news'

export default {
  langs: {
    frFR: `### New

- **Espaces de travail et Modifier la disposition.** Les onglets en haut sont maintenant des espaces de travail, chacun une disposition de panneaux que Twinmap garde : Carte, Personnage et Hôtel des ventes pour commencer, ouverts avec Ctrl et 1 à 6. Cliquez sur Modifier la disposition, l’icône après les onglets (ou Ctrl+E), pour glisser les panneaux côte à côte, les empiler ou les grouper en onglets, en ajouter depuis une liste et fermer ceux dont vous n’avez pas besoin. Créez jusqu’à six espaces de travail à vous avec +, renommez-en un d’un double clic et glissez-le pour le déplacer. Réinitialiser cet espace de travail et Rétablir les espaces de travail par défaut les remettent comme au début.
- **Métiers, Grimoire et Talents.** L’espace de travail Personnage les a en panneaux à côté d’Inventaire : le niveau et les recettes de chacun de vos métiers, le grimoire du jeu onglet par onglet, et les arbres de talents de votre classe avec les talents choisis. Chaque sort et chaque talent montre l’infobulle du jeu.
- **Maintenant, un bloc à la fois.** Prochaine étape, Attention, Mes repères, Quêtes, À proximité et Expérience peuvent chacun aller dans un panneau à part. L’Hôtel des ventes est aussi en panneaux : sa recherche, l’objet, Mes objets et les alertes.
- **Liste de courses.** Ajoutez une recette avec le + de la fenêtre d’un maître de métier, ou un objet avec le + de la recherche. La liste dit ce qui manque et où le trouver (un autre de vos personnages, le marchand le plus proche et son prix, la recette qui le fabrique, qui le laisse tomber) et ce que coûte le tout, et elle suit vos sacs et votre banque pendant que vous jouez. Merci à Stalioot.
- **Bateaux et zeppelins.** Chaque quai a son bateau ou son zeppelin sur la carte : cliquez dessus pour voir son trajet et où il va, de l’autre côté de la mer aussi. Affichez-les ou masquez-les avec Bateaux et zeppelins dans Filtres de la carte. Merci à Stalioot.
- **Votre flèche, votre couleur.** Options, Apparence, Flèche : n’importe quelle couleur et une taille de 75 % à 200 %, sur la carte 2D et dans la vue 3D. Merci à Stalioot.
- **L’app Mac en téléchargement.** Chaque version a maintenant l’app Mac à côté de l’installateur Windows, sur GitHub et sur twinmap.app. Merci à markus-barta.
- **Huit boss de plus sur les cartes des donjons.** Huit boss qui n’avaient pas de repère sur la carte de leur donjon en ont maintenant un, là où les joueurs qui partagent leurs données les ont tués.

### Changed

- **Objets devient Personnage.** Sacs, Banque et Inventaire sont des panneaux de l’espace de travail Personnage.
- **Objectifs de quête par type.** Les objectifs proches qui demandent la même chose forment un seul repère, dessiné selon ce qu’ils demandent, avec le nombre de quêtes dans son coin. Pointez une quête dans Quêtes, dans Maintenant, pour garder ses repères allumés et atténuer les autres. Merci à Stalioot.
- **Une carte cachée se repose.** La carte arrête de se dessiner quand aucun espace de travail ne l’affiche.
- **Moins de mauvaises positions dans les donjons.** Une position trouvée de zéro est abandonnée quand les salles que le jeu dessine toujours depuis là ne sont pas sur la minicarte.

### Fixed

- **Votre flèche dans les donjons.** Depuis la 0.17.0, rester immobile quelques secondes dans un donjon pouvait faire lire à Twinmap la mauvaise partie de l’écran et perdre votre personnage. Twinmap lit de nouveau la minicarte.
- **Le menu Filtres sur une carte basse.** Il reste dans la carte, quelle que soit la hauteur de son panneau.
`,
    deDE: `### New

- **Arbeitsbereiche und Anordnung bearbeiten.** Die Reiter oben sind jetzt Arbeitsbereiche, jeder eine Anordnung von Panels, die Twinmap behält: zu Beginn Karte, Charakter und Auktionshaus, geöffnet mit Strg und 1 bis 6. Klicke auf Anordnung bearbeiten, das Symbol nach den Reitern (oder Strg+E), um Panels nebeneinander zu ziehen, zu stapeln oder als Reiter zu gruppieren, neue aus einer Liste hinzuzufügen und die zu schließen, die du nicht brauchst. Lege mit + bis zu sechs eigene Arbeitsbereiche an, benenne einen per Doppelklick um und ziehe ihn, um ihn zu verschieben. Diesen Arbeitsbereich zurücksetzen und Standard-Arbeitsbereiche wiederherstellen stellen sie wieder her, wie sie waren.
- **Berufe, Zauberbuch und Talente.** Der Arbeitsbereich Charakter hat sie als Panels neben Inventar: Stufe und Rezepte jedes deiner Berufe, das Zauberbuch des Spiels Reiter für Reiter und die Talentbäume deiner Klasse mit den gewählten Talenten. Jeder Zauber und jedes Talent zeigt den Tooltip des Spiels.
- **Jetzt, Block für Block.** Nächster Wegpunkt, Achtung, Meine Markierungen, Quests, In der Nähe und Erfahrung können jeweils in ein eigenes Panel. Auch das Auktionshaus ist in Panels: seine Suche, der Gegenstand, Meine Gegenstände und die Alarme.
- **Einkaufsliste.** Füge ein Rezept mit dem + im Fenster eines Berufslehrers hinzu oder einen Gegenstand mit dem + der Suche. Die Liste sagt, was fehlt und wo du es bekommst (ein anderer deiner Charaktere, der nächste Händler und sein Preis, das Rezept, das es herstellt, wer es fallen lässt) und was alles zusammen kostet, und sie folgt deinen Taschen und deiner Bank, während du spielst. Danke an Stalioot.
- **Schiffe und Zeppeline.** Jeder Anleger hat sein Schiff oder seinen Zeppelin auf der Karte: Klicke darauf, um seine Route zu sehen und wohin es fährt, auch über das Meer. Mit Schiffe und Zeppeline in Kartenfilter blendest du sie ein oder aus. Danke an Stalioot.
- **Dein Pfeil, deine Farbe.** Optionen, Darstellung, Pfeil: jede Farbe und eine Größe von 75 % bis 200 %, auf der 2D-Karte und in der 3D-Ansicht. Danke an Stalioot.
- **Die Mac-App zum Herunterladen.** Jede Version hat jetzt die Mac-App neben dem Windows-Installer, auf GitHub und auf twinmap.app. Danke an markus-barta.
- **Acht weitere Bosse auf den Dungeonkarten.** Acht Bosse, die auf der Karte ihres Dungeons keine Markierung hatten, haben jetzt eine, dort, wo Spieler, die ihre Daten teilen, sie getötet haben.

### Changed

- **Inventar wird zu Charakter.** Taschen, Bank und Inventar sind Panels des Arbeitsbereichs Charakter.
- **Questziele nach Art.** Nahe Ziele, die dasselbe verlangen, sind eine einzige Markierung, gezeichnet nach dem, was sie verlangen, mit der Zahl der Quests in ihrer Ecke. Zeige auf eine Quest in Quests, in Jetzt, damit ihre Markierungen hell bleiben und die anderen gedämpft werden. Danke an Stalioot.
- **Eine verborgene Karte ruht.** Die Karte hört auf zu zeichnen, solange kein Arbeitsbereich sie zeigt.
- **Weniger falsche Orte in Dungeons.** Ein neu gefundener Ort wird verworfen, wenn Räume, die das Spiel von dort immer zeichnet, nicht auf der Minikarte sind.

### Fixed

- **Dein Pfeil in Dungeons.** Seit 0.17.0 konnte Twinmap, wenn du in einem Dungeon ein paar Sekunden stillstandest, den falschen Teil des Bildschirms lesen und deinen Charakter verlieren. Es liest wieder die Minikarte.
- **Das Filtermenü auf einer niedrigen Karte.** Es bleibt in der Karte, wie niedrig ihr Panel auch ist.
`,
    esES: `### New

- **Espacios de trabajo y Editar disposición.** Las pestañas de arriba son ahora espacios de trabajo, cada uno una disposición de paneles que Twinmap guarda: Mapa, Personaje y Casa de subastas para empezar, que se abren con Ctrl y del 1 al 6. Haz clic en Editar disposición, el icono tras las pestañas (o pulsa Ctrl+E), para arrastrar paneles uno junto a otro, apilarlos o agruparlos como pestañas, añadir paneles de una lista y cerrar los que no necesites. Crea hasta seis espacios de trabajo propios con +, cambia el nombre de uno con un doble clic y arrástralo para moverlo. Restablecer este espacio de trabajo y Restaurar los espacios de trabajo predeterminados los dejan como al principio.
- **Profesiones, Libro de hechizos y Talentos.** El espacio de trabajo Personaje los tiene como paneles junto a Inventario: el nivel y las recetas de cada una de tus profesiones, el libro de hechizos del juego pestaña a pestaña y los árboles de talentos de tu clase con los talentos elegidos. Cada hechizo y cada talento muestra el mensaje de ayuda del juego.
- **Ahora, bloque a bloque.** Siguiente parada, Atención, Mis marcas, Misiones, Alrededores y Experiencia pueden ir cada uno a un panel propio. La Casa de subastas también está en paneles: su búsqueda, el objeto, Mis objetos y las alertas.
- **Lista de la compra.** Añade una receta con el + de la ventana de un instructor de profesión, o un objeto con el + de la búsqueda. La lista dice lo que falta y dónde conseguirlo (otro de tus personajes, el vendedor más cercano y su precio, la receta que lo fabrica, quién lo suelta) y cuánto cuesta comprarlo todo, y sigue tus bolsas y tu banco mientras juegas. Gracias a Stalioot.
- **Barcos y zepelines.** Cada muelle tiene su barco o su zepelín en el mapa: haz clic en uno para ver su ruta y adónde va, también al otro lado del mar. Muéstralos u ocúltalos con Barcos y zepelines en Filtros del mapa. Gracias a Stalioot.
- **Tu flecha, tu color.** Opciones, Apariencia, Flecha: cualquier color y un tamaño del 75 % al 200 %, en el mapa 2D y en la vista 3D. Gracias a Stalioot.
- **La app para Mac, para descargar.** Cada versión tiene ahora la app para Mac junto al instalador de Windows, en GitHub y en twinmap.app. Gracias a markus-barta.
- **Ocho jefes más en los mapas de mazmorras.** Ocho jefes que no tenían marca en el mapa de su mazmorra ya tienen una, donde los jugadores que comparten datos los mataron.

### Changed

- **Objetos pasa a ser Personaje.** Bolsas, Banco e Inventario son paneles del espacio de trabajo Personaje.
- **Objetivos de misión por tipo.** Los objetivos cercanos que piden lo mismo son una sola marca, dibujada según lo que piden, con el número de misiones en su esquina. Señala una misión en Misiones, en Ahora, para mantener sus marcas encendidas y atenuar las demás. Gracias a Stalioot.
- **Un mapa oculto descansa.** El mapa deja de dibujarse mientras ningún espacio de trabajo lo muestra.
- **Menos lugares equivocados en mazmorras.** Un lugar encontrado de nuevo se descarta cuando las salas que el juego siempre dibuja desde allí no están en el minimapa.

### Fixed

- **Tu flecha dentro de las mazmorras.** Desde la 0.17.0, quedarte quieto unos segundos en una mazmorra podía hacer que Twinmap leyera la parte equivocada de la pantalla y perdiera a tu personaje. Vuelve a leer el minimapa.
- **El menú Filtros en un mapa bajo.** Se queda dentro del mapa por baja que sea su panel.
`,
    esMX: `### New

- **Espacios de trabajo y Editar disposición.** Las pestañas de arriba ahora son espacios de trabajo, cada uno una disposición de paneles que Twinmap guarda: Mapa, Personaje y Casa de subastas para empezar, que se abren con Ctrl y del 1 al 6. Haz clic en Editar disposición, el ícono después de las pestañas (o presiona Ctrl+E), para arrastrar paneles uno junto a otro, apilarlos o agruparlos como pestañas, agregar paneles de una lista y cerrar los que no necesites. Crea hasta seis espacios de trabajo propios con +, cambia el nombre de uno con un doble clic y arrástralo para moverlo. Restablecer este espacio de trabajo y Restaurar los espacios de trabajo predeterminados los dejan como al principio.
- **Profesiones, Libro de hechizos y Talentos.** El espacio de trabajo Personaje los tiene como paneles junto a Inventario: el nivel y las recetas de cada una de tus profesiones, el libro de hechizos del juego pestaña por pestaña y los árboles de talentos de tu clase con los talentos elegidos. Cada hechizo y cada talento muestra la descripción emergente del juego.
- **Ahora, bloque por bloque.** Próxima parada, Atención, Mis marcadores, Misiones, Alrededores y Experiencia pueden ir cada uno a un panel propio. La Casa de subastas también está en paneles: su búsqueda, el objeto, Mis objetos y las alertas.
- **Lista de compras.** Agrega una receta con el + de la ventana de un instructor de profesión, o un objeto con el + de la búsqueda. La lista dice lo que falta y dónde conseguirlo (otro de tus personajes, el vendedor más cercano y su precio, la receta que lo fabrica, quién lo suelta) y cuánto cuesta comprarlo todo, y sigue tus bolsas y tu banco mientras juegas. Gracias a Stalioot.
- **Barcos y zepelines.** Cada muelle tiene su barco o su zepelín en el mapa: haz clic en uno para ver su ruta y a dónde va, también al otro lado del mar. Muéstralos u ocúltalos con Barcos y zepelines en Filtros del mapa. Gracias a Stalioot.
- **Tu flecha, tu color.** Opciones, Apariencia, Flecha: cualquier color y un tamaño del 75 % al 200 %, en el mapa 2D y en la vista 3D. Gracias a Stalioot.
- **La app para Mac, para descargar.** Cada versión ahora tiene la app para Mac junto al instalador de Windows, en GitHub y en twinmap.app. Gracias a markus-barta.
- **Ocho jefes más en los mapas de calabozos.** Ocho jefes que no tenían marcador en el mapa de su calabozo ya tienen uno, donde los jugadores que comparten datos los mataron.

### Changed

- **Objetos ahora es Personaje.** Bolsas, Banco e Inventario son paneles del espacio de trabajo Personaje.
- **Objetivos de misión por tipo.** Los objetivos cercanos que piden lo mismo son un solo marcador, dibujado según lo que piden, con el número de misiones en su esquina. Apunta a una misión en Misiones, en Ahora, para mantener sus marcadores encendidos y atenuar los demás. Gracias a Stalioot.
- **Un mapa oculto descansa.** El mapa deja de dibujarse mientras ningún espacio de trabajo lo muestra.
- **Menos lugares equivocados en calabozos.** Un lugar encontrado de nuevo se descarta cuando las salas que el juego siempre dibuja desde ahí no están en el minimapa.

### Fixed

- **Tu flecha dentro de los calabozos.** Desde la 0.17.0, quedarte quieto unos segundos en un calabozo podía hacer que Twinmap leyera la parte equivocada de la pantalla y perdiera a tu personaje. Vuelve a leer el minimapa.
- **El menú Filtros en un mapa bajo.** Se queda dentro del mapa por bajo que sea su panel.
`,
    ruRU: `### New

- **Рабочие области и Изменить расположение.** Вкладки вверху теперь рабочие области, каждая со своим расположением панелей, которое Twinmap сохраняет: для начала Карта, Персонаж и Аукцион, они открываются клавишами Ctrl и 1-6. Нажмите Изменить расположение, значок после вкладок (или Ctrl+E), чтобы перетаскивать панели рядом друг с другом, ставить их одну над другой или собирать во вкладки, добавлять панели из списка и закрывать ненужные. Создайте до шести своих рабочих областей кнопкой +, переименуйте область двойным щелчком и перетащите её, чтобы переместить. Сбросить эту рабочую область и Восстановить рабочие области по умолчанию возвращают их к началу.
- **Профессии, Книга заклинаний и Таланты.** В рабочей области Персонаж они стоят панелями рядом с Инвентарём: уровень и рецепты каждой вашей профессии, книга заклинаний игры по вкладкам и деревья талантов вашего класса с выбранными талантами. У каждого заклинания и таланта своя подсказка из игры.
- **Сейчас по блокам.** Следующая остановка, Внимание, Мои точки, Задания, Рядом и Опыт можно вынести каждый в отдельную панель. Аукцион тоже в панелях: его поиск, предмет, Мои предметы и оповещения.
- **Список покупок.** Добавьте рецепт кнопкой + в окне учителя профессии или предмет кнопкой + в поиске. Список показывает, чего не хватает и где это взять (у другого вашего персонажа, у ближайшего торговца и по какой цене, по какому рецепту это делается, кто это роняет) и сколько стоит купить всё, и следит за вашими сумками и банком во время игры. Спасибо Stalioot.
- **Корабли и дирижабли.** У каждой пристани на карте свой корабль или дирижабль: нажмите на него, чтобы увидеть путь и куда он идёт, в том числе за море. Включайте и выключайте их пунктом Корабли и дирижабли в Фильтрах карты. Спасибо Stalioot.
- **Ваша стрелка, ваш цвет.** Параметры, Внешний вид, Стрелка: любой цвет и размер от 75 % до 200 %, на 2D-карте и в 3D-виде. Спасибо Stalioot.
- **Приложение для Mac для загрузки.** В каждой версии теперь есть приложение для Mac рядом с установщиком для Windows, на GitHub и на twinmap.app. Спасибо markus-barta.
- **Ещё восемь боссов на картах подземелий.** Восемь боссов, у которых не было точки на карте их подземелья, теперь её получили там, где их убивали игроки, делящиеся данными.

### Changed

- **Предметы стали Персонажем.** Сумки, Банк и Инвентарь теперь панели рабочей области Персонаж.
- **Цели заданий по видам.** Близкие цели, которые требуют одного и того же, теперь одна точка, нарисованная по тому, что они требуют, с числом заданий в углу. Наведите указатель на задание в Заданиях, в Сейчас, чтобы его точки остались яркими, а остальные приглушились. Спасибо Stalioot.
- **Скрытая карта отдыхает.** Карта перестаёт рисоваться, пока её не показывает ни одна рабочая область.
- **Меньше неверных мест в подземельях.** Место, найденное заново, отбрасывается, если комнат, которые игра оттуда всегда рисует, нет на миникарте.

### Fixed

- **Ваша стрелка в подземельях.** С версии 0.17.0, если постоять несколько секунд на месте в подземелье, Twinmap мог читать не ту часть экрана и терять вашего персонажа. Теперь он снова читает миникарту.
- **Меню Фильтры на низкой карте.** Оно остаётся внутри карты, какой бы низкой ни была её панель.
`,
    koKR: `### New

- **작업 공간과 배치 편집.** 위쪽 탭은 이제 작업 공간이며, 각각 Twinmap이 저장하는 패널 배치입니다. 처음에는 지도, 캐릭터, 경매장이 있고 Ctrl과 1~6으로 엽니다. 탭 뒤의 아이콘인 배치 편집을 클릭하거나 Ctrl+E를 누르면 패널을 나란히 끌어 놓거나, 쌓거나, 탭으로 묶고, 목록에서 패널을 추가하고, 필요 없는 패널을 닫을 수 있습니다. +로 나만의 작업 공간을 여섯 개까지 만들고, 두 번 클릭해 이름을 바꾸고, 끌어서 옮길 수 있습니다. 이 작업 공간 초기화와 기본 작업 공간 복원으로 처음 상태로 되돌릴 수 있습니다.
- **전문 기술, 마법책, 특성.** 캐릭터 작업 공간에서 소지품 옆에 패널로 있습니다. 각 전문 기술의 숙련도와 제조법, 게임의 마법책을 탭별로, 그리고 내 직업의 특성 트리와 찍은 특성을 보여 줍니다. 모든 주문과 특성에 게임과 같은 툴팁이 나옵니다.
- **현재를 블록별로.** 다음 경유지, 주의, 내 핀, 퀘스트, 주변, 경험치를 각각 따로 패널에 둘 수 있습니다. 경매장도 패널로 나뉩니다. 검색, 아이템, 내 아이템, 알림입니다.
- **구매 목록.** 전문 기술 상급자 창의 +로 제조법을, 검색의 +로 아이템을 추가하세요. 목록은 무엇이 부족하고 어디서 구할 수 있는지(내 다른 캐릭터, 가장 가까운 상인과 가격, 그것을 만드는 제조법, 그것을 떨어뜨리는 대상)와 전부 사는 데 드는 비용을 알려 주고, 플레이하는 동안 가방과 은행을 따라갑니다. Stalioot에게 감사합니다.
- **배와 비행선.** 모든 선착장에 배나 비행선이 지도에 표시됩니다. 클릭하면 항로와 목적지가 보이고, 바다 건너편도 보입니다. 지도 필터의 배와 비행선으로 켜고 끕니다. Stalioot에게 감사합니다.
- **내 화살표, 내 색.** 설정, 모양, 화살표: 아무 색이나, 크기는 75%에서 200%까지, 2D 지도와 3D 보기에서 모두 적용됩니다. Stalioot에게 감사합니다.
- **Mac 앱 다운로드.** 이제 모든 버전에 Windows 설치 프로그램 옆에 Mac 앱이 있습니다. GitHub와 twinmap.app에서 받을 수 있습니다. markus-barta에게 감사합니다.
- **던전 지도에 우두머리 8명 추가.** 던전 지도에 핀이 없던 우두머리 8명에게 이제 핀이 있습니다. 데이터를 공유하는 플레이어들이 처치한 곳에 표시됩니다.

### Changed

- **아이템은 이제 캐릭터입니다.** 가방, 은행, 소지품은 캐릭터 작업 공간의 패널입니다.
- **종류별 퀘스트 목표.** 서로 가깝고 같은 것을 요구하는 목표는 요구하는 내용에 따라 그려진 핀 하나가 되고, 모서리에 퀘스트 수가 표시됩니다. 현재의 퀘스트에서 퀘스트를 가리키면 그 핀은 밝게 남고 나머지는 흐려집니다. Stalioot에게 감사합니다.
- **숨겨진 지도는 쉽니다.** 어떤 작업 공간에도 지도가 보이지 않는 동안에는 지도를 그리지 않습니다.
- **던전에서 잘못된 위치 감소.** 새로 찾은 위치는 게임이 그곳에서 항상 그리는 방이 미니맵에 없으면 버립니다.

### Fixed

- **던전 안의 내 화살표.** 0.17.0부터 던전에서 몇 초 동안 가만히 서 있으면 Twinmap이 화면의 엉뚱한 부분을 읽어 캐릭터를 놓칠 수 있었습니다. 이제 다시 미니맵을 읽습니다.
- **낮은 지도의 필터 메뉴.** 패널이 아무리 낮아도 지도 안에 머뭅니다.
`,
    zhCN: `### New

- **工作区与编辑布局。** 顶部的标签页现在是工作区，每个都是 Twinmap 会保存的一种面板布局：一开始有地图、角色和拍卖行，用 Ctrl 加 1 到 6 打开。点击标签页后面的图标编辑布局（或按 Ctrl+E），即可把面板拖到彼此旁边、上下叠放或合成标签页，从列表中添加面板，并关闭不需要的面板。用 + 最多创建六个自己的工作区，双击可重命名，拖动可移动。重置此工作区和恢复默认工作区会把它们恢复原样。
- **专业、法术书和天赋。** 角色工作区把它们作为面板放在物品栏旁边：你每个专业的等级和配方、按标签页排列的游戏法术书，以及你职业的天赋树和已选天赋。每个法术和天赋都显示游戏自己的鼠标提示。
- **当前，一块一块来。** 下一个途经点、注意、我的标记、任务、附近和经验值都可以各自放进一个面板。拍卖行也分成了面板：搜索、物品、我的物品和提醒。
- **购物清单。** 在专业训练师窗口里用 + 添加配方，或在搜索里用 + 添加物品。清单会告诉你缺什么、去哪里获得（你的其他角色、最近的商人及其价格、制作它的配方、掉落它的怪物），以及全部买下要花多少钱，并在你游戏时跟随你的背包和银行。感谢 Stalioot。
- **船只和飞艇。** 每个码头在地图上都有自己的船或飞艇：点击它可以看到航线和目的地，跨海的也可以。在地图筛选里用船只和飞艇来显示或隐藏它们。感谢 Stalioot。
- **你的箭头，你的颜色。** 设置、外观、箭头：任意颜色，大小从 75% 到 200%，在 2D 地图和 3D 视图中都生效。感谢 Stalioot。
- **Mac 应用可以下载了。** 现在每个版本都在 Windows 安装程序旁边附带 Mac 应用，可在 GitHub 和 twinmap.app 下载。感谢 markus-barta。
- **地下城地图上又多了八个首领。** 八个在地下城地图上没有标记的首领现在有了标记，位置是分享数据的玩家击杀它们的地方。

### Changed

- **物品改为角色。** 背包、银行和物品栏现在是角色工作区的面板。
- **按类型归并的任务目标。** 彼此靠近、要求相同的目标合成一个标记，按要求的内容绘制，角上显示任务数量。在当前的任务中指向一个任务，它的标记保持高亮，其他的变暗。感谢 Stalioot。
- **隐藏的地图会休息。** 没有任何工作区显示地图时，地图停止绘制。
- **地下城中错误位置更少。** 新找到的位置，如果游戏从那里总会绘制的房间不在小地图上，就会被放弃。

### Fixed

- **地下城里的箭头。** 从 0.17.0 起，在地下城里静止几秒可能让 Twinmap 读取屏幕的错误位置并丢失你的角色。现在它会重新读取小地图。
- **矮地图上的筛选菜单。** 无论面板多矮，它都留在地图内。
`,
  },
  go: {
    'Professions, Spellbook and Talents.': 'items',
    'Now, a block at a time.': 'now',
    'Shopping list.': 'now',
    'Ships and zeppelins.': 'layers',
    'Your arrow, your colour.': 'settings',
    'Items is now Character.': 'items',
  },
} satisfies News
