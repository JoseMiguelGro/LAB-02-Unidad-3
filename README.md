# LAB-02: Trazabilidad en MongoDB Community

**Materia:** Gestión de Seguridad y Desempeño de Bases de Datos  
**Unidad:** III - Auditoría, trazabilidad y gobierno práctico de datos  
**Motor:** MongoDB 7.0.43 Community Edition  
**Despliegue:** Contenedor Docker (`mongo:7`) con autorización habilitada (`--auth`) / Instalación local Linux con `security.authorization: enabled`  
**Alumno:** Jose Miguel Guerrero Romero  

---

## Descripción del laboratorio

Este repositorio contiene el desarrollo completo, evidencias, scripts, exportaciones e informe técnico del **LAB-02**, cuyo objetivo es configurar, ejecutar e interpretar los mecanismos de trazabilidad nativos disponibles en **MongoDB Community Edition** (el perfilador de base de datos `system.profile` y la bitácora estructurada en JSON de `mongod`), documentando con rigor técnico qué eventos cubren, cuáles no, cómo aplicar controles compensatorios y qué capacidades adicionales aporta la auditoría nativa de MongoDB Enterprise / Atlas.

---

## Despliegue y configuración del entorno

- **Motor y versión:** MongoDB `7.0.43` Community Edition (`modules: []`).
- **Cliente:** `mongosh 2.10.0`.
- **Habilitación de seguridad:** `security.authorization: enabled` (mediante configuración en `/etc/mongod.conf` o bandera `--auth` en contenedor `docker run --name dba-u3-mongo -p 27017:27017 -d mongo:7 --auth`).
- **Redacción de credenciales:** Siguiendo las políticas de seguridad del laboratorio, todas las contraseñas en las evidencias y reportes han sido sustituidas por `<REDACTED>`.

---

## Estructura del repositorio

```text
LAB-02-Unidad-3/
├── README.md
├── informe.md
├── evidencias/
│   ├── 01-edicion-y-limitacion.md
│   ├── 02-incidente-sin-perfilado.md
│   ├── 03-perfilador.md
│   ├── 04-filtro.md
│   ├── 05-accesos-mongod.md
│   ├── 06-correlacion.md
│   ├── 07-privilegios-control-compensatorio.md
│   ├── 08-conservacion.md
│   ├── 09-comparacion.md
│   ├── 10-respuesta-direccion.md
│   ├── system-profile.json
│   ├── bitacora-mongod.log
│   └── hashes.sha256
└── scripts/
    └── comandos-mongosh.js
```

---

## Historial de commits sugerido

1. `docs: documenta edicion de MongoDB y limitacion de auditoria`
2. `feat: configura perfilador de la base comercial`
3. `docs: interpreta system.profile y bitacora de mongod`
4. `feat: agrega instantaneas de privilegios como control compensatorio`
5. `docs: agrega evidencias exportadas, comparacion e informe`