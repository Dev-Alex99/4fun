# Contrato de red y verificación

Este documento describe el protocolo vigente, sus límites y cómo comprobarlo. Los valores son parámetros del código; no son mediciones de latencia ni una garantía de rendimiento. Véase también [README](../README.md).

## Autoridad y transporte

La sala tiene un anfitrión, en el slot 0, y hasta tres invitados, en los slots 1–3. El anfitrión ejecuta física, colisiones, daño, puntuación, cambios de ronda y torneo. Los invitados envían controles y predicen presentación y movimiento; los snapshots del anfitrión corrigen ese estado. La predicción no decide muertes ni ganadores.

PeerJS establece una conexión WebRTC por invitado, con `reliable: true` y mensajes JSON enviados mediante serialización `raw`. El identificador del anfitrión deriva del código de sala. Las pestañas del mismo equipo usan este mismo transporte: no hay un canal alternativo con BroadcastChannel. No existe migración automática de anfitrión ni un servidor de simulación dedicado.

La identidad declarada en un mensaje no concede permisos. El anfitrión comprueba la conexión vigente, exige que `sender` coincida con el identificador PeerJS de esa conexión y vincula el slot al ingreso aceptado. El invitado sólo acepta autoridad de su conexión actual con el anfitrión. Los callbacks tardíos de conexiones sustituidas no pueden mutar la nueva sesión.

| Operación | Autoridad admitida |
| --- | --- |
| Asignar slots, publicar snapshots y eventos de sala | Anfitrión |
| Cambiar juego, bots, escenario, modo, reiniciar y controlar torneo | Anfitrión |
| Expulsar jugadores y gestionar vetos | Anfitrión |
| Enviar movimiento y habilidades | Invitado, para su propio slot |
| Elegir una mejora de BASH | Propio slot, durante el draft y entre las opciones ofrecidas |
| Salir de la sala | Propia identidad |

Una quinta persona recibe el rechazo de sala llena sin reemplazar a un jugador existente. Los vetos se aplican a la identidad de conexión. No hay cuentas de usuario: crear una nueva identidad en otra pestaña no equivale a una identidad personal verificable. El anfitrión sigue siendo una parte de confianza para los resultados de su sala.

## Versiones, orden y cambios de ronda

El sobre lleva `protocolVersion: 1`, `sender`, `type`, `payload` y, tras el ingreso, `hostEpoch`. Una versión ausente o distinta se rechaza. No se permite que mensajes del protocolo anterior modifiquen la sala.

| Campo | Invariante |
| --- | --- |
| `hostEpoch` | Identifica una instancia de sala del anfitrión. Evita aplicar datos de un anfitrión anterior después de reconectar. |
| `stateSeq` | Avanza con cambios administrativos y de juego. Los inputs deben coincidir con la configuración autoritativa vigente. |
| `snapshotSeq` | Ordena snapshots dentro de una época. Se descartan duplicados y snapshots anteriores al último aplicado. |
| `inputSeq` | Ordena controles por invitado. Un paquete anterior o repetido no reemplaza movimiento más reciente. |
| `actionSeq` | Evita ejecutar dos veces la misma acción discreta. |
| `activeGame` y `roundEpoch` | Vinculan el input al cartucho y a la ronda activos, incluso cuando una nueva ronda usa el mismo escenario. |
| `lastSeenSnapshotSeq` | Referencia un snapshot emitido por el anfitrión para comprobar frescura sin confiar en el reloj del cliente. |

Las acciones pendientes conservan su juego, estado y ronda de origen. Se descartan si cambia alguno: una carga de Putt no se convierte en una habilidad de Hot-Core después de cambiar de cartucho. Las transiciones y los respawns aplican correcciones autoritativas completas cuando corresponde.

