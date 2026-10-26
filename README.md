# TP-SYSTEM // 4-Player Party Deck

Consola de ocho minijuegos para cuatro jugadores: **BASH-BOT, CHAIN-PANIC, TURBO-PUTT, HOT-CORE, VOLT-CROWN, HEX-CRUSH, RICOCHET-1 y CARGO-CREW**. Incluye prácticas jugables, campaña cooperativa, equipos 2 contra 2, hazañas, retos por código, récords locales, votaciones, torneo configurable con mutadores, mando táctil, taller de robots y audio procedural.

## Ejecutar y verificar

```sh
npm ci
npm run dev
npm test
npm run build
```

Vite sirve la aplicación en el puerto 5173. El build ejecuta las pruebas, TypeScript estricto y el empaquetado de producción. Vercel publica dist con esa misma validación.

## Jugar con amigos

1. Abre la aplicación y crea una sala como anfitrión.
2. Copia el enlace de invitación (?room=CODIGO&join=1).
3. Hasta tres invitados pueden unirse; los slots restantes tienen bots. Una quinta persona recibe un rechazo sin desplazar a nadie.
4. El anfitrión controla juego, dificultad, escenarios, reinicios y torneo. Cada invitado controla su propio robot.

Las pestañas locales usan el mismo transporte WebRTC que los jugadores remotos. No se utiliza BroadcastChannel. El torneo considera un hoyo completado de TURBO-PUTT como una ronda, con un límite de 90 segundos por hoyo. En BASH-BOT, el torneo en solitario con bots OFF se resuelve al sobrevivir 30 segundos o al primer KO.

## Torneo Fiesta

El anfitrión elige **3, 5 o 7 rondas**, los juegos que entran al sorteo y si habrá ruleta de mutadores. Los ajustes se recuerdan en el dispositivo. Los juegos se sortean sin repetir hasta agotar la selección; CHAIN-PANIC y CARGO-CREW conservan sus modos cooperativos aparte. VOLT-CROWN utiliza reglas individuales dentro de la copa.

Tras la ruleta, cada ronda muestra su objetivo, un consejo y controles de teclado o mando táctil según el modo activo. **Cada humano confirma «Estoy listo»**; los bots no requieren confirmación. Cuando todos están listos, una cuenta atrás compartida de 3 segundos da paso al juego. Las nuevas entradas cancelan la cuenta hasta que el invitado confirme. Una desconexión breve reserva el slot y requiere nueva confirmación al volver; una salida explícita o la expiración de la reserva libera la espera. El anfitrión puede cancelar desde la preparación.

Cada victoria da 3 puntos de copa. El empate se resuelve por la victoria más reciente entre los líderes. La pantalla final muestra la clasificación y permite **repetir exactamente la selección y sus mutadores** o **sortear otra copa con los mismos ajustes**, conservando la sala y sus jugadores. Los campeonatos internos de cada juego se reinician al comenzar una ronda del torneo.

## CHAIN-PANIC: expedición cooperativa

El cartucho permite jugar libremente en **ocho sectores** o iniciar una campaña de **seis sectores**. Los dos sectores adicionales, Bifurcación de Rescate y Atraque entre Turbinas, se juegan en modo libre y en retos. Abrir el puente activa un checkpoint seguro; una caída reinicia desde allí y conserva el tiempo y las caídas acumuladas. El tirón con E rescata a vecinos activos de la cadena, incluso si hay slots vacíos entre ellos. El rescate se acredita cuando el compañero regresa a terreno seguro.

El sector seis termina la expedición y muestra tiempos, rescates y medallas. Oro exige hasta 2:30 sin caídas; plata, hasta 4:00 y como máximo dos caídas; los demás resultados obtienen bronce. El anfitrión guarda automáticamente el progreso en su dispositivo y puede continuarlo desde el Hub. Guardar la campaña no mantiene una sala online ni transfiere el anfitrión.

## VOLT-CROWN: equipos

El anfitrión puede alternar entre individual y **2 contra 2** desde el botón de modo. Los slots 1 y 3 forman el equipo A; 2 y 4, el B. La batería es compartida y se conserva cuando cambia el portador. Táseres, placajes y pulsos no dañan al compañero; las trampas del escenario afectan a ambos equipos. Los bots escoltan a su portador e interceptan enemigos. Con bots OFF participan solo los humanos disponibles, salvo el rival de práctica en solitario.

## Resultados, récords y pinturas

