# Contrato de red y verificación

Este documento describe el protocolo vigente, sus límites y cómo comprobarlo. Los valores son parámetros del código; no son mediciones de latencia ni una garantía de rendimiento. Véase también [README](../README.md).

## Autoridad y transporte

La sala tiene un anfitrión, en el slot 0, y hasta tres invitados, en los slots 1–3. El anfitrión ejecuta física, colisiones, daño, puntuación, cambios de ronda y torneo. Los invitados envían controles y predicen presentación y movimiento; los snapshots del anfitrión corrigen ese estado. La predicción no decide muertes ni ganadores.

PeerJS establece una conexión WebRTC por invitado con serialización `raw`. El canal es fiable pero **no ordenado** (PeerJS 1.5.5 traduce `reliable: false` a `ordered: false` sin limitar retransmisiones): un mensaje perdido se reenvía, pero no retiene a los posteriores; los números de secuencia descartan lo que llega tarde. El identificador del anfitrión deriva del código de sala. Las pestañas del mismo equipo usan este mismo transporte: no hay un canal alternativo con BroadcastChannel. No existe migración automática de anfitrión ni un servidor de simulación dedicado.

Los mensajes son JSON en texto. Los snapshots del anfitrión, que son la mayor parte del tráfico, viajan comprimidos (un byte de formato + deflate-raw) a los invitados que anuncian `caps.deflate` en `JOIN_CLAIM`; el resto los recibe en texto. La compresión usa `CompressionStream` nativo, se calcula una vez por snapshot y reduce el tamaño entre 3 y 7 veces (HEX-CRUSH: ~16,5 KB a ~2,3 KB). El anfitrión sólo acepta texto de los invitados. El invitado cuenta cada trama binaria en el límite de tasa antes de descomprimirla, rechaza tramas de más de 128 KB y corta la descompresión al superar el tamaño máximo de mensaje.

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

El sobre lleva `protocolVersion: 5`, `sender`, `type`, `payload` y, tras el ingreso, `hostEpoch`. Una versión ausente o distinta se rechaza. No se permite que mensajes del protocolo anterior modifiquen la sala. Las salas usan el prefijo `tp04-deck-room-v8-` para separar clientes que no entienden las votaciones, los retos y los escenarios adicionales.

`GAME_VOTE` es la única decisión nueva enviada por invitados. El anfitrión comprueba identidad de conexión, slot y número de votación vigente. Sólo los humanos actuales cuentan para la mayoría; repetir un mensaje sustituye el mismo voto y no añade otro. `gameVote` se distribuye en snapshots, también a quienes se reconectan. Crear/cerrar votaciones e iniciar juegos sigue siendo autoridad del anfitrión.

Los retos incluyen un descriptor validado contra su código: juego, escenario, mutador y semilla. El anfitrión reinicia los motores con un generador de azar por instancia, fija bots normales y publica el escenario completo. El mismo código reproduce la configuración inicial; no promete una trayectoria idéntica con acciones distintas. Cambiar ajustes manualmente limpia el reto. Un cambio en el número de humanos marca el intento como no comparable. Los récords se guardan localmente a partir del resultado confirmado por el anfitrión.

La práctica usa motores e inputs propios, no envía acciones de práctica a la sala ni resultados para desbloqueos. Abrirla libera los controles de la sala sin pausar su reloj.

`TOURNAMENT_READY` es una confirmación de invitado, no una acción administrativa. El anfitrión vincula el slot a la conexión autenticada y exige el `preparationId` vigente; las confirmaciones de rondas o copas anteriores se descartan. Los snapshots incluyen opciones de torneo, humanos esperados, confirmaciones y cuenta atrás. Tanto la simulación como las acciones remotas se pausan durante la preparación; solo el anfitrión avanza la cuenta atrás. Una nueva entrada o la desconexión de un jugador listo cancela la cuenta. Al liberar un slot se recalculan los humanos pendientes.

`START_CAMPAIGN` y `VOLT_MODE` son acciones exclusivas del anfitrión. Una campaña incluye checkpoints, tiempo, seis resultados de sector y cuatro contadores de rescates. El estado de equipos replica modo y dos baterías compartidas. `cargoState` incluye cuatro jugadores, enganches, integridad, seguros, checkpoint y avance de la ruta; su índice de etapa y sus valores se validan antes de aplicarse. La predicción de carga mueve presentación y controles, sin resolver daños o entregas.

