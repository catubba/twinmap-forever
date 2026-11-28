// What's new of 1.0.0 in the other languages of the app: the section of CHANGELOG.md, entry by entry in the same order.
import type { News } from '../news'

export default {
  langs: {
    frFR: `### New

- **Graphismes, un nouvel onglet des Options.** Tout ce que dessine la vue 3D y a son interrupteur : Bâtiments, Arbres (Peu, Quelques-uns ou Beaucoup), Objets, Texture du sol de près, Jour et nuit et Donjon 3D (expérimental), chacun avec ce qu’il coûte en mémoire de la carte graphique, et le total en dessous. Qualité les règle tous d’un coup, Basse, Moyenne ou Haute : un PC avec une carte graphique démarre en Haute, un téléphone, une tablette ou un PC sans carte en Basse. Quand la vue 3D reste lente, une ligne sur la carte propose la qualité en dessous ; si la carte graphique manque de mémoire, Twinmap passe seul en Basse et le dit. Utiliser l’accélération matérielle a quitté Général pour cet onglet.
- **Apparence, l’aspect de votre carte.** Nouveau dans Options, Apparence : Carte 2D dessine la carte avec les images de la minicarte du jeu, ou comme la Carte du monde du jeu, chaque zone telle qu’explorée et cousue à la suivante, les villes de près. Apparence garde le reste de l’aspect de Twinmap : le côté de la carte, la couleur et la taille de votre flèche, les icônes de la carte et les objectifs en zones. Merci à Stalioot.
- **Le monde du jeu en 3D.** La vue 3D dessine ce que dessine le jeu, avec ses propres fichiers sur votre PC, sans rien télécharger : les bâtiments jusqu’au continent entier, qui sortent du sol à mesure qu’ils se chargent ; Forgefer, Fossoyeuse et les grottes sous terre, ouvertes au-dessus de leur sol ; les arbres, éclaircis pour que les routes se voient, et les clôtures, chariots, lampes et tentes ; l’eau des canaux de Hurlevent et la lave de Forgefer ; de près, le sol du jeu lui-même. À Hurlevent et à Orgrimmar, votre flèche et les repères se tiennent sur les rues. La lumière suit l’heure de la journée du jeu et les fenêtres s’allument la nuit ; faites glisser l’anneau sous le nom de la zone pour déplacer le soleil.
- **Donjons et raids en 3D (expérimental).** Cochez Donjon 3D (expérimental) dans Options, Graphismes, et le bouton 3D fonctionne aussi dans les donjons et les raids : leurs salles ouvertes par le haut, votre flèche et les repères à l’étage où ils se trouvent. C’est encore en construction et peut être faux ou lent.
- **Niveau des zones.** Cochez Niveau des zones dans Filtres, Monde, et chaque zone de la carte 2D se teinte selon ses niveaux face à ceux de votre personnage, dans les couleurs du jeu : rouge, orange, jaune, vert, puis gris quand elle ne rapporte plus d’EXP. Merci à Stalioot.
- **Le chemin d’un donjon.** Dans un donjon ou un raid, le bouton Itinéraire à côté de son nom trace le chemin habituel, de l’entrée au dernier boss, les boss numérotés dans l’ordre. Les itinéraires viennent de Forever Dungeon Routes.
- **Toutes les portes d’un donjon.** La carte du monde montre maintenant la porte arrière d’Uldaman, les portes violette et orange de Maraudon et une porte pour chaque aile de Hache-tripes. Merci à Stalioot.
- **Des maîtres dans les donjons.** Le maître d’Enchantement du plus haut rang, à Uldaman, et un maître de Cuisine, dans les Souilles de Tranchebauge, sont sur la carte de leur donjon, et la recherche les trouve. La recherche trouve aussi tout maître de métier par son métier et son rang, en anglais : essayez « artisan enchanting ». Merci à Stalioot.

### Changed

- **Les objectifs de quête de plus loin.** Les objectifs apparaissent maintenant dès le même zoom que les quêtes à prendre.
- **Les métiers dans un panneau étroit.** Les métiers du haut ne prennent que la place qu’il leur faut : ils s’affichent tous et les recettes ont le reste. Merci à Stalioot.
- **Linux : plus de FUSE 2.** L’AppImage n’a plus besoin de FUSE 2. Merci à lkshrk.
- **Linux : pourquoi le jeu n’est pas vu.** Quand Twinmap ne peut pas lire le jeu, twinmap.log dit pourquoi ; quand le jeu n’a pas de fenêtre sur l’écran X (le pilote Wayland de Wine, un gamescope à lui), Twinmap le dit, avec ce qu’il faut désactiver. Merci à markus-barta.

### Fixed

- **Les noms de zone aux bords.** Un point porte le nom de la zone de la terre sous lui, pas celui d’une carte plus grande qui le recouvre : les portes de Hache-tripes sont en Féralas, pas en Mulgore. Merci à Stalioot.
- **Les lignes de vol en 3D.** Elles s’incurvent en douceur d’un maître de vol à l’autre, sans pics au-dessus des montagnes et de Fossoyeuse.
- **Les métiers en chinois.** Deux en-têtes de recettes du même nom n’arrêtent plus la carte et la flèche.
- **Shortest Path en russe.** Un long nom de quête en cyrillique ne fait plus perdre l’itinéraire.`,
    deDE: `### New

- **Grafik, ein neuer Reiter der Optionen.** Alles, was die 3D-Ansicht zeichnet, hat hier einen Schalter: Gebäude, Bäume (Wenige, Einige oder Viele), Objekte, Bodentextur aus der Nähe, Tag und Nacht und 3D-Dungeon (experimentell), jeweils mit dem, was es an Grafikkartenspeicher kostet, und der Summe darunter. Qualität stellt alle auf einmal ein, Niedrig, Mittel oder Hoch: Ein PC mit Grafikkarte startet auf Hoch, ein Handy, ein Tablet oder ein PC ohne Grafikkarte auf Niedrig. Bleibt die 3D-Ansicht langsam, schlägt eine Zeile auf der Karte die Qualität darunter vor; geht der Grafikkarte der Speicher aus, stellt Twinmap selbst auf Niedrig und sagt es. Hardwarebeschleunigung verwenden ist von Allgemein hierher gezogen.
- **Darstellung, das Aussehen deiner Karte.** Neu in Optionen, Darstellung: 2D-Karte zeichnet die Karte aus den Bildern der Minikarte des Spiels oder als die Weltkarte des Spiels selbst, jede Zone wie erkundet und an die nächste genäht, die Städte aus der Nähe. Darstellung behält den Rest des Aussehens von Twinmap: die Seite der Karte, Farbe und Größe deines Pfeils, die Kartensymbole und die Questziele als Bereiche. Danke an Stalioot.
- **Die Welt des Spiels in 3D.** Die 3D-Ansicht zeichnet, was das Spiel zeichnet, aus seinen eigenen Dateien auf deinem PC, ohne Download: die Gebäude bis zum ganzen Kontinent, die beim Laden aus dem Boden wachsen; Ironforge, Undercity und die Höhlen unter der Erde, über ihrem Boden aufgeschnitten; die Bäume, ausgedünnt, damit die Wege zu sehen sind, und die Zäune, Karren, Lampen und Zelte; das Wasser in den Kanälen von Stormwind und die Lava in Ironforge; aus der Nähe den Boden des Spiels selbst. In Stormwind und Orgrimmar stehen dein Pfeil und die Marker auf den Straßen. Das Licht folgt der Tageszeit des Spiels und nachts leuchten die Fenster; zieh den Ring unter dem Namen der Zone, um die Sonne zu bewegen.
- **Dungeons und Schlachtzüge in 3D (experimentell).** Setze den Haken bei 3D-Dungeon (experimentell) in Optionen, Grafik, und der 3D-Knopf funktioniert auch in Dungeons und Schlachtzügen: ihre Räume von oben offen, dein Pfeil und die Marker auf der Etage, auf der sie stehen. Es ist noch im Bau und kann falsch oder langsam sein.
- **Zonenstufen.** Setze den Haken bei Zonenstufen in Filter, Welt, und jede Zone der 2D-Karte wird nach ihren Stufen im Vergleich zu deinem Charakter gefärbt, in den Farben des Spiels: rot, orange, gelb, grün und grau, sobald sie keine EP mehr gibt. Danke an Stalioot.
- **Der Weg durch einen Dungeon.** In einem Dungeon oder Schlachtzug zeichnet der Knopf Route neben seinem Namen den üblichen Weg hindurch, vom Eingang bis zum letzten Boss, die Bosse der Reihe nach nummeriert. Die Routen stammen aus Forever Dungeon Routes.
- **Jede Tür eines Dungeons.** Die Weltkarte zeigt jetzt die Hintertür von Uldaman, die violette und die orange Tür von Maraudon und eine Tür für jeden Flügel von Düsterbruch. Danke an Stalioot.
- **Lehrer in Dungeons.** Der Lehrer für den höchsten Rang der Verzauberkunst in Uldaman und ein Lehrer für Kochkunst in den Hügeln von Razorfen stehen auf der Karte ihres Dungeons, und die Suche findet sie. Die Suche findet außerdem jeden Berufsausbilder nach Beruf und Rang, auf Englisch: Versuch „artisan enchanting“. Danke an Stalioot.

### Changed

- **Questziele von weiter weg.** Questziele erscheinen jetzt ab demselben Zoom wie die annehmbaren Quests.
- **Berufe in einem schmalen Panel.** Die Berufe oben nehmen nur den Platz, den sie brauchen: Alle sind zu sehen und die Rezepte bekommen den Rest. Danke an Stalioot.
- **Linux: kein FUSE 2.** Das AppImage braucht kein FUSE 2 mehr. Danke an lkshrk.
- **Linux: warum das Spiel nicht gesehen wird.** Kann Twinmap das Spiel nicht lesen, steht in twinmap.log, warum; hat das Spiel kein Fenster auf dem X-Display (der Wayland-Treiber von Wine, ein eigenes gamescope), sagt Twinmap das und was abzuschalten ist. Danke an markus-barta.

### Fixed

- **Zonennamen an den Rändern.** Ein Punkt heißt nach der Zone des Landes unter ihm, nicht nach einer größeren Karte, die darüber reicht: Die Türen von Düsterbruch liegen in Feralas, nicht in Mulgore. Danke an Stalioot.
- **Fluglinien in 3D.** Sie biegen sich gleichmäßig von einem Flugmeister zum anderen, ohne Zacken über den Bergen und Undercity.
- **Berufe auf Chinesisch.** Zwei Rezeptüberschriften mit gleichem Namen halten Karte und Pfeil nicht mehr an.
- **Shortest Path auf Russisch.** Ein langer Questname in kyrillischer Schrift lässt die Route nicht mehr verschwinden.`,
    esES: `### New

- **Gráficos, una pestaña nueva de Opciones.** Todo lo que dibuja la vista 3D tiene aquí su interruptor: Edificios, Árboles (Pocos, Algunos o Muchos), Objetos, Textura del suelo de cerca, Día y noche y Mazmorra 3D (experimental), cada uno con lo que cuesta en memoria de la tarjeta gráfica y el total debajo. Calidad los ajusta todos a la vez, Baja, Media o Alta: un PC con tarjeta gráfica empieza en Alta; un móvil, una tableta o un PC sin tarjeta, en Baja. Cuando la vista 3D va lenta, una línea en el mapa propone la calidad de abajo; si la tarjeta gráfica se queda sin memoria, Twinmap pasa sola a Baja y lo dice. Usar aceleración por hardware ha pasado aquí desde General.
- **Apariencia, el aspecto de tu mapa.** Nuevo en Opciones, Apariencia: Mapa 2D dibuja el mapa con las imágenes del minimapa del juego, o como el propio Mapa del mundo del juego, cada zona tal como se explora y cosida a la siguiente, con las ciudades de cerca. Apariencia guarda el resto del aspecto de Twinmap: el lado del mapa, el color y el tamaño de tu flecha, los iconos del mapa y los objetivos como áreas. Gracias a Stalioot.
- **El mundo del juego en 3D.** La vista 3D dibuja lo que dibuja el juego, con sus propios archivos de tu PC, sin descargar nada: los edificios hasta el continente entero, que salen del suelo a medida que se cargan; Forjaz, Entrañas y las cuevas bajo tierra, abiertas sobre su suelo; los árboles, aclarados para que se vean los caminos, y las vallas, carros, farolas y tiendas; el agua de los canales de Ventormenta y la lava de Forjaz; de cerca, el propio suelo del juego. En Ventormenta y Orgrimmar, tu flecha y los marcadores están sobre las calles. La luz sigue la hora del día del juego y las ventanas se encienden de noche; arrastra el anillo bajo el nombre de la zona para mover el sol.
- **Mazmorras y bandas en 3D (experimental).** Marca Mazmorra 3D (experimental) en Opciones, Gráficos, y el botón 3D funciona también dentro de mazmorras y bandas: sus salas abiertas desde arriba, tu flecha y los marcadores en la planta en la que están. Aún está en construcción y puede fallar o ir lento.
- **Nivel de las zonas.** Marca Nivel de las zonas en Filtros, Mundo, y cada zona del mapa 2D se tiñe según sus niveles frente a los de tu personaje, con los colores del juego: rojo, naranja, amarillo, verde y gris cuando ya no da PE. Gracias a Stalioot.
- **El camino de una mazmorra.** Dentro de una mazmorra o una banda, el botón Ruta junto a su nombre dibuja el camino habitual, de la entrada al último jefe, con los jefes numerados en orden. Las rutas vienen de Forever Dungeon Routes.
- **Todas las puertas de una mazmorra.** El mapa del mundo muestra ahora la puerta trasera de Uldaman, las puertas morada y naranja de Maraudon y una puerta para cada ala de La Masacre. Gracias a Stalioot.
- **Instructores en las mazmorras.** El instructor del rango más alto de Encantamiento, en Uldaman, y un instructor de Cocina, en Zahúrda Rajacieno, están en el mapa de su mazmorra, y la búsqueda los encuentra. La búsqueda también encuentra a cualquier instructor de profesiones por su profesión y su rango, en inglés: prueba «artisan enchanting». Gracias a Stalioot.

### Changed

- **Objetivos de misión desde más lejos.** Los objetivos aparecen ahora desde el mismo zoom que las misiones por aceptar.
- **Profesiones en un panel estrecho.** Las profesiones de arriba ocupan solo el espacio que necesitan: se ven todas y las recetas tienen el resto. Gracias a Stalioot.
- **Linux: sin FUSE 2.** La AppImage ya no necesita FUSE 2. Gracias a lkshrk.
- **Linux: por qué no se ve el juego.** Cuando Twinmap no puede leer el juego, twinmap.log dice por qué; cuando el juego no tiene ventana en la pantalla X (el controlador Wayland de Wine, un gamescope propio), Twinmap lo dice, y qué desactivar. Gracias a markus-barta.

### Fixed

- **Nombres de zona en los bordes.** Un punto lleva el nombre de la zona de la tierra que tiene debajo, no el de un mapa más grande que la cubre: las puertas de La Masacre están en Feralas, no en Mulgore. Gracias a Stalioot.
- **Líneas de vuelo en 3D.** Se curvan suavemente de un maestro de vuelo a otro, sin picos sobre las montañas y Entrañas.
- **Profesiones en chino.** Dos encabezados de recetas con el mismo nombre ya no detienen el mapa y la flecha.
- **Shortest Path en ruso.** Un nombre de misión largo en cirílico ya no hace perder la ruta.`,
    esMX: `### New

- **Gráficos, una pestaña nueva de Opciones.** Todo lo que dibuja la vista 3D tiene aquí su interruptor: Edificios, Árboles (Pocos, Algunos o Muchos), Objetos, Textura del suelo de cerca, Día y noche y Calabozo 3D (experimental), cada uno con lo que cuesta en memoria de la tarjeta gráfica y el total abajo. Calidad los ajusta todos a la vez, Baja, Media o Alta: una PC con tarjeta gráfica empieza en Alta; un celular, una tableta o una PC sin tarjeta, en Baja. Cuando la vista 3D va lenta, una línea en el mapa propone la calidad de abajo; si la tarjeta gráfica se queda sin memoria, Twinmap pasa sola a Baja y lo dice. Usar aceleración por hardware pasó aquí desde General.
- **Apariencia, el aspecto de tu mapa.** Nuevo en Opciones, Apariencia: Mapa 2D dibuja el mapa con las imágenes del minimapa del juego, o como el propio Mapa del mundo del juego, cada zona como se explora y cosida a la siguiente, con las ciudades de cerca. Apariencia guarda el resto del aspecto de Twinmap: el lado del mapa, el color y el tamaño de tu flecha, los iconos del mapa y los objetivos como áreas. Gracias a Stalioot.
- **El mundo del juego en 3D.** La vista 3D dibuja lo que dibuja el juego, con sus propios archivos de tu PC, sin descargar nada: los edificios hasta el continente entero, que salen del suelo conforme se cargan; Forjaz, Entrañas y las cuevas bajo tierra, abiertas sobre su suelo; los árboles, aclarados para que se vean los caminos, y las cercas, carretas, lámparas y tiendas; el agua de los canales de Ventormenta y la lava de Forjaz; de cerca, el propio suelo del juego. En Ventormenta y Orgrimmar, tu flecha y los marcadores están sobre las calles. La luz sigue la hora del día del juego y las ventanas se encienden de noche; arrastra el anillo bajo el nombre de la zona para mover el sol.
- **Calabozos y bandas en 3D (experimental).** Marca Calabozo 3D (experimental) en Opciones, Gráficos, y el botón 3D funciona también dentro de calabozos y bandas: sus salas abiertas desde arriba, tu flecha y los marcadores en el piso en el que están. Todavía está en construcción y puede fallar o ir lento.
- **Nivel de las zonas.** Marca Nivel de las zonas en Filtros, Mundo, y cada zona del mapa 2D se tiñe según sus niveles frente a los de tu personaje, con los colores del juego: rojo, naranja, amarillo, verde y gris cuando ya no da PE. Gracias a Stalioot.
- **El camino de un calabozo.** Dentro de un calabozo o una banda, el botón Ruta junto a su nombre dibuja el camino habitual, de la entrada al último jefe, con los jefes numerados en orden. Las rutas vienen de Forever Dungeon Routes.
- **Todas las puertas de un calabozo.** El mapa del mundo ahora muestra la puerta trasera de Uldaman, las puertas morada y naranja de Maraudon y una puerta para cada ala de La Masacre. Gracias a Stalioot.
- **Instructores en los calabozos.** El instructor del rango más alto de Encantamiento, en Uldaman, y un instructor de Cocina, en Zahúrda Rajacieno, están en el mapa de su calabozo, y la búsqueda los encuentra. La búsqueda también encuentra a cualquier instructor de profesiones por su profesión y su rango, en inglés: prueba «artisan enchanting». Gracias a Stalioot.

### Changed

- **Objetivos de misión desde más lejos.** Los objetivos ahora aparecen desde el mismo zoom que las misiones por aceptar.
- **Profesiones en un panel angosto.** Las profesiones de arriba ocupan solo el espacio que necesitan: se ven todas y las recetas tienen el resto. Gracias a Stalioot.
- **Linux: sin FUSE 2.** La AppImage ya no necesita FUSE 2. Gracias a lkshrk.
- **Linux: por qué no se ve el juego.** Cuando Twinmap no puede leer el juego, twinmap.log dice por qué; cuando el juego no tiene ventana en la pantalla X (el controlador Wayland de Wine, un gamescope propio), Twinmap lo dice, y qué desactivar. Gracias a markus-barta.

### Fixed

- **Nombres de zona en los bordes.** Un punto lleva el nombre de la zona de la tierra que tiene debajo, no el de un mapa más grande que la cubre: las puertas de La Masacre están en Feralas, no en Mulgore. Gracias a Stalioot.
- **Líneas de vuelo en 3D.** Se curvan suavemente de un maestro de vuelo a otro, sin picos sobre las montañas y Entrañas.
- **Profesiones en chino.** Dos encabezados de recetas con el mismo nombre ya no detienen el mapa y la flecha.
- **Shortest Path en ruso.** Un nombre de misión largo en cirílico ya no hace perder la ruta.`,
    ruRU: `### New

- **Графика, новая вкладка параметров.** У всего, что рисует вид 3D, здесь свой переключатель: «Здания», «Деревья» («Мало», «Средне» или «Много»), «Объекты», «Текстура земли вблизи», «День и ночь» и «3D-подземелье (экспериментально)», у каждого указано, сколько памяти видеокарты он занимает, а ниже итог. «Качество» задаёт их все сразу, «Низкое», «Среднее» или «Высокое»: ПК с видеокартой начинает с высокого, телефон, планшет или ПК без видеокарты с низкого. Если вид 3D остаётся медленным, строка на карте предлагает качество ниже; если видеокарте не хватает памяти, Twinmap сам переходит на низкое и сообщает об этом. «Использовать аппаратное ускорение» перенесено сюда из вкладки «Общие».
- **Внешний вид вашей карты.** Новое в параметрах, на вкладке «Внешний вид»: «Карта 2D» рисует карту по картинкам мини-карты игры или как «Карту мира» самой игры, каждую зону исследованной и сшитой со следующей, а города вблизи. «Внешний вид» хранит и остальное оформление Twinmap: сторону карты, цвет и размер вашей стрелки, значки карты и цели в виде областей. Спасибо Stalioot.
- **Мир игры в 3D.** Вид 3D рисует то же, что и игра, по её собственным файлам на вашем ПК, ничего не скачивая: здания вплоть до всего континента, вырастающие из земли по мере загрузки; Стальгорн, Подгород и пещеры под землёй, вскрытые над их полом; деревья, прореженные так, чтобы были видны дороги, а также заборы, повозки, фонари и палатки; воду в каналах Штормграда и лаву в Стальгорне; вблизи настоящую землю игры. В Штормграде и Оргриммаре ваша стрелка и метки стоят на улицах. Свет следует за временем суток игры, а ночью в окнах загорается свет; перетащите кольцо под названием зоны, чтобы сдвинуть солнце.
- **Подземелья и рейды в 3D (экспериментально).** Отметьте «3D-подземелье (экспериментально)» в параметрах, на вкладке «Графика», и кнопка 3D заработает и внутри подземелий и рейдов: их залы открыты сверху, ваша стрелка и метки на том этаже, где они находятся. Это ещё в разработке и может работать неверно или медленно.
- **Уровни зон.** Отметьте «Уровни зон» в «Фильтрах», в разделе «Мир», и каждая зона карты 2D окрасится по своим уровням относительно уровня вашего персонажа, цветами игры: красным, оранжевым, жёлтым, зелёным, а серым, когда она больше не даёт опыта. Спасибо Stalioot.
- **Путь через подземелье.** В подземелье или рейде кнопка «Маршрут» рядом с его названием рисует обычный путь через него, от входа до последнего босса, с боссами по порядку. Маршруты взяты из Forever Dungeon Routes.
- **Все входы подземелья.** Карта мира теперь показывает задний вход в Ульдаман, фиолетовый и оранжевый входы Мародона и вход в каждое крыло Забытого Города. Спасибо Stalioot.
- **Учителя в подземельях.** Учитель высшего ранга наложения чар в Ульдамане и учитель кулинарии в Курганах Иглошкурых есть на карте их подземелья, и поиск их находит. Кроме того, поиск находит любого учителя профессии по профессии и рангу, на английском: попробуйте «artisan enchanting». Спасибо Stalioot.

### Changed

- **Цели заданий видны издалека.** Цели теперь появляются с того же масштаба, что и задания, которые можно взять.
- **Профессии в узкой панели.** Профессии вверху занимают только нужное им место: видны все, а рецептам достаётся остальное. Спасибо Stalioot.
- **Linux: без FUSE 2.** AppImage больше не нужен FUSE 2. Спасибо lkshrk.
- **Linux: почему игра не видна.** Когда Twinmap не может прочитать игру, в twinmap.log сказано почему; когда у игры нет окна на дисплее X (драйвер Wayland у Wine, свой gamescope), Twinmap сообщает об этом и о том, что отключить. Спасибо markus-barta.

### Fixed

- **Названия зон на краях.** Точка называется по зоне земли под ней, а не по большей карте, которая её накрывает: входы Забытого Города находятся в Фераласе, а не в Мулгоре. Спасибо Stalioot.
- **Линии полётов в 3D.** Они плавно изгибаются от одного распорядителя полетов к другому, без пиков над горами и Подгородом.
- **Профессии на китайском.** Два заголовка рецептов с одинаковым названием больше не останавливают карту и стрелку.
- **Shortest Path на русском.** Длинное название задания кириллицей больше не теряет маршрут.`,
    koKR: `### New

- **그래픽, 설정의 새 탭.** 3D 보기가 그리는 모든 것에 여기 스위치가 있습니다: 건물, 나무(적게, 보통, 많이), 사물, 가까운 땅 텍스처, 낮과 밤, 3D 던전 (실험적). 각각 그래픽 카드 메모리를 얼마나 쓰는지 함께 보여 주고, 아래에 합계가 나옵니다. 품질은 이를 한 번에 낮음, 중간, 높음으로 설정합니다. 그래픽 카드가 있는 PC는 높음으로, 휴대폰, 태블릿, 그래픽 카드가 없는 PC는 낮음으로 시작합니다. 3D 보기가 계속 느리면 지도에 한 단계 낮은 품질을 권하는 줄이 나타나고, 그래픽 카드 메모리가 부족해지면 Twinmap이 스스로 낮음으로 바꾸고 알려 줍니다. 하드웨어 가속 사용은 일반에서 이 탭으로 옮겨졌습니다.
- **모양, 내 지도의 모습.** 설정, 모양에 새로 생긴 2D 지도: 게임의 미니맵 그림으로 지도를 그리거나, 게임의 세계 지도 그대로, 모든 지역을 탐험한 모습으로 이웃 지역과 이어 붙여 그리며 도시는 가까이서도 보입니다. 모양에는 Twinmap의 나머지 모습도 그대로 있습니다: 지도의 위치, 화살표의 색과 크기, 지도 아이콘, 영역으로 보는 임무. Stalioot에게 감사합니다.
- **3D로 보는 게임의 세계.** 3D 보기가 PC에 있는 게임 파일로 게임이 그리는 것을 그대로 그리며, 아무것도 내려받지 않습니다: 대륙 전체까지 이어지는 건물이 불러오는 대로 땅에서 솟아오르고, 아이언포지, 언더시티, 땅 밑의 동굴은 바닥 위가 잘려 열려 있으며, 길이 보이도록 솎아 낸 나무와 울타리, 수레, 등불, 천막, 스톰윈드 운하의 물과 아이언포지의 용암, 가까이서는 게임의 땅 그대로가 보입니다. 스톰윈드와 오그리마에서는 화살표와 표시가 거리 위에 섭니다. 빛은 게임 속 하루의 시간을 따르고 밤에는 창문에 불이 켜집니다. 지역 이름 아래의 고리를 끌면 해가 움직입니다.
- **3D로 보는 던전과 공격대 (실험적).** 설정, 그래픽에서 3D 던전 (실험적)을 켜면 던전과 공격대 안에서도 3D 버튼이 작동합니다: 방은 위에서 열려 보이고, 화살표와 표시는 서 있는 층에 놓입니다. 아직 만드는 중이라 틀리거나 느릴 수 있습니다.
- **지역 레벨.** 필터, 세계에서 지역 레벨을 켜면 2D 지도의 모든 지역이 캐릭터 레벨에 비한 지역 레벨에 따라 게임의 색으로 칠해집니다: 빨강, 주황, 노랑, 초록, 그리고 더 이상 경험치를 주지 않으면 회색. Stalioot에게 감사합니다.
- **던전을 지나는 길.** 던전이나 공격대 안에서 이름 옆의 경로 버튼을 누르면 입구부터 마지막 우두머리까지 보통 지나는 길이 그려지고, 우두머리에 순서대로 번호가 붙습니다. 경로는 Forever Dungeon Routes에서 가져옵니다.
- **던전의 모든 입구.** 세계 지도에 이제 울다만의 뒷문, 마라우돈의 보라색과 주황색 입구, 혈투의 전장의 각 구역 입구가 표시됩니다. Stalioot에게 감사합니다.
- **던전 안의 기술 전문가.** 울다만에 있는 마법부여 최고 등급 전문가와 가시덩굴 구릉에 있는 요리 전문가가 던전 지도에 표시되고, 검색으로도 찾을 수 있습니다. 검색은 이제 모든 기술 전문가를 기술과 등급으로도 찾습니다. 영어로 입력하세요: 'artisan enchanting'. Stalioot에게 감사합니다.

### Changed

- **더 멀리서 보이는 퀘스트 임무.** 임무가 이제 수락 가능한 퀘스트와 같은 확대 단계부터 보입니다.
- **좁은 패널의 전문 기술.** 위쪽의 전문 기술이 필요한 만큼만 자리를 차지해 모두 보이고, 나머지는 제조법이 씁니다. Stalioot에게 감사합니다.
- **Linux: FUSE 2 불필요.** AppImage에 더 이상 FUSE 2가 필요하지 않습니다. lkshrk에게 감사합니다.
- **Linux: 게임이 보이지 않는 이유.** Twinmap이 게임을 읽지 못하면 twinmap.log에 이유가 남고, 게임 창이 X 디스플레이에 없으면(Wine의 Wayland 드라이버, 별도의 gamescope) Twinmap이 그렇다고 알리고 무엇을 꺼야 하는지 말해 줍니다. markus-barta에게 감사합니다.

### Fixed

- **가장자리의 지역 이름.** 어떤 지점은 그 위를 덮는 더 큰 지도가 아니라 그 아래 땅의 지역 이름을 따릅니다: 혈투의 전장 입구는 멀고어가 아니라 페랄라스에 있습니다. Stalioot에게 감사합니다.
- **3D의 비행 경로 선.** 한 비행 조련사에서 다른 조련사까지 매끄럽게 휘며, 산과 언더시티 위에서 뾰족하게 솟지 않습니다.
- **중국어 전문 기술.** 이름이 같은 제조법 제목 두 개가 더 이상 지도와 화살표를 멈추지 않습니다.
- **러시아어 Shortest Path.** 키릴 문자로 된 긴 퀘스트 이름 때문에 경로를 잃지 않습니다.`,
    zhCN: `### New

- **图形，设置中的新标签页。** 3D视图绘制的每样东西在这里都有开关：建筑、树木（少、中、多）、物件、近处地面纹理、昼夜和3D地下城（实验性），每一项都标出它占用的显卡内存，下方是总计。“画质”一次设置所有开关，分为低、中、高：有显卡的电脑从“高”开始，手机、平板或没有显卡的电脑从“低”开始。3D视图持续卡顿时，地图上会出现一行提示，建议降低一级画质；如果显卡内存耗尽，Twinmap 会自动切换到“低”并告诉你。“使用硬件加速”已从“常规”移到这里。
- **外观，你的地图的样子。** “设置”的“外观”中新增“2D地图”：可以用游戏微缩地图的图片绘制地图，也可以像游戏自己的世界地图那样绘制，每个地区都是已探索的样子，并与相邻地区拼接在一起，城市也能放大查看。“外观”里仍有 Twinmap 其余的外观设置：地图所在的一侧、箭头的颜色和大小、地图图标，以及以区域显示的目标。感谢 Stalioot。
- **3D 中的游戏世界。** 3D视图用你电脑上游戏自己的文件，绘制游戏所绘制的内容，无需下载任何东西：建筑一直延伸到整个大陆，随着加载从地面升起；铁炉堡、幽暗城和地下的洞穴在地板上方被剖开；树木经过疏化，让道路露出来，还有栅栏、马车、灯和帐篷；暴风城运河里的水和铁炉堡里的熔岩；近处则是游戏原本的地面。在暴风城和奥格瑞玛，你的箭头和标记站在街道上。光线跟随游戏中一天的时间，夜里窗户会亮起；拖动地区名称下方的圆环可以移动太阳。
- **3D 中的地下城和团队副本（实验性）。** 在“设置”的“图形”中勾选“3D地下城（实验性）”，3D按钮在地下城和团队副本里也能使用：房间从上方打开，你的箭头和标记位于它们所在的楼层。此功能仍在开发中，可能有错误或较慢。
- **地区等级。** 在“筛选”的“世界”中勾选“地区等级”，2D地图上的每个地区都会按其等级与你角色等级的对比，用游戏的颜色着色：红、橙、黄、绿，不再给予经验值时为灰色。感谢 Stalioot。
- **穿过地下城的路线。** 在地下城或团队副本中，名称旁的“路线”按钮会画出通常的路线，从入口到最后一个首领，首领按顺序编号。路线来自 Forever Dungeon Routes。
- **地下城的每一个入口。** 世界地图现在会显示奥达曼的后门、玛拉顿的紫色和橙色入口，以及厄运之槌每个区域的入口。感谢 Stalioot。
- **地下城里的训练师。** 奥达曼里最高等级的附魔训练师和剃刀高地里的一位烹饪训练师显示在所在地下城的地图上，搜索也能找到他们。搜索现在还能按专业和等级找到任何专业训练师，需用英文输入：试试“artisan enchanting”。感谢 Stalioot。

### Changed

- **从更远处看到任务目标。** 任务目标现在和可接任务一样，从相同的缩放级别开始显示。
- **窄面板中的专业。** 顶部的专业只占用所需的空间，全部都能显示，其余空间留给配方。感谢 Stalioot。
- **Linux：不再需要 FUSE 2。** AppImage 不再需要 FUSE 2。感谢 lkshrk。
- **Linux：为什么看不到游戏。** Twinmap 无法读取游戏时，twinmap.log 会写明原因；游戏在 X 显示上没有窗口时（Wine 的 Wayland 驱动、独立的 gamescope），Twinmap 会说明情况以及需要关闭什么。感谢 markus-barta。

### Fixed

- **边缘处的地区名称。** 一个地点按其下方土地所属的地区命名，而不是按覆盖它的更大地图：厄运之槌的入口在菲拉斯，而不是莫高雷。感谢 Stalioot。
- **3D 中的飞行路线。** 从一位飞行管理员到另一位，路线平滑弯曲，不再在山脉和幽暗城上方出现尖峰。
- **中文专业。** 两个同名的配方标题不再让地图和箭头停止。
- **俄语的 Shortest Path。** 西里尔字母的长任务名称不再让路线丢失。`,
  },
  go: {
    'Graphics, a new tab of Settings.': 'settings',
    'Appearance, the look of your map.': 'settings',
    'Dungeons and raids in 3D (Experimental).': 'settings',
    'Zone levels.': 'layers',
  },
} satisfies News
