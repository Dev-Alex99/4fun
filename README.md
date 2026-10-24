# TP-SYSTEM // 4-Player Party Deck

Consola de siete minijuegos para cuatro jugadores: **BASH-BOT, CHAIN-PANIC, TURBO-PUTT, HOT-CORE, VOLT-CROWN, HEX-CRUSH y RICOCHET-1**. Incluye bots, torneo de cinco rondas con mutadores, mando táctil, taller de robots y audio procedural.

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

## Red y sincronización

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