`sessionResult` es un resultado sellado por el anfitrión, con identificador de sesión/ronda, participantes, ganadores y métricas confirmadas. Los invitados no pueden publicarlo. El resultado se conserva para la pantalla de revancha y se limpia al cambiar de juego o reiniciar. La libreta local deduplica el identificador; la persistencia local no supone una clasificación global verificable.

`cancelHeldActions` neutraliza los controles y cancela habilidades sostenidas del propio slot antes de aplicar el input. El anfitrión recuerda su `inputSeq` y rechaza acciones anteriores que lleguen después; no permite que una carga cancelada dispare al cerrar la ayuda. El invitado descarta su cola local de acciones al cancelar. La sala sigue simulando mientras un jugador consulta sus paneles.

Los eventos de carga incluyen una secuencia, tipo, mensaje breve y tiempo del anfitrión. El snapshot valida esos campos; la predicción no crea daños ni confirmaciones de reparación. El diagnóstico exportado usa una lista cerrada de campos y sólo afirma conexión directa/relay cuando un par ICE seleccionado ha alcanzado `succeeded`.

| Campo | Invariante |
| --- | --- |
| `hostEpoch` | Identifica una instancia de sala del anfitrión. Evita aplicar datos de un anfitrión anterior después de reconectar. |
| `stateSeq` | Avanza con cambios administrativos y de juego. Los inputs deben coincidir con la configuración autoritativa vigente. |
| `snapshotSeq` | Ordena snapshots dentro de una época. Se descartan duplicados y snapshots anteriores al último aplicado. |
| `inputSeq` | Ordena controles por invitado. Un paquete anterior o repetido no reemplaza movimiento más reciente. |
| `actionSeq` | Evita ejecutar dos veces la misma acción discreta. |
| `activeGame` y `roundEpoch` | Vinculan el input al cartucho y a la ronda activos, incluso cuando una nueva ronda usa el mismo escenario. |
| `lastSeenSnapshotSeq` | Referencia un snapshot emitido por el anfitrión para comprobar frescura sin confiar en el reloj del cliente. |
| `inputAcks` | En cada snapshot, por slot: `[inputSeq aplicado, ms aplicándolo]` o `null`. Permite al invitado reconciliar sólo el movimiento propio todavía en vuelo. |
| `caps` | En `JOIN_CLAIM`. Hoy sólo `deflate`. Un anfitrión antiguo lo ignora y sigue enviando texto. |

Los campos `inputAcks` y `caps` son opcionales y compatibles hacia atrás: un invitado antiguo ignora `inputAcks` y no anuncia `caps`, y un anfitrión antiguo no envía ninguno de los dos.

Las acciones pendientes conservan su juego, estado y ronda de origen. Se descartan si cambia alguno: una carga de Putt no se convierte en una habilidad de Hot-Core después de cambiar de cartucho. Las transiciones y los respawns aplican correcciones autoritativas completas cuando corresponde.

Los mensajes se validan antes de aplicarlos: tipos, números finitos, límites, roster fijo, campos necesarios de cada juego y cosméticos permitidos. El protocolo rechaza JSON excesivamente profundo y claves de prototipo. Los nombres y mensajes recibidos se normalizan; la interfaz escapa el texto antes de insertarlo en HTML.

## Cadencia, congestión y frescura

La simulación utiliza un reloj fijo de 60 pasos por segundo. Render y ejecución en segundo plano comparten ese reloj. La recuperación se limita a ocho pasos por avance para impedir que una pestaña suspendida reproduzca de golpe segundos de combate atrasado.

Varias ventanas se adaptan a la calidad medida de cada enlace. Cada lado mide el RTT sólo con desafíos que emitió él mismo (el anfitrión con `nonce` por invitado; el invitado con su propio ping) y lo suaviza como TCP (RFC 6298): `srtt` y la desviación media `rttvar`. Mientras no hay medición se usan los valores base, iguales a los fijos anteriores.

