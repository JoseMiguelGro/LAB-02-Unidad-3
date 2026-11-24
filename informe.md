# Informe Técnico — LAB-02: Trazabilidad en MongoDB Community

**Materia:** Gestión de Seguridad y Desempeño de Bases de Datos  
**Unidad:** III - Auditoría, trazabilidad y gobierno práctico de datos  
**Caso de estudio:** Comercializadora Norte S.A. de C.V. (Base `comercial`)  
**Autor:** Jose Miguel Guerrero Romero  

---

## 1. Despliegue, edición y limitación

El entorno se desplegó sobre **MongoDB 7.0.43 Community Edition** con control de acceso habilitado (`security.authorization: enabled`). Mediante los comandos `db.version()`, `db.adminCommand({ buildInfo: 1 }).modules` y `db.serverCmdLineOpts().parsed` ejecutados desde `mongosh`, se verificó que el arreglo `modules` se encuentra vacío (`[]`), confirmando de manera inequívoca que se trata de la edición Community y no de MongoDB Enterprise Edition (la cual incluiría el módulo `"enterprise"`).

En consecuencia, **MongoDB Community Edition no cuenta con auditoría nativa de seguridad** (`auditLog` / `--auditDestination`). Esta edición únicamente provee dos mecanismos orientados originalmente al diagnóstico de desempeño y operación del servidor: el perfilador de base de datos (`system.profile`) y la bitácora estructurada en JSON de `mongod`. Por rigor técnico, ninguna de estas herramientas sustituye ni equivale a un sistema de auditoría nativa.

---

## 2. Perfilador (`Database Profiler`)

- **Configuración:** El perfilador opera por base de datos mediante `db.setProfilingLevel()` (volátil ante reinicios) o de forma global y persistente mediante `operationProfiling.mode` en el archivo de configuración de `mongod`. Se evaluó el nivel `0` (apagado), nivel `2` (registro total de operaciones) y nivel `1` combinado con expresiones de filtro (`{ filter: { op: { $in: ["insert", "update", "remove"] } } }`).
- **Interpretación:** Los documentos almacenados en `comercial.system.profile` permiten identificar el tipo de operación (`op`), el espacio de nombres (`ns`), la sentencia ejecutada (`command`), la identidad autenticada (`user`, e.g. `app_ventas@comercial`), la IP de origen (`client`), el identificador de aplicación (`appName`, e.g. `app-ventas-web`) y la marca de tiempo (`ts`). Sin embargo, el perfilador **no registra valores anteriores (*before-images*)** de los documentos modificados o eliminados.
- **Costo operativo:** Activar el perfilador en nivel `2` introduce una penalización significativa en latencia y operaciones de E/S en disco, además de llenar aceleradamente la colección `system.profile` (limitada por defecto a 1 MB). El uso de filtros selectivos mitiga este costo al descartar lecturas rutinarias, aunque sacrifica la trazabilidad sobre consultas de datos sensibles.

---

## 3. Bitácora de `mongod`

- **Ubicación:** Determinada por `systemLog.destination` y `systemLog.path`. En despliegues en contenedor o sin archivo de configuración explícito, se emite a la salida estándar (`stdout`); en servidores configurados con archivo, se persiste en disco (`logAppend: true`). En memoria, `db.adminCommand({ getLog: "global" })` conserva únicamente los últimos 1024 eventos.
- **Accesos:** La bitácora registra cada línea en formato JSON. Los eventos del componente `ACCESS` distinguen intentos exitosos (`id: 5286306`, `msg: "Successfully authenticated"`, `result: 0`) de intentos fallidos (`id: 5286307`, `msg: "Failed to authenticate"`), diferenciando internamente entre contraseñas erróneas (`result: 18`) y usuarios inexistentes (`result: 11`), mientras que al cliente se le devuelve un mensaje genérico para prevenir la enumeración de cuentas.
- **Cambios de configuración:** Las modificaciones al nivel o filtro del perfilador generan el evento `msg: "Profiler settings changed"`. Aunque dicha línea no contiene el campo `user`, es posible atribuir la autoría correlacionando el identificador de contexto (`ctx`, por ejemplo `conn31`) con el evento `"Successfully authenticated"` previo dentro del mismo ciclo de ejecución del servidor.

---

## 4. Privilegios: evidencia disponible, control compensatorio y su límite

- **Evidencia disponible:** **Nula de forma nativa.** Se comprobó experimentalmente que la ejecución de `db.grantRolesToUser("app_ventas", [{ role: "dbAdmin", db: "comercial" }])` no genera ningún registro ni en `system.profile` (aun en nivel `2`) ni en la bitácora de `mongod`.
- **Control compensatorio aplicado:** Se implementó una colección dedicada (`auditoria.instantaneas_privilegios`) donde se almacenan periódicamente instantáneas del estado de usuarios y roles (`db.getUsers()`), registrando la fecha (`momento`) y la cuenta que ejecutó la captura (`tomada_por`).
- **Límite del control:** Las instantáneas demuestran *qué* privilegio cambió y *entre qué dos momentos* ocurrió la alteración, pero **no permiten determinar quién ejecutó el cambio ni el segundo exacto** en que se produjo, ni impiden que un administrador con privilegios totales altere la colección si no se exporta fuera del servidor. Por ello, es un control compensatorio de detección y no un equivalente a la auditoría nativa.

---

## 5. Conservación

