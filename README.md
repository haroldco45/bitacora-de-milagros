# Bitácora de Milagros

App ciudadana (PWA) de **Vibras Positivas HM** para seguir los anuncios que el Gobierno marca como "milagro" (*El Milagro de las Regiones*, *#CampoMilagro*, *Ruta Milagro*, *Isla Milagro*…): qué se anunció, qué avanza y qué se entregó, con la fuente de cada dato.

Las cinco misiones del vicepresidente van aparte, en la app **patria-milagro**.

## Archivos

| Archivo | Para qué |
|---|---|
| `index.html`, `styles.css`, `app.js` | La app |
| `data/milagros.json` | Los milagros con su estado y su línea de tiempo (se edita a mano) |
| `data/noticias.json` | Noticias que trae el robot (no se edita a mano) |
| `scripts/robot.mjs` | El robot que busca noticias |
| `.github/workflows/robot.yml` | Hace correr el robot cada 30 minutos |
| `manifest.webmanifest`, `sw.js`, `icon*.png`, `icon.svg` | Para instalarla en el celular |

## Publicar

1. Crear el repo `haroldco45/bitacora-de-milagros` y subir todos los archivos **respetando las carpetas** (`data/`, `scripts/`, `.github/workflows/`).
2. GitHub → Settings → Pages → Branch `main`, carpeta `/ (root)`.
3. GitHub → Settings → Actions → General → Workflow permissions → **Read and write permissions** (si no, el robot no puede guardar).
4. Pestaña Actions → "Robot de noticias" → **Run workflow** para la primera corrida.
5. Conectar el repo en Netlify (se actualiza solo con cada cambio).

## Actualizar un milagro

En `data/milagros.json`, agregar un evento a su lista `eventos`:

```json
{ "fecha": "2026-10-30", "tipo": "entrega", "texto": "La torre de control empezó a operar.", "fuente": "Aerocivil", "url": "https://..." }
```

y cambiar `estado` si corresponde: `anunciado` → `en_marcha` → `entregado` → `funcionando` (o `incumplido`).
Si un milagro tiene `fechaCompromiso` y pasa la fecha sin cambiar de estado, la app lo muestra solo como **Vencido**.

Tipos de evento: `anuncio`, `avance`, `entrega`, `critica` (se muestra como "reparo").