| Parámetro actual | Comportamiento |
| --- | --- |
| Inputs continuos: 35 ms | Intervalo mínimo de envío. Acciones, cambios de carga y cambios de dirección (arrancar, parar o girar) se envían en el acto. |
| Snapshots: 46 ms | Intervalo mínimo ordinario; ingresos y cambios de estado pueden forzar un envío. |
| Buffer WebRTC: más de 8.192 bytes; o cola PeerJS pendiente | Se omiten nuevos snapshots e inputs continuos mientras exista congestión. |
| Cola de acciones del invitado: hasta 16 entradas y 250 ms | Conserva acciones breves mientras se recupera el envío; descarta las caducadas. |
| Input remoto sin actualizar: `clamp(250 + 2·rttvar, 250, 600)` ms | El anfitrión neutraliza controles y cancela cargas retenidas. Un enlace con jitter no se detiene a tirones; uno caído se neutraliza en ≤ 600 ms. Una carga de Putt cancelada no dispara un golpe. |
| Frescura del snapshot referido por el input: `clamp(250 + srtt + 4·rttvar, 500, 1500)` ms | El anfitrión rechaza inputs que remiten a snapshots desconocidos o más antiguos, medido en su propio reloj. Con 500 ms fijos, un jugador con ~450 ms de RTT perdía casi todos sus inputs. |
| Sin snapshot válido: `clamp(350 + srtt + 4·rttvar, 500, 1500)` ms | El invitado pausa la predicción y muestra que recupera sincronización. |
| Recepción: 160 mensajes por ventana de aproximadamente 1 s y conexión | El exceso se descarta antes del parseo o de la descompresión. |
| JSON recibido de invitados: 2.048 caracteres | Se rechaza antes de `JSON.parse`; no necesitan enviar snapshots. |
| JSON recibido del anfitrión: 256 × 1.024 caracteres | Permite estados de juego mayores, sujetos también a validación estructural. |

Bajo pérdida y RTT altos, el control de congestión de SCTP limita el caudal de forma aproximadamente proporcional a `1 / (RTT · √pérdida)`. Por eso el tamaño del snapshot importa tanto como la latencia: sin compresión, tres invitados en HEX-CRUSH exigían ~8,6 Mbit/s de subida al anfitrión y una conexión lenta recibía muchos menos snapshots de los emitidos. El control de buffer evita añadir una cola creciente de estados obsoletos, pero no elimina lo que WebRTC ya haya aceptado. No hay canales separados para snapshots descartables y acciones fiables. La referencia de frescura rechaza paquetes antiguos que finalmente llegan, pero no convierte una conexión saturada en una conexión rápida.

Los tiempos `sentAtMs` declarados por un cliente no determinan la compensación ni autorizan posiciones. La ventana de frescura mide la antigüedad del snapshot referido en el reloj del anfitrión, no la edad exacta de una pulsación. Por encima de ~1,2 s de RTT los inputs pueden seguir rechazándose: 1.500 ms es el máximo deliberado.

## Predicción y parry

Un snapshot refleja los inputs del invitado de hace aproximadamente un RTT. Corregir hacia esa posición, aunque sea con una anticipación por velocidad, arrastra hacia atrás al robot propio en proporción al ping: a 350 ms recorría la mitad de distancia en el primer medio segundo y seguía deslizándose ~60 px al soltar el control.

La reconciliación usa ahora inputs confirmados. El invitado registra su trayectoria local predicha por paso, sin las correcciones de snapshots, y la hora de envío de cada `inputSeq`. Con `inputAcks` sabe qué input aplicó el anfitrión y durante cuánto tiempo; el desplazamiento local posterior a ese punto es movimiento todavía en vuelo. El objetivo de corrección es `estado autoritativo + desplazamiento en vuelo` (también en altura para saltos). Así la corrección sólo actúa sobre diferencias reales (colisiones, empujes, reglas del anfitrión), no sobre la latencia. Mientras una acción propia está en vuelo se conservan sus temporizadores predichos (dash, parry, escudo, enfriamientos), para que el anfitrión no la corte antes de haberla visto.

El desplazamiento se descarta, y se usa el estado del anfitrión, si el jugador está aturdido, cayendo, colgando, eliminado o hundido; si supera 360 unidades; y en cambios de ronda, cartucho y otras discontinuidades. Sin `inputAcks` (anfitrión antiguo o primeros paquetes) se mantiene la anticipación anterior: velocidad del anfitrión por la mitad del RTT, hasta 120 ms y 60 unidades. No se resimulan inputs con la física completa: se reutiliza el desplazamiento que ya calculó la predicción local de cada cartucho.

