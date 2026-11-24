# Actividad 10: Respuesta formal a Dirección

**Para:** Dirección General / Gerencia de Sistemas  
**De:** Administración de Bases de Datos (DBA)  
**Asunto:** Dictamen técnico sobre modificación de RFC de cliente (`_id: 3`, María García) en `comercial.clientes`  

---

Con base exclusivamente en la evidencia técnica recopilada en nuestro servidor **MongoDB 7.0.43 Community Edition**, se responden las cuatro interrogantes planteadas:

### 1. ¿Quién cambió el RFC de María García en la Actividad 2? ¿Y en la Actividad 3?
- **En la Actividad 2 (perfilador apagado):** **No hay evidencia con esta edición.** Con el perfilador desactivado (`level: 0`), MongoDB Community no registra operaciones de modificación de datos en `system.profile` ni en la bitácora del servidor (`mongod.log`). Aunque la bitácora muestra que el usuario `app_ventas` se autenticó en ese intervalo, no existe evidencia técnica que vincule dicha sesión con la ejecución de la actualización del RFC.
- **En la Actividad 3 (perfilador activo en nivel 2):** **El usuario `app_ventas@comercial`** desde la dirección cliente `127.0.0.1` ejecutó la operación `update` sobre `comercial.clientes` modificando el documento `{ _id: 3 }` al valor `"GAMA780912XYZ"`.

### 2. ¿Cuándo y desde qué aplicación?
- **En la Actividad 2:** **No hay evidencia con esta edición** del momento exacto ni de la aplicación que ejecutó la sentencia de modificación (solo consta una conexión autenticada de `app-ventas-web` a las `2026-10-25T22:52:34.661Z`, sin rastro de la operación).
- **En la Actividad 3:** El cambio se ejecutó el **`2026-10-25T22:52:45.909Z` (UTC)** desde la aplicación identificada como **`app-ventas-web`**.

### 3. ¿Qué valor tenía antes?
- **No hay evidencia con esta edición.** Ni el perfilador (`system.profile`) ni la bitácora de `mongod` almacenan el estado anterior de los documentos (*before-image*); únicamente registran el filtro de búsqueda (`{ _id: 3 }`) y los nuevos valores enviados en la cláusula `$set`. (El valor original `"GAMA780912GHI"` solo se conoce por los datos iniciales de carga, no por los registros de auditoría del motor).

### 4. ¿Cambió alguien los privilegios de `app_ventas`?
- **No hay evidencia con esta edición** de quién realizó el cambio ni en qué instante exacto ocurrió, debido a que MongoDB Community Edition carece de auditoría nativa para comandos de administración de usuarios y roles (`grantRolesToUser` / `revokeRolesFromUser`), los cuales no quedan registrados ni en `system.profile` ni en `mongod.log`.  
- Mediante el **control compensatorio** implementado (instantáneas periódicas en `auditoria.instantaneas_privilegios`), se detectó que entre las `2026-10-25T22:53:12.105Z` y las `2026-10-25T22:53:12.220Z` al usuario `app_ventas` se le asignó temporalmente el rol `dbAdmin` sobre `comercial`, el cual posteriormente fue revocado para restaurar su perfil original (`readWrite`).
