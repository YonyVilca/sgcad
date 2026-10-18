# SGCAD API 1.1.0

API de prueba de conectividad **Cloudflare Workers → Neon PostgreSQL** para SGCAD.
No modifica AutoCAD, dibujos DWG, ni tablas de Neon.

## Antes de conectar GitHub en Cloudflare
1. Subir los archivos de este proyecto **a la raíz** del repositorio privado `SGCAD-API` (incluyendo la carpeta `src`).
2. Comprobar que el Worker existente se llama `sgcad-api` (igual que `name` en `wrangler.jsonc`).
3. En Cloudflare, mantener configurado el secreto `DATABASE_URL` en Production. **No se incluye ninguna contraseña en este repositorio.**
4. En el Worker existente: Settings → Builds → Connect → repositorio `SGCAD-API`, rama `main`, carpeta raíz `/`.
5. Si pide comando de despliegue, usar `npx wrangler deploy`; el paso de instalación puede ser `npm install` (o automático según el panel).
6. Verificar `GET /` y `GET /health` después de desplegar.

## Prueba protegida de Neon
La ruta `/db-test` está desactivada por defecto. Para habilitarla, guardar otro Secret llamado `DB_TEST_TOKEN` con un valor aleatorio largo, distinto de la contraseña de Neon.

Una solicitud autenticada debe enviar la cabecera:

`X-SGCAD-Diagnostic-Token: <VALOR_DEL_SECRETO>`

Se puede utilizar un cliente HTTP local para la prueba, **sin subir ese valor a GitHub ni pegarlo en el chat**. Si no se configura `DB_TEST_TOKEN`, `/db-test` devuelve 404.

Respuesta esperada: `{"connected":true,"database":"neondb","schema_ready":true}`.

Si las tablas son accesibles pero tienen un esquema distinto al creado anteriormente, el campo `schema_ready` puede ser `false`.

## Seguridad y alcance
- `DATABASE_URL` y `DB_TEST_TOKEN` se guardan exclusivamente como Secrets de Cloudflare.
- Por ahora solo hay rutas de lectura; no hay credenciales en el LISP.
- No hay autenticación de usuarios finales: antes de añadir escrituras, implementar autenticación individual y autorización por proyecto.
- Esta es una prueba técnica inicial, no una API de producción completa.
- Las funciones estables de SGCAD 1.0.7 no se alteran.