Los mensajes se validan antes de aplicarlos: tipos, números finitos, límites, roster fijo, campos necesarios de cada juego y cosméticos permitidos. El protocolo rechaza JSON excesivamente profundo y claves de prototipo. Los nombres y mensajes recibidos se normalizan; la interfaz escapa el texto antes de insertarlo en HTML.

## Cadencia, congestión y frescura

La simulación utiliza un reloj fijo de 60 pasos por segundo. Render y ejecución en segundo plano comparten ese reloj. La recuperación se limita a ocho pasos por avance para impedir que una pestaña suspendida reproduzca de golpe segundos de combate atrasado.

| Parámetro actual | Comportamiento |
| --- | --- |
| Inputs continuos: 35 ms | Intervalo mínimo de envío, salvo acciones urgentes o cambios de carga. No es un RTT medido. |
| Snapshots: 46 ms | Intervalo mínimo ordinario; ingresos y cambios de estado pueden forzar un envío. |
| Buffer WebRTC: más de 8.192 bytes; o cola PeerJS pendiente | Se omiten nuevos snapshots e inputs continuos mientras exista congestión. |
| Cola de acciones: hasta 16 entradas y 250 ms | Conserva acciones breves mientras se recupera el envío; descarta las caducadas. |
| Input remoto sin actualizar durante más de 250 ms | El anfitrión neutraliza controles y cancela cargas retenidas. Una carga de Putt cancelada no dispara un golpe. La comprobación corre cada 50 ms. |
| Frescura del snapshot referido por el input: 500 ms | El anfitrión rechaza inputs que remiten a snapshots desconocidos o más antiguos. Usa su propio registro de emisión. |
| Recepción: 160 mensajes por ventana de aproximadamente 1 s y conexión | El exceso se descarta antes del parseo. |
| JSON recibido de invitados: 2.048 caracteres | Se rechaza antes de `JSON.parse`; no necesitan enviar snapshots. |
| JSON recibido del anfitrión: 256 × 1.024 caracteres | Permite estados de juego mayores, sujetos también a validación estructural. |

El control de buffer evita añadir una cola creciente de estados obsoletos. No elimina lo que WebRTC ya haya aceptado: el transporte fiable puede retrasar mensajes posteriores mientras recupera uno perdido, conocido como *head-of-line blocking*. No hay canales separados para snapshots descartables y acciones fiables. La referencia de frescura permite rechazar paquetes antiguos que finalmente llegan, pero no convierte una conexión saturada en una conexión rápida.

Los tiempos `sentAtMs` declarados por un cliente no determinan la compensación ni autorizan posiciones. La ventana de 500 ms mide la antigüedad del snapshot referido en el reloj del anfitrión, no la edad exacta de una pulsación. Una conexión cuya ida y vuelta exceda esa ventana puede perder inputs hasta recibir y devolver estado suficientemente reciente.

## Predicción y parry

La corrección de movimiento converge hacia estado autoritativo y aplica una anticipación acotada basada en la velocidad del anfitrión y la mitad del RTT medido por el cliente: hasta 120 ms y 60 unidades de desplazamiento. Los cambios de ronda, estados incompatibles, teletransportes y otras discontinuidades pueden requerir una corrección directa. No se implementa un historial completo de inputs pendientes con replay después de cada snapshot.

Para BASH, el anfitrión mide RTT mediante desafíos con un `nonce` y acepta sólo la respuesta al desafío pendiente. La ventana de compensación es `min(180 ms, RTT / 2 + 40 ms)`. El anfitrión sobrescribe cualquier valor de compensación enviado por el invitado.

La distancia declarada por el cliente no prueba un contacto. Un parry compensado usa proximidad actual válida o contactos registrados por el anfitrión, vinculados a la bola y al mismo pase. Recuperar un KO requiere además la prueba autoritativa de ese KO y su continuación correspondiente. Una velocidad alta de la bola no amplía por sí sola el alcance permitido.

## Reconexión y ciclo de vida