Para BASH, el anfitrión mide RTT mediante desafíos con un `nonce` y acepta sólo la respuesta al desafío pendiente. La ventana de compensación es `min(180 ms, srtt / 2 + 40 ms)`, con el RTT suavizado para que un pico aislado no la amplíe. El anfitrión sobrescribe cualquier valor de compensación enviado por el invitado.

La distancia declarada por el cliente no prueba un contacto. Un parry compensado usa proximidad actual válida o contactos registrados por el anfitrión, vinculados a la bola y al mismo pase. Recuperar un KO requiere además la prueba autoritativa de ese KO y su continuación correspondiente. Una velocidad alta de la bola no amplía por sí sola el alcance permitido.

## Reconexión y ciclo de vida

- El heartbeat corre cada 1.400 ms. Un cliente sin snapshots válidos durante más de 12 s intenta reconectar aunque todavía responda el ping, y uno que no recibe nada del anfitrión (ni snapshots ni respuestas de ping) durante 6 s reconecta sin esperar a que ICE declare el fallo.
- Si el cliente supera la ventana de sincronía (500 ms en un enlace sin medir; hasta 1.500 ms en uno lento o con jitter) sin un snapshot válido, la interfaz indica que está recuperando sincronización y pausa la predicción local hasta recibir estado reciente. Un ping que responde no basta para reanudar el juego.
- El primer reintento de conexión se programa a los 900 ms; los siguientes fallos consecutivos esperan ~1,5 s, 2,5 s, 4 s, 6 s y 8 s como máximo, con ±15 % de variación para que varios invitados no saturen la señalización a la vez. Un ingreso aceptado reinicia la secuencia. Durante el ingreso, `JOIN_CLAIM` se reintenta cada 850 ms; el anfitrión limita respuestas repetidas a una cada 700 ms por identidad. Una conexión sin ingreso aceptado se cierra tras 15 s.
- El servidor de señalización de PeerJS sólo se usa para encontrar al otro extremo. Si su conexión cae, un invitado ya conectado sigue jugando por WebRTC y el anfitrión conserva la sala: reintenta el registro con espera creciente (1 s a 15 s). Una respuesta "ID ocupado" tras una caída es su propio registro antiguo y no le hace abandonar la sala; sólo un código que nunca registró pertenece a otro anfitrión. Si el primer registro falla o no responde en 15 s, se crea otro peer sin reiniciar la partida local, y nunca mientras haya invitados conectados. El HUD avisa mientras la sala no es localizable.
- Al ocultar la pestaña (`pagehide`, también en móviles que omiten `beforeunload`), el invitado envía `PEER_LEAVE` y su slot se libera al instante. Una página restaurada desde la caché de navegación se recarga.
- Ante un cierre inesperado, el anfitrión detiene inmediatamente el input y reserva slot y puntuación durante 25 s desde el cierre. La misma identidad puede recuperarlos antes de la expiración. Si una conexión permanece muda, también expira tras 25 s sin actividad válida, comprobados por el heartbeat.
- Una salida explícita o expulsión libera el slot inmediatamente. Al expirar una reserva, vuelve a ser un slot de bot, según la dificultad elegida.
- La identidad del cliente permanece estable durante los reintentos de la misma instancia. Recargar la página o abrir otra pestaña puede crear otra identidad; no debe confundirse con una reconexión de Wi-Fi de la instancia existente.
- Reiniciar el anfitrión crea otra época. Los clientes pueden reconectar a esa sala y descartar la conexión vieja. Esto no recupera una partida guardada: no hay persistencia completa del estado de simulación ni migración de anfitrión.
- `dispose()` elimina timers, listeners y conexiones; sus eventos tardíos dejan de tener efecto.

Los temporizadores del navegador pueden ralentizarse o suspenderse en segundo plano, en ahorro de energía o con el dispositivo dormido. Con la pestaña oculta, el anfitrión avanza la simulación con pulsos de un Web Worker cada 16 ms en lugar de un temporizador del hilo principal, que muchos navegadores limitan a uno por segundo; si no hay Workers, vuelve al temporizador. El reloj compartido evita pasos duplicados y la recuperación descontrolada. Nada de esto garantiza que un anfitrión suspendido por el sistema operativo siga simulando a tiempo real.

## STUN y TURN