Los resultados permanecen visibles hasta la revancha o la salida al Hub, también si la pestaña está en segundo plano. El anfitrión confirma devoluciones, parries perfectos, rachas, tiempo de corona, rescates y entregas; los invitados reciben el mismo resultado. Las hazañas empatadas reconocen a todos sus líderes. El torneo acumula las estadísticas de todas sus rondas para las hazañas y los desbloqueos. Cada dispositivo mantiene su libreta de partidas y mejores tiempos cooperativos, y descarta resultados repetidos al recibir nuevos snapshots.

Las pinturas originales siguen disponibles. Se añaden **Rescatista** (3 rescates), **Campeón** (3 victorias o una copa), **Acero pulido** (10 parries perfectos) y **Operador** (completar CARGO-CREW). Se equipan desde el taller al desbloquearlas. El progreso es local al navegador y no se sincroniza entre dispositivos.

## CARGO-CREW

Un cooperativo de una a cuatro personas, con ayudantes bot opcionales. Completen tres entregas en una fábrica con cintas, pozos y grúas con aviso previo. Cerca de la batería, Espacio/clic/A engancha o suelta el cable, mantener Shift/B ancla y E repara 12 puntos de integridad con una recarga de 8 segundos. El checkpoint se activa a mitad de cada etapa; perder toda la integridad recupera la carga tras una breve espera. La última entrega requiere activar dos seguros, que permanecen abiertos para permitir jugar en solitario.

La ruta termina con el tiempo del equipo, daños, recuperaciones y entregas. El bot puede acompañar el transporte y activar seguros; la simulación del invitado no decide daños ni victorias.

El anfitrión elige entre **Ruta Clásica, Contracorriente y Carga de Precisión**. Cada variante recorre tres etapas con sus propias cintas, pozos, barreras y grúas. Cada entrega recibe oro hasta 1:30 sin daños, plata hasta 2:30 con un máximo de 30 daños o bronce al completarla. Los resultados muestran los objetivos extra «sin daños» y «sin reparaciones» por etapa, incluyendo lo ocurrido antes de recuperar un checkpoint.

## Aprender, invitar y elegir en grupo

En **PRÁCTICA · GRUPO · AJUSTES** (dentro de **Sala** en móvil) puedes abrir una práctica de unos 30 segundos para cualquiera de los ocho juegos. Comprueba acciones reales con los mismos motores: devolver proyectiles, rescatar, transportar, reparar, cargar golpes y usar habilidades. Usa teclado/mouse o mando táctil. Puedes repetir o salir con Escape. Son instancias separadas: la sala sigue jugando, y la práctica sólo guarda qué tutorial completaste, sin conceder victorias ni pinturas. La guía **?** ofrece acceso directo a la práctica del juego actual.

