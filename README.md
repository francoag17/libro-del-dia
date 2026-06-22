# 📖 Libro del día

PWA que cada día te recomienda **un libro de no-ficción** (liderazgo, ventas, negocios/productividad y desarrollo personal) y te muestra un **resumen accionable generado con IA (Claude)**. Pensada para aprendizaje diario, instalable en el iPhone, con **notificación push** cada mañana.

- **66 libros** curados en el catálogo (`data/books.json`).
- Resúmenes generados **bajo demanda** con la API de Claude y **cacheados** (no se regenera ni se paga dos veces el mismo libro).
- Selección del libro del día **determinística y sin repetir** los últimos ~30 días.
- **Web Push** (notificación cada mañana) + **Service Worker** (instalable y con cache offline).

---

## 1. Probar en la compu (local)

```bash
cd libro-del-dia
npm install
npm run vapid          # genera claves de notificaciones → copialas al .env (ya hay unas de ejemplo)
cp .env.example .env   # si no existe; completá ANTHROPIC_API_KEY
npm start
```

Abrí http://localhost:3005

> Sin `ANTHROPIC_API_KEY` la app funciona igual, pero muestra un **resumen de muestra**. Apenas pongas la key, los resúmenes pasan a generarse con IA.

### Conseguir la API key de Claude
1. Entrá a https://console.anthropic.com/ → **API Keys** → crear una.
2. Pegala en `.env`:
   ```
   ANTHROPIC_API_KEY=sk-ant-...
   ```
3. Reiniciá (`npm start`). Costo aprox.: **centavos de dólar por mes** (1 resumen ≈ 1–2 centavos, y se cachea).

---

## 2. Subirla a internet (para usarla en el iPhone con push)

⚠️ **El push en iPhone solo funciona si la app está en HTTPS público** (no sirve `localhost`). Lo subimos gratis a **Render** usando el blueprint `render.yaml` que ya está incluido.

### Paso A — Subir el código a GitHub
1. Creá un repo nuevo en GitHub (privado está bien).
2. Subí **el contenido de la carpeta `libro-del-dia`** como raíz del repo. (Tu `.env` NO se sube: está en `.gitignore`, perfecto.)

### Paso B — Crear el servicio en Render
1. Entrá a https://render.com y registrate (es gratis, podés usar tu cuenta de GitHub).
2. **New → Blueprint** → elegí el repo. Render detecta `render.yaml` solo.
3. Te va a pedir cargar los valores de las variables marcadas como secretas. Completá:
   - **VAPID_PUBLIC_KEY** y **VAPID_PRIVATE_KEY** → copialos de tu archivo `.env` local (los mismos, así no se rompen las suscripciones).
   - **ANTHROPIC_API_KEY** → tu key de Claude (opcional; sin ella, los 12 libros pre-cargados ya muestran resumen real).
   - **CRON_SECRET** → inventá una clave larga (ej. `libro-2026-xY9q...`). Anotala, la usás en el Paso D.
4. **Create** y esperá a que termine de buildear. Render te da una URL tipo `https://libro-del-dia.onrender.com`.

### Paso C — Probar que levantó
Abrí `https://TU-URL.onrender.com/api/health` → tenés que ver `{"ok":true,...}`.

### Paso D — Programar la notificación diaria (gratis y confiable)
> En el plan free de Render el servicio se "duerme" tras unos minutos sin uso, así que el cron interno no es confiable. La solución: un disparador externo gratuito que lo despierta y manda el libro cada mañana.

1. Entrá a https://cron-job.org (gratis) y creá una cuenta.
2. **Create cronjob**:
   - **URL:** `https://TU-URL.onrender.com/api/run-daily?key=TU_CRON_SECRET`
   - **Schedule:** todos los días a las **08:00** (zona horaria de Argentina).
3. Guardá. Eso es todo: cada mañana se elige el libro del día y se manda el push.

> **Nota sobre datos:** se usa SQLite. En el plan free el historial puede reiniciarse al re-desplegar (los resúmenes pre-cargados se vuelven a sembrar igual). Para uso personal alcanza; si querés persistencia total, Render tiene discos en el plan de pago.

> Alternativas equivalentes a Render: **Railway**, **Fly.io** o tu propio VPS. Lo único que importa: HTTPS público + el disparador diario.

---

## 3. Instalar en el iPhone (PWA)

1. Abrí la URL pública en **Safari** (tiene que ser Safari, no Chrome).
2. Tocá **Compartir** (cuadro con flecha) → **Agregar a inicio**.
3. Abrí la app **desde el ícono** de la pantalla de inicio (no desde Safari).
4. Entrá a **Ajustes → Activar notificaciones** y aceptá el permiso.

✅ Listo. Cada mañana (08:00 hora Argentina por defecto) te llega el libro del día.

> Requiere **iOS 16.4 o superior** para las notificaciones push en PWA.

---

## Configuración (.env)

| Variable | Para qué |
|---|---|
| `ANTHROPIC_API_KEY` | Generar resúmenes con IA |
| `ANTHROPIC_MODEL` | Modelo de Claude (default `claude-sonnet-4-6`) |
| `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` | Notificaciones push (generar con `npm run vapid`) |
| `VAPID_SUBJECT` | Mail de contacto para el push |
| `PORT` | Puerto (default 3005) |
| `TZ_APP` | Zona horaria (default `America/Argentina/Buenos_Aires`) |
| `DAILY_CRON` | Horario del envío diario (default `0 8 * * *` = 08:00) |

---

## Cómo funciona (arquitectura)

```
public/        ← PWA (HTML/CSS/JS, manifest, service worker, íconos)
src/
  server.js          ← Express: API + sirve la PWA + arranca el cron
  db.js              ← SQLite (libros, resúmenes cacheados, picks, suscripciones, prefs)
  catalog-loader.js  ← carga data/books.json a la DB
  recommend.js       ← elige el libro del día (determinístico, sin repetir)
  claude.js          ← genera el resumen con la API de Claude
  push.js            ← envía notificaciones (Web Push / VAPID)
  scheduler.js       ← cron diario: elige libro + envía push
data/books.json      ← catálogo curado de 66 libros
scripts/             ← generar VAPID keys e íconos
```

### Endpoints principales
- `GET /api/today` — libro del día + resumen.
- `GET /api/book/:id` — un libro puntual con su resumen.
- `GET /api/catalog` — todo el catálogo (para explorar).
- `GET /api/history` — historial de libros recomendados.
- `POST /api/subscribe` — registra el dispositivo para push.
- `POST /api/run-daily` — dispara el job diario manualmente (para probar).
- `GET /api/health` — estado (libros, IA, push).

---

## Agregar más libros

Editá `data/books.json` (cada libro: `title`, `author`, `year`, `category`, `tags`, `hook`, `why`, `difficulty`) y reiniciá. Las categorías válidas son: `Liderazgo`, `Ventas`, `Negocios y productividad`, `Desarrollo personal`.