La configuración por defecto usa STUN y busca conectividad directa. Redes móviles, NAT o firewalls restrictivos pueden necesitar TURN. El despliegue puede proporcionar un array JSON de `RTCIceServer` mediante `VITE_RTC_ICE_SERVERS`, antes de iniciar Vite o construir el sitio. El código admite hasta 12 entradas y, por entrada, una URL o hasta seis URLs. Véase [`.env.example`](../.env.example).

La señalización usa por defecto el servidor público de PeerJS, que no ofrece garantías de disponibilidad. Un despliegue puede usar un PeerServer propio con `VITE_PEER_HOST` y, opcionalmente, `VITE_PEER_PORT`, `VITE_PEER_PATH`, `VITE_PEER_SECURE` y `VITE_PEER_KEY`. Una configuración incompleta o inválida se muestra como error en lugar de volver al servidor público.

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
| RTT controlado y compensación falsificada | Se usa la medición suavizada del anfitrión, dentro de la ventana permitida. |
| Snapshots comprimidos | Invitados compatibles reciben deflate y los demás texto; tramas corruptas, enormes o "bomba" se descartan; un resultado tardío no toca otra sesión; el anfitrión no descomprime nada de los invitados. |
| Enlace lento medido (~450 ms) | Ventanas de sincronía, frescura y expiración se amplían dentro de sus límites; un enlace sin medir mantiene los valores base. |
| Señalización caída o "ID ocupado" | El invitado sigue jugando, el anfitrión conserva la sala y reintenta con espera creciente; un primer registro fallido o colgado se rehace sin reiniciar la partida. |
| Fallos de reconexión consecutivos y silencio total | Espera creciente con variación; reconexión tras 6 s sin ningún mensaje del anfitrión. |

[networkStress.test.ts](../src/__tests__/networkStress.test.ts) también mide la sensación de control a 350 y 600 ms de RTT con jitter y pérdida: distancia recorrida en el primer medio segundo, deslizamiento al soltar el control y saltos por corrección. Con la reconciliación anterior, a 350 ms el robot recorría ~30-40 px en lugar de 55-80 px y se deslizaba ~60 px; a 600 ms el anfitrión rechazaba los inputs. Ahora ambos casos se comportan como un enlace sin latencia, con correcciones p95 de 1-5 px. [netResilience.test.ts](../src/__tests__/netResilience.test.ts) cubre el estimador de RTT, el códec y la reconciliación de forma aislada.

[gameplayRegression.test.ts](../src/__tests__/gameplayRegression.test.ts) comprueba finales de torneo y Ricochet, corrección de jugadores y evidencia de parry. [runtimeRegression.test.ts](../src/__tests__/runtimeRegression.test.ts) comprueba el reloj compartido y la recuperación tras suspensión.

```sh
npm test
npm run build
```

El build incluye pruebas, TypeScript y empaquetado. Estas comprobaciones no miden latencia de Internet.

## Verificación con navegador y redes remotas

La comprobación sobre el build estático de producción utilizó WebRTC real con cuatro pestañas del mismo dispositivo. Confirmó cuatro rosters coherentes, roles y controles administrativos, cambio sincronizado entre los siete juegos, indicadores de estado coincidentes, rechazo de un quinto ingreso sin desplazar jugadores y reconexión automática de los tres invitados tras recargar únicamente el anfitrión. También confirmó que los invitados conservan sus nombres actualizados al reconectar, cubierto además por una regresión automatizada. No aparecieron errores de consola en esa sesión. Ese alcance no acredita una partida entre cuatro dispositivos ni mide latencia WAN; debe repetirse cuando cambie el transporte.

Una comprobación posterior con el build de producción, cuatro pestañas de Firefox 158 sin interfaz, WebRTC real y el servidor público de PeerJS confirmó: cuatro jugadores en ~1,5 s, cambio sincronizado a HEX-CRUSH en los tres invitados, snapshots enviados sólo comprimidos (~2,3 KB de media frente a ~16,5 KB en texto) y descomprimidos por todos, y un invitado recargado de vuelta en su sala en ~1 s. En esa prueba el anfitrión estaba en una pestaña oculta y emitió ~20 snapshots por segundo con el código anterior y con el nuevo: Firefox no limitó los temporizadores de esa pestaña con WebRTC activo, por lo que la mejora del Worker no quedó demostrada ahí. Tampoco se midió latencia WAN.

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
