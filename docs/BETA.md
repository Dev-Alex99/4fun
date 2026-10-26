# Beta de TP-SYSTEM

## Preparar el paquete

Ejecuta `npm run check:beta` desde la raíz. Comprueba pruebas automáticas, tipos de la aplicación y del laboratorio de red, build de producción y plantillas TURN. El resultado publicable está en `dist/`. Para revisarlo localmente usa `npm run preview -- --host 127.0.0.1`.

Este comando valida el paquete; no publica el sitio, no configura un TURN público y no sustituye la prueba con personas en redes diferentes. Todos los participantes deben recargar la misma versión: el protocolo actual es 5 y las salas usan el prefijo v8.

## Recorrido de prueba

1. En vertical y horizontal, lanzar cada uno de los ocho juegos. Confirmar que el escenario, los mensajes y los controles no se solapan.
2. Abrir Sala y la guía durante una carga de TURBO-PUTT: no debe salir un golpe al soltar los controles ni al cerrar el panel. Los demás jugadores siguen jugando.
3. En CARGO-CREW, acercarse y alejarse de la batería, enganchar, soltar y reparar. Comprobar la recarga, el aviso de grúa y la explicación del daño. Completar las tres entregas.
4. En CHAIN-PANIC, confirmar un rescate, abrir un checkpoint, caer, continuar y completar la campaña. Verificar guardado y medallas.
5. Jugar VOLT-CROWN por equipos y un Torneo Fiesta. Comparar ganadores, puntuación, hazañas y desbloqueos en todos los dispositivos.
6. Interrumpir brevemente una conexión y volver. Revisar que no queden movimiento, anclas o cargas sostenidas.
7. Completar una práctica desde **PRÁCTICA · GRUPO · AJUSTES**, también con el mando táctil. La sala debe seguir avanzando y la práctica no debe conceder puntos ni pinturas.
8. Escanear una invitación QR desde una dirección accesible a los demás dispositivos, votar el siguiente juego y comenzar sin recrear la sala. Comprobar que cada persona sólo tiene un voto.
9. Crear y compartir un reto, abrirlo en otra sala y comparar escenario y reglas. Repetirlo; comprobar que un cambio de participantes o de configuración impide registrar un récord comparable.
10. Ajustar volúmenes, sacudidas, destellos y tamaño del mando. Recargar y revisar que se recuerdan; los avisos de peligro deben seguir visibles.

## Prueba que requiere personas y redes distintas

Usar un anfitrión y tres invitados en dispositivos diferentes, incluyendo Wi-Fi y datos móviles. El anfitrión mantiene activo su dispositivo. Registrar:

- Dispositivo, navegador y orientación; juego y número de ronda.
- Tiempo hasta entender el objetivo y la primera acción sin explicación de otra persona.
- Punto donde el grupo se atasca, duración de la partida y juego que pide repetir.
- Diagnóstico de **Sala → Conexión de la sala** antes y después de una reconexión.

Comprobar al menos una ruta directa y una ruta por TURN desde una red que la necesite. El diagnóstico omite IPs y credenciales. No concluir que TURN está probado porque figure como configurado: la ruta de los enlaces debe mostrar servidor de relevo y la partida debe intercambiar estado.

## Alcance de la validación local

Comprobaciones realizadas el 25 de octubre de 2026:

- 301 pruebas automáticas aprobadas, incluidos los ocho juegos, prácticas completadas con inputs, pausas prolongadas para leer en las prácticas de suelo y golf, rutas cooperativas completas, votos autenticados, retos repetibles y simulaciones con cuatro jugadores a 100, 200 y 350 ms de RTT, jitter y pérdida de mensajes.
- Compilación de producción, tipos de la aplicación y del laboratorio, y validación de plantillas TURN aprobadas con `npm run check:beta`.
- 39 comprobaciones de interfaz aprobadas en Firefox: escritorio, móvil vertical y horizontal, los ocho juegos, reparación táctil, práctica con rescate real sin alterar recompensas, ajustes persistentes, QR, votación, reto compartido, paneles sin obstrucciones y espacio de juego conservado. Sin errores de JavaScript en esos recorridos.
- Cuatro comprobaciones adicionales sobre el paquete de producción: arranque y lanzamiento de juego, lección de golpe cargado completada, QR de invitación generado y carga de los módulos compilados de práctica/QR sin depender de archivos de desarrollo. Sin errores de JavaScript.
- Cuatro peers WebRTC reales del mismo equipo se conectaron por Coturn con rutas `relay/relay`, recibieron snapshots y terminaron con movimiento convergente. Se aprobaron los perfiles base, 200 ms de RTT añadido con jitter ±60 ms y 5% de pérdida de mensajes, y recuperación tras destruir la conexión de un invitado e impedir su reconexión durante tres segundos. [Informes de las tres ejecuciones](validation/relay-local.json). Las pérdidas y retrasos se aplican a mensajes de aplicación; no son pérdidas UDP/SCTP ni latencia WAN medidas. El ejercicio cubre movimiento de BASH, sin combate ni bots.

El laboratorio WebRTC permite comprobar cuatro peers del mismo equipo; su informe separa convergencia de movimiento y verificación del relay. Su disponibilidad y las pruebas simuladas no equivalen a una partida WebRTC real aprobada.

Los resultados del laboratorio local no prueban NAT diversos, latencia WAN, Safari/iOS ni la claridad y diversión para un grupo humano. Estos puntos quedan pendientes de la sesión de beta.

Coturn usa la imagen local derivada descrita en [infra/turn/README.md](../infra/turn/README.md), sin capabilities ni privilegios nuevos. Se verificó con una señalización PeerJS local. El perfil Firefox exclusivo de prueba habilita ICE sobre loopback y fuerza la interfaz `lo`; no modifica el navegador del usuario. Esto no prueba NAT diversos ni un despliegue público. El relay Node sigue siendo una alternativa desechable y no es una configuración de producción.

## Repetir el recorrido de interfaz

Con Node 22, Vite activo y un perfil **exclusivo de prueba** de Firefox iniciado con `--headless --no-remote --profile RUTA_TEMPORAL --remote-debugging-port 9224`, ejecuta `npm run test:browser:party`. El script cierra las pestañas anteriores de ese perfil, crea una sala de prueba y realiza 15 comprobaciones en el navegador con eventos de teclado y la interfaz completa. Guarda capturas en la carpeta temporal `tp04-browser-party` del sistema. Nunca lo conectes a tu navegador de uso diario.

Variables opcionales: `TP04_TEST_URL` (por defecto `http://127.0.0.1:5173/`), `TP04_BIDI_URL` (por defecto `ws://127.0.0.1:9224/session`) y `TP04_TEST_OUTPUT` (carpeta de capturas). Este recorrido requiere el servidor de desarrollo porque inspecciona módulos para comprobar que la práctica y la sala mantienen estados separados.