- El heartbeat corre cada 1.400 ms. Un cliente sin snapshots válidos durante más de 12 s intenta reconectar aunque todavía responda el ping.
- Si el cliente lleva más de 500 ms sin un snapshot válido, la interfaz indica que está recuperando sincronización y pausa la predicción local hasta recibir estado reciente. Un ping que responde no basta para reanudar el juego.
- El reintento de conexión se programa después de 900 ms. Durante el ingreso, `JOIN_CLAIM` se reintenta cada 850 ms; el anfitrión limita respuestas repetidas a una cada 700 ms por identidad. Una conexión sin ingreso aceptado se cierra tras 6 s.
- Ante un cierre inesperado, el anfitrión detiene inmediatamente el input y reserva slot y puntuación durante 25 s desde el cierre. La misma identidad puede recuperarlos antes de la expiración. Si una conexión permanece muda, también expira tras 25 s sin actividad válida, comprobados por el heartbeat.
- Una salida explícita o expulsión libera el slot inmediatamente. Al expirar una reserva, vuelve a ser un slot de bot, según la dificultad elegida.
- La identidad del cliente permanece estable durante los reintentos de la misma instancia. Recargar la página o abrir otra pestaña puede crear otra identidad; no debe confundirse con una reconexión de Wi-Fi de la instancia existente.
- Reiniciar el anfitrión crea otra época. Los clientes pueden reconectar a esa sala y descartar la conexión vieja. Esto no recupera una partida guardada: no hay persistencia completa del estado de simulación ni migración de anfitrión.
- `dispose()` elimina timers, listeners y conexiones; sus eventos tardíos dejan de tener efecto.

Los temporizadores del navegador pueden ralentizarse o suspenderse en segundo plano, en ahorro de energía o con el dispositivo dormido. El reloj compartido evita pasos duplicados y la recuperación descontrolada; no garantiza que un anfitrión suspendido siga simulando a tiempo real.

## STUN y TURN

La configuración por defecto usa STUN y busca conectividad directa. Redes móviles, NAT o firewalls restrictivos pueden necesitar TURN. El despliegue puede proporcionar un array JSON de `RTCIceServer` mediante `VITE_RTC_ICE_SERVERS`, antes de iniciar Vite o construir el sitio. El código admite hasta 12 entradas y, por entrada, una URL o hasta seis URLs. Véase [`.env.example`](../.env.example).

Los valores `VITE_*` se incorporan al cliente y son visibles en el navegador. Para TURN se deben usar credenciales destinadas al navegador, de vigencia limitada y con límites adecuados del proveedor; no se deben colocar secretos privados del backend en esa variable. Este repositorio no implementa un servicio de emisión o renovación de credenciales TURN. Una configuración que no supera la lectura y comprobación estructural local vuelve a STUN; esa comprobación no acredita que el servidor o sus credenciales funcionen. Configurar TURN no garantiza por sí solo ancho de banda, disponibilidad ni baja latencia.

## Matriz de regresiones automatizadas

Los casos de [networkSecurity.test.ts](../src/__tests__/networkSecurity.test.ts) ejecutan los callbacks de conexión con un transporte PeerJS simulado y reloj controlado. Pueden retener, liberar, duplicar, reordenar o descartar entregas para reproducir escenarios. No reproducen la implementación SCTP/WebRTC, NAT ni un patrón estadístico de pérdida de una red física.

