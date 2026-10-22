# TURN local y plantilla para servidor

El laboratorio usa la imagen del proyecto Coturn fijada en `coturn/coturn:4.18.0-r0`. Esa versión aparece en el [repositorio oficial de la imagen](https://github.com/coturn/coturn/blob/master/docker/coturn/README.md). Sus [notas de versión](https://github.com/coturn/coturn/releases/tag/4.18.0) cambian opciones antiguas; las plantillas usan `cli=false`, administración web desactivada y DTLS sin habilitar.

Desde la raíz del proyecto, con Node 20.12+ y Docker Desktop ejecutándose con contenedores Linux:

```text
node scripts/turn-lab.mjs validate --docker-config
node scripts/turn-lab.mjs start --local --dry-run
node scripts/turn-lab.mjs start --local
npm run dev -- --mode turn-lab --host 127.0.0.1
node scripts/turn-lab.mjs status
node scripts/turn-lab.mjs stop
```

`--dry-run` no escribe archivos ni inicia contenedores. `--local` es obligatorio para arrancar. El script publica únicamente `127.0.0.1:3478` UDP/TCP y el rango UDP `49160–49179`. Reutiliza su contenedor y rechaza recursos de otro propietario. Si Docker no responde, termina con error y una acción concreta; no declara que se probó TURN.

El secreto del servidor se genera aleatoriamente en `infra/turn/.runtime/`, ignorado por Git. `.env.turn-lab.local`, también ignorado, contiene credenciales HMAC-SHA1 que vencen en una hora y fuerza `iceTransportPolicy=relay`. Nunca contiene el secreto compartido. Reinicia Vite después de renovar credenciales. `start --local` reutiliza las credenciales vigentes y renueva las próximas a vencer. `stop` conserva estos archivos; `stop --purge` elimina sólo sus archivos administrados y recursos Docker propios. Los permisos `0600`/`0700` se aplican donde el sistema los respeta; protege además la carpeta con los permisos de tu usuario en Windows.

El laboratorio permite **sólo peers `127.0.0.1`** para conectar dos asignaciones del mismo servidor dentro de su contenedor. No prueba redes remotas, NAT reales ni TLS. Exige comprobar en el navegador que el par ICE seleccionado sea `relay/relay` y que el canal intercambie datos: tener un proceso Docker activo no demuestra esa conexión. Si la red virtual de Docker impide loopback relay, conserva el fallo como resultado de la prueba; no publiques el contenedor ni abras direcciones privadas para ocultarlo.

La excepción de loopback es exclusivamente de laboratorio, como señala la [configuración oficial de Coturn](https://github.com/coturn/coturn/blob/4.18.0/examples/etc/turnserver.conf). El transporte TURN sobre TCP sigue habilitado; `no-tcp-relay` deshabilita el relay de peers TCP, que es otra función.

Para un servidor público, `server.env.example` y `turnserver.public.conf.template` son material de preparación. Copia el entorno **fuera del repositorio**, genera un secreto propio, indica IP pública/interfaz reales y rutas de certificados TLS válidos. Después puedes renderizar sin ejecutar ni desplegar el servicio:

```text
node infra/turn/render-public.mjs --check
node infra/turn/render-public.mjs /etc/tp04-turn/server.env /etc/tp04-turn/turnserver.conf
```

El generador no sobreescribe un archivo existente. La plantilla pública no habilita loopback ni administración, limita cuotas, bloquea redes internas y requiere certificados. Antes de desplegar, prepara DNS, firewall UDP/TCP `3478`, TLS TCP `5349`, relay UDP `49160–49259`, mapeo de puertos sin cambio de número si hay NAT, permisos privados y renovación de certificados. El backend debe emitir credenciales breves con el secreto; el secreto del servidor jamás va en una variable `VITE_*` ni dentro del bundle. La plantilla no crea ese backend ni configura una cuenta de proveedor.
