#!/usr/bin/env node
import { randomBytes } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { isIP } from 'node:net';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseEnv } from 'node:util';

function render(values) {
  const domain = values.TURN_REALM;
  if (!domain || !/^(?=.{1,253}$)[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?$/i.test(domain)) throw new Error('TURN_REALM debe ser un hostname válido.');
  for (const name of ['TURN_PUBLIC_IP', 'TURN_LISTEN_IP']) {
    if (isIP(values[name] ?? '') !== 4) throw new Error(`${name} debe ser una dirección IPv4 explícita.`);
  }
  const parts = values.TURN_PUBLIC_IP.split('.').map(Number);
  if ([0, 10, 127].includes(parts[0]) || parts[0] >= 224 || (parts[0] === 169 && parts[1] === 254)
    || (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) || (parts[0] === 192 && parts[1] === 168)
    || (parts[0] === 100 && parts[1] >= 64 && parts[1] <= 127)) throw new Error('TURN_PUBLIC_IP debe ser pública; no se acepta el laboratorio loopback.');
  if (!/^[a-f0-9]{64}$/i.test(values.TURN_SHARED_SECRET ?? '')) throw new Error('TURN_SHARED_SECRET requiere 32 bytes aleatorios (64 caracteres hex).');
  for (const name of ['TURN_CERT_FILE', 'TURN_KEY_FILE']) {
    if (!/^\/[a-z0-9_./-]+$/i.test(values[name] ?? '')) throw new Error(`${name} debe ser una ruta Unix absoluta sin espacios ni saltos de línea.`);
  }
  const source = readFileSync(join(dirname(fileURLToPath(import.meta.url)), 'turnserver.public.conf.template'), 'utf8');
  return source.replace(/\$\{([A-Z_]+)\}/g, (_, name) => {
    if (!Object.hasOwn(values, name)) throw new Error(`Falta ${name}.`);
    return values[name];
  });
}

try {
  if (process.argv[2] === '--check') {
    const config = render({ TURN_REALM: 'turn.example.com', TURN_PUBLIC_IP: '8.8.8.8', TURN_LISTEN_IP: '10.1.0.2',
      TURN_SHARED_SECRET: randomBytes(32).toString('hex'), TURN_CERT_FILE: '/etc/tp04/fullchain.pem', TURN_KEY_FILE: '/etc/tp04/privkey.pem' });
    if (config.includes('${') || /^allow-loopback-peers\s*$/m.test(config) || !config.includes('use-auth-secret')) throw new Error('La plantilla pública no pasó su validación.');
    console.log('Plantilla pública validada en memoria; no se creó ningún archivo ni servicio.');
  } else {
    const [, , input, output] = process.argv;
    if (!input || !output) throw new Error('Uso: node infra/turn/render-public.mjs /ruta/privada/server.env /ruta/privada/turnserver.conf');
    const destination = resolve(output);
    if (existsSync(destination)) throw new Error('El archivo de destino ya existe; no se sobrescribió.');
    const config = render(parseEnv(readFileSync(resolve(input), 'utf8')));
    writeFileSync(destination, config, { flag: 'wx', mode: 0o600 });
    console.log(`Configuración privada creada en ${destination}. No se inició un servidor.`);
  }
} catch (error) { console.error(`TURN public template: ${error.message}`); process.exitCode = 1; }