**Invitar · QR** genera el código en el dispositivo con [qrcode-generator](https://github.com/kazuhikoarase/qrcode-generator/tree/master/js), permite compartir desde el sistema cuando está disponible y ofrece un enlace seleccionable si el portapapeles no funciona. El enlace sólo incluye la invitación actual.

Desde el Hub, el anfitrión abre una votación entre los ocho juegos. Cada humano tiene un voto; se puede cambiar hasta que voten todos o el anfitrión cierre. Los bots no votan y los empates rotan entre juegos. El anfitrión inicia el elegido conservando la sala. Los resultados ofrecen **Votar siguiente juego**, además de la revancha.

Se añaden Rebotes Cruzados a BASH-BOT, Dos Caminos al Reactor a TURBO-PUTT, Cruce de Impulsos a HOT-CORE, Intercambiador de Coronas a VOLT-CROWN, Puentes de Cristal a HEX-CRUSH y Doble Hélice a RICOCHET-1.

## Retos compartidos y comodidad

Elige juego, crea un código de reto y compártelo. Un código como `1A-ABCD1234` fija escenario, mutador y semilla inicial con bots normales. El enlace del reto permite a otro grupo abrir su propia sala con esa configuración. No cambia una sala hasta que su anfitrión pulse **Jugar reto**. Repetir el reto restablece sus reglas y azar inicial; las acciones de los jugadores siguen determinando la partida. Cambiar manualmente la configuración termina el reto. Si cambia el número de participantes durante la partida, continúa sin registrar un récord comparable.

Los intentos y mejores victorias se guardan por código y número de humanos en el navegador; TURBO-PUTT prioriza golpes y después tiempo. Compartir puede incluir un tiempo local. No hay una clasificación global ni sincronización de récords entre dispositivos.

**Sonido y comodidad** recuerda volúmenes separados para música y efectos, reducción de sacudidas, reducción de destellos y tamaño del mando táctil. Los avisos de peligro se conservan. El tutorial y el generador QR se descargan al usarlos; PeerJS se empaqueta por separado para poder reutilizar su caché entre versiones.

## Red y sincronización

En móvil, cada juego abre una vista compacta con el escenario separado del HUD y del mando. **Sala** despliega jugadores, invitaciones y ajustes; **?** abre una guía con objetivo y controles del juego actual. Los paneles sueltan los controles del jugador y cancelan cargas pendientes, mientras los demás siguen jugando. Escape vuelve al juego. En escritorio también puedes activar **Vista de juego**. El botón de ampliar utiliza pantalla completa si el navegador lo permite y una vista ampliada como alternativa.

Los botones táctiles cambian de nombre y estado según la acción: Enganchar/Soltar, Lanzar/Escudo, Saltar/Pisotón y otras. Muestran recarga y alcance; RICOCHET-1 oculta la habilidad que no usa. CHAIN-PANIC identifica al vecino que necesita rescate. CARGO-CREW indica cuándo puedes enganchar o reparar y explica daños, reparación, checkpoints y entregas confirmados por el anfitrión.

El panel **Conexión de la sala** comprueba rutas directas o por relay y permite copiar un diagnóstico sin direcciones IP, nombres, códigos de sala ni credenciales. Tener un TURN configurado no implica que se esté utilizando: se informa la ruta seleccionada de cada enlace.

Para preparar el paquete de beta ejecuta `npm run check:beta`. Consulta [la validación y las pruebas pendientes de la beta](docs/BETA.md); el paquete publicable queda en `dist/`.

PeerJS establece conexiones WebRTC entre el anfitrión y los invitados. El anfitrión decide física, colisiones, puntuación y resultados. Los clientes predicen su movimiento para dar respuesta inmediata y se corrigen con el estado autoritativo. La simulación avanza a **60 pasos por segundo**, independientemente del FPS.

El protocolo vincula identidad y slot a la conexión, valida mensajes y valores, numera inputs y snapshots, separa las sesiones del anfitrión mediante una época y descarta estados antiguos. Bajo congestión evita acumular snapshots e inputs obsoletos; las acciones pendientes tienen una ventana de validez limitada. La compensación de parry usa evidencia del anfitrión y una ventana acotada, sin aceptar la distancia declarada por el cliente como prueba de un impacto.

Para jugadores con ping alto o conexiones inestables:

- El anfitrión confirma en cada snapshot qué input de cada invitado ya aplicó; el invitado sólo reañade su movimiento todavía en vuelo. El robot propio responde igual a 350-600 ms que sin latencia, sin tirones hacia atrás ni deslizamientos al soltar.
- Los snapshots viajan comprimidos (de 3 a 7 veces menos subida para el anfitrión), lo que importa mucho en redes lentas o con pérdida.
- Las ventanas de sincronía, frescura de inputs y expiración se adaptan al RTT y al jitter medidos de cada jugador, siempre con límites.
- Un fallo del servidor de señalización no corta partidas en curso; las reconexiones usan espera creciente y un enlace mudo se detecta en 6 s. El HUD del invitado muestra ping y variación (±).

La conexión depende de la red real. STUN permite conexiones directas en muchas redes; NAT y firewalls restrictivos pueden requerir **TURN**. Configura VITE_RTC_ICE_SERVERS como un array JSON de RTCIceServer antes de iniciar Vite o construir el sitio. La señalización usa el servidor público de PeerJS salvo que configures un PeerServer propio con VITE_PEER_HOST. Consulta .env.example y [el contrato y la verificación de red](docs/NETCODE.md).

No hay migración de anfitrión: si sale, los invitados intentan reconectar a la misma sala. Una pestaña suspendida por el navegador no equivale a un servidor dedicado. Para partidas estables el anfitrión debe mantener el dispositivo activo; cero latencia en Internet no es una garantía del proyecto.

## Estructura

- src/main.ts: composición, controles, HUD y bucle de simulación.
- src/net/: transporte, protocolo, permisos, salas y sincronización.
- src/game/: motores, reconciliación, torneo, mejoras y mutadores.
- src/render/: renderizadores Canvas con cámara compartida.
- src/runtime/: reloj de simulación fijo.
- src/input/, src/audio/: mando táctil y síntesis de audio.
- src/types.ts: contratos de estado y red.
- src/__tests__/: regresiones de seguridad, sincronización, física y soporte.

La dificultad CHILL/NORMAL/PRO modifica la IA de BASH-BOT. Los otros juegos usan sus propias reglas de IA; OFF elimina bots competitivos, con un dron de práctica en HOT-CORE, VOLT-CROWN, HEX-CRUSH y RICOCHET-1 cuando hay un solo humano. Los cosméticos se conservan localmente y se replican a la sala.