- **Riesgos observados:** La evidencia en MongoDB Community es volátil por diseño: `system.profile` sobrescribe registros antiguos al alcanzar 1 MB (*capped collection*); el comando `getLog` pierde todo su contenido al reiniciar el servicio; y la bitácora en archivo puede truncarse al reiniciar si no se habilita `systemLog.logAppend: true`.
- **Exportación realizada:** Antes de cualquier reinicio del servicio, se exportaron `system.profile` a `evidencias/system-profile.json` y la bitácora de memoria a `evidencias/bitacora-mongod.log`, generando sus huellas criptográficas SHA-256 en `evidencias/hashes.sha256` para garantizar su integridad forense.

---

## 6. Comparación (Resumen de Actividad 9)

- **PostgreSQL (bitácora + disparador):** Ofrece cobertura integral en entornos open-source al combinar `pg_stat` / bitácora nativa (`log_connections`, `log_statement = 'ddl'`) con disparadores (`TRIGGER`) que capturan valores anteriores (`OLD`) y posteriores (`NEW`).
- **MongoDB Community (perfilador + bitácora):** Cubre accesos exitosos/fallidos, cambios de configuración del perfilador y sentencias de modificación de datos (si el perfilador está activo), pero carece por completo de registro de cambios de privilegios, DDL estructural completo y valores anteriores de documentos.
- **MongoDB Enterprise / Atlas (auditoría nativa):** Cubre de forma nativa y configurada mediante políticas eventos de autenticación, autorización, gestión de usuarios/roles, DDL, operaciones CRUD y eventos de clúster hacia destinos externos inmutables, aunque tampoco captura *before-images* de documentos en el log de auditoría.

---

## 7. Recomendación técnica

Para una organización que requiera auditar formalmente cambios de privilegios y cumplir con marcos normativos en MongoDB, se recomienda:

1. **Hechos verificados en este laboratorio:** MongoDB Community Edition no registra comandos de asignación o revocación de roles (`grantRolesToUser` / `revokeRolesFromUser`) en ninguna bitácora ni en el perfilador; el control compensatorio mediante instantáneas solo detecta estados entre intervalos sin atribución de autoría; y tanto `system.profile` (1 MB) como `getLog` (1024 eventos en RAM) presentan riesgos altos de pérdida de evidencia si no se externalizan.
2. **Supuestos operativos y de negocio:** Se asume que la organización maneja información sujeta a requisitos de cumplimiento legal o auditoría interna (datos fiscales como RFC y datos personales de clientes) y dispone de presupuesto operativo para licenciamiento o servicios gestionados en la nube.
3. **Recomendación:**
   - **Corto plazo (inmediato en Community):** Automatizar cada 5 minutos el script de instantáneas de privilegios hacia un servidor de logs externo (SIEM) de solo anexado (*append-only*), habilitar `systemLog.destination: file` con `logAppend: true`, restringir el acceso al rol `root` bajo control dual y configurar el perfilador con filtro de escritura (`insert`, `update`, `remove`) exportando periódicamente `system.profile`.
   - **Mediano/largo plazo (solución definitiva):** Migrar la instancia productiva a **MongoDB Enterprise Advanced** o **MongoDB Atlas (M10 o superior)** para habilitar la auditoría nativa sobre eventos de autorización, DDL y gestión de roles, enviando la bitácora directamente a un SIEM centralizado.

---

## Anexo: Preguntas de reflexión (Sección 20)

1. **¿Por qué el perfilador no debe presentarse como un mecanismo de auditoría de seguridad?**  
   Porque fue diseñado para optimización de desempeño (*query tuning*), no para seguridad: es mutable (cualquier administrador puede apagarlo o borrar `system.profile`), tiene tamaño limitado con sobrescritura automática (1 MB), impacta el rendimiento en nivel 2 y omite eventos críticos de seguridad como cambios de usuarios, roles y permisos.

2. **¿Por qué el perfilador sí aporta trazabilidad aunque no sea auditoría?**  
   Porque, mientras está activo y antes de que sus registros se sobrescriban, permite reconstruir la secuencia de operaciones ejecutadas sobre las colecciones vinculando el comando exacto, el usuario autenticado (`user`), la aplicación (`appName`), la dirección IP (`client`) y la marca temporal (`ts`).

3. **¿Qué riesgo introduce el nivel 2 al registrar filtros de consultas que pueden contener datos personales?**  
   Expone información confidencial o PII (RFC, correos electrónicos, teléfonos, nombres) en texto plano dentro de `system.profile`. Cualquier usuario o desarrollador con permisos de lectura sobre esa colección podrá visualizar los criterios de búsqueda de otros usuarios, generando una brecha de privacidad.

4. **¿Qué diferencia hay entre detectar un cambio y atribuirlo a alguien?**  
   **Detectar** significa comprobar que un dato o configuración alteró su estado (por ejemplo, ver que el RFC cambió en `clientes` o detectar un nuevo rol en una instantánea). **Atribuir** implica demostrar con evidencia técnica verificable qué identidad específica, desde qué origen y en qué momento exacto ejecutó la acción que provocó dicho cambio.

5. **¿Por qué reconocer una limitación técnica es parte del trabajo profesional del DBA?**  
   Porque ocultar limitaciones o simular controles inexistentes genera una falsa sensación de seguridad y expone a la organización a hallazgos graves de auditoría o brechas no detectadas. Documentar con precisión qué cubre la herramienta y qué requiere controles compensatorios o inversión en licenciamiento permite a la Dirección tomar decisiones informadas de gestión de riesgos.