| Escenario | Resultado comprobado |
| --- | --- |
| Anfitrión y tres invitados; quinto ingreso | Cuatro slots coherentes y rechazo sin reemplazo. |
| Identidades, slots, versiones y comandos falsificados | No alteran autoridad ni controlan otro jugador. |
| Datos inválidos, cosméticos, tamaños y ráfagas | Se rechazan sin aplicar estado parcial ni ejecutar acciones. |
| Paquetes retenidos, duplicados o fuera de orden | Sólo se aplica estado vigente; no se repite la acción. |
| Buffer ocupado y recuperación breve | Se evita acumular envíos y se conserva una acción todavía válida. |
| Retención prolongada, cambio de juego o ronda | No se ejecuta una acción caducada ni se reasigna a otro contexto. |
| Input antiguo que llega después de la congestión | Se rechaza por la referencia de frescura emitida por el anfitrión. |
| Carga de Putt interrumpida | Se cancela sin golpe automático. |
| Reinicio del anfitrión y callbacks viejos | Se acepta la nueva época y se ignora la conexión anterior. |
| Reconexión y reserva | Se conserva el slot y puntuación antes de expirar; después se libera. |
| Snapshots completos de los siete juegos | Se aplican con cosméticos heterogéneos y `peerId` nulos de bots; los inválidos se rechazan antes de mutar motores. |
| RTT controlado y compensación falsificada | Se usa la medición del anfitrión, dentro de la ventana permitida. |

[gameplayRegression.test.ts](../src/__tests__/gameplayRegression.test.ts) comprueba finales de torneo y Ricochet, corrección de jugadores y evidencia de parry. [runtimeRegression.test.ts](../src/__tests__/runtimeRegression.test.ts) comprueba el reloj compartido y la recuperación tras suspensión.

```sh
npm test
npm run build
```

El build incluye pruebas, TypeScript y empaquetado. Estas comprobaciones no miden latencia de Internet.

## Verificación con navegador y redes remotas

La comprobación sobre el build estático de producción utilizó WebRTC real con cuatro pestañas del mismo dispositivo. Confirmó cuatro rosters coherentes, roles y controles administrativos, cambio sincronizado entre los siete juegos, indicadores de estado coincidentes, rechazo de un quinto ingreso sin desplazar jugadores y reconexión automática de los tres invitados tras recargar únicamente el anfitrión. También confirmó que los invitados conservan sus nombres actualizados al reconectar, cubierto además por una regresión automatizada. No aparecieron errores de consola en esa sesión. Ese alcance no acredita una partida entre cuatro dispositivos ni mide latencia WAN; debe repetirse cuando cambie el transporte.

Para validar un despliegue remoto:

1. Usar el build de producción con un anfitrión y tres invitados en dispositivos y redes diferentes; incluir una conexión móvil. Comparar los cuatro nombres, slots, juegos y resultados.
2. Recorrer los siete juegos. Verificar movimiento propio, acciones ajenas, respawns, cambio de escenario, draft, mutadores y resultados; completar un torneo que incluya Putt.
3. Intentar un quinto ingreso. Comprobar que ningún jugador existente pierde su slot. Verificar que un invitado no pueda cambiar ajustes del anfitrión.
4. Interrumpir brevemente la red de un invitado y restaurarla en la misma pestaña. Comprobar parada de input, recuperación del slot y puntuación. Repetir dejando expirar la reserva y comprobar su liberación.
5. Reiniciar la pestaña del anfitrión. Comprobar reconexión a la nueva época y ausencia de aplicación de estado anterior; no esperar recuperación de la partida previa.
6. Probar una red restrictiva con TURN configurado y comprobar en las estadísticas WebRTC del navegador qué par ICE se eligió. Registrar RTT, pérdida, tipo de candidato y comportamiento observado, sin confundir ping con validación de snapshots.
7. Introducir latencia, jitter y pérdida controlados en la red de prueba. Verificar acciones descartadas al caducar, ausencia de movimiento retenido y cancelación de cargas; observar correcciones visuales y resultados desde todos los dispositivos.
8. Ocultar o suspender el anfitrión y probar ahorro de energía. Registrar qué política aplica cada navegador y sistema operativo; no asumir continuidad de temporizadores.

Las pruebas WAN, TURN entre redes restrictivas y latencia física entre dispositivos no se ejecutaron como parte de la validación local descrita. El proyecto reduce acumulación de estado, duplicados y divergencia, pero no garantiza cero lag ni sincronización perfecta bajo cualquier red.
