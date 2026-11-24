# Actividad 8: Conservación — exportar antes de perder

## Resultados de exportación y verificación de integridad

- Archivo exportado de perfilador: `evidencias/system-profile.json`
- Archivo exportado de bitácora: `evidencias/bitacora-mongod.log`
- Archivo de sumas de verificación SHA-256: `evidencias/hashes.sha256`

## Respuestas a las preguntas

1. **Menciona tres formas en que la evidencia del perfilador o de la bitácora puede perderse sin que nadie la borre deliberadamente.**  
   - **Sobrescritura circular en `system.profile`:** Al ser una *capped collection* de 1 MB por defecto, cuando se llena con tráfico normal o nivel 2, MongoDB elimina automáticamente los documentos más antiguos para insertar los nuevos.
   - **Reinicio del servicio `mongod` sobre `getLog`:** El búfer en memoria consultado por `getLog` solo retiene los últimos 1024 eventos y se vacía por completo cada vez que el servidor se reinicia o sufre una caída.
   - **Sobrescritura de archivo de bitácora al reiniciar:** Si `systemLog.destination: file` está configurado sin `systemLog.logAppend: true`, cada reinicio de `mongod` trunca y reemplaza el archivo de bitácora anterior, destruyendo el historial previo.

2. **¿Por qué el tamaño de 1 MB de `system.profile` es un problema de conservación y no solo de espacio?**  
   Porque `system.profile` está diseñada como una colección limitada (*capped collection*) con comportamiento FIFO (*First-In, First-Out*). Un límite de 1 MB significa que bajo una carga moderada de operaciones (especialmente en nivel 2), la colección puede llenarse en cuestión de minutos o segundos. En consecuencia, las trazas de un incidente de seguridad desaparecen de forma silenciosa y automática antes de que un analista pueda investigarlas, comprometiendo la disponibilidad y retención de evidencia forense.

3. **¿Por qué `getLog` sirve para interpretar pero no para conservar?**  
   Porque `getLog` consulta exclusivamente un búfer circular volátil en la memoria RAM del proceso `mongod` limitado a los **1024 eventos más recientes**. Sirve para diagnóstico rápido e interpretación en tiempo real desde `mongosh`, pero carece de persistencia en disco (se pierde al reiniciar) y de profundidad histórica (eventos antiguos son desplazados rápidamente cuando hay actividad). Para conservar evidencia es indispensable persistir en archivo (`systemLog.path` con `logAppend: true`) y exportar hacia un almacenamiento externo o SIEM.
