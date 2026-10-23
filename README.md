# Bitácora de la Reconstrucción

App ciudadana (PWA) de **Vibras Positivas HM** para llevar el registro de todo lo que se hace en la reconstrucción tras el terremoto de magnitud 7,4 del 10 de agosto de 2026 en Colombia.

## Qué trae
- **Hoy**: fecha en hora Colombia, días desde el sismo, noticias del día y últimos registros. Se refresca cada vez que se entra.
- **Registros**: 20 registros verificados con su fuente (Fondo Milagro, viviendas, subsidios, Cali, Pereira, Chocó…) más los que cada persona agregue. Búsqueda y filtros por departamento, tipo y estado.
- **Registrar**: formulario para anotar entregas, obras, subsidios o retrasos. Se guarda en el teléfono; se puede compartir por WhatsApp o **enviar a Harold** para verificarlo y subirlo a la bitácora pública.
- **Noticias**: búsqueda en vivo al abrir + noticias que trae el robot. Cualquier noticia se puede convertir en registro con un toque.
- **Cifras**: daños (UNGRD/RUD) y plata para la reconstrucción, cada una con su fuente.
- Botón **⟳ actualizar**, descarga en Excel (CSV) y copia de seguridad.

## Publicar en GitHub Pages
1. Crear el repo `haroldco45/bitacora-reconstruccion` y subir todos los archivos (incluida la carpeta `.github`).
2. Settings → Pages → Branch `main`, carpeta `/ (root)`.
3. Settings → Actions → General → Workflow permissions → **Read and write**.
4. Pestaña Actions → "Robot de noticias" → **Run workflow** para la primera corrida. Desde ahí corre solo cada 30 minutos.

## Agregar un registro verificado
Cuando llegue un reporte por WhatsApp y esté confirmado, se agrega como un objeto más en `data/registros.json` (con `id` nuevo, p. ej. `of-021`). Las cifras se actualizan en `data/cifras.json`.
