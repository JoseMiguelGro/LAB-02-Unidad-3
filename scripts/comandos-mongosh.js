// ============================================================================
// LAB-02: Trazabilidad en MongoDB Community
// Script de referencia para ejecución en mongosh
// ============================================================================

// ----------------------------------------------------------------------------
// SECCIÓN 6.3: Creación de usuarios y datos iniciales (Excepción localhost)
// ----------------------------------------------------------------------------
use admin;
db.createUser({
  user: "admin",
  pwd: "<REDACTED>",
  roles: ["root"]
});
db.auth("admin", "<REDACTED>");

use comercial;
db.createUser({
  user: "app_ventas",
  pwd: "<REDACTED>",
  roles: [{ role: "readWrite", db: "comercial" }]
});

db.clientes.insertMany([
  { _id: 1, nombre: "Ana López", correo: "ana.lopez@example.test", telefono: "6671234567", rfc: "LOAA850315ABC", edad: 41, ciudad: "Culiacán", codigo_postal: "80000" },
  { _id: 2, nombre: "Carlos Pérez", correo: "carlos.perez@example.test", telefono: "6672345678", rfc: "PECA900720DEF", edad: 35, ciudad: "Culiacán", codigo_postal: "80100" },
  { _id: 3, nombre: "María García", correo: "maria.garcia@example.test", telefono: "6673456789", rfc: "GAMA780912GHI", edad: 47, ciudad: "Mazatlán", codigo_postal: "82000" },
  { _id: 4, nombre: "Luis Torres", correo: "luis.torres@example.test", telefono: "6674567890", rfc: "TOLU920201JKL", edad: 34, ciudad: "Los Mochis", codigo_postal: "81200" },
  { _id: 5, nombre: "Laura Sánchez", correo: "laura.sanchez@example.test", telefono: "6675678901", rfc: "SALA880525MNO", edad: 38, ciudad: "Culiacán", codigo_postal: "80200" }
]);

// ----------------------------------------------------------------------------
// SECCIÓN 6.4: Función auxiliar para consultar bitácora JSON en memoria
// ----------------------------------------------------------------------------
function bitacora() {
  return db.adminCommand({ getLog: "global" }).log.map(l => JSON.parse(l));
}

// ----------------------------------------------------------------------------
// ACTIVIDAD 1: Verificación de edición y parámetros de arranque
// ----------------------------------------------------------------------------
db.version();
db.adminCommand({ buildInfo: 1 }).modules;
db.serverCmdLineOpts().parsed;

// ----------------------------------------------------------------------------
// ACTIVIDAD 2: Incidente sin perfilado
// ----------------------------------------------------------------------------
db.getProfilingStatus();
db.system.profile.countDocuments();
bitacora().filter(e => JSON.stringify(e).includes("GAMA780912XXX")).length;
bitacora().filter(e => JSON.stringify(e).includes("app-ventas-web")).map(e => ({
  t: e.t,
  c: e.c,
  ctx: e.ctx,
  msg: e.msg
}));

// ----------------------------------------------------------------------------
// ACTIVIDAD 3: Activar perfilador nivel 2 y consultar system.profile
// ----------------------------------------------------------------------------
db.setProfilingLevel(2);
db.getProfilingStatus();

db.system.profile.find(
  { ns: "comercial.clientes" },
  { op: 1, ns: 1, command: 1, user: 1, client: 1, appName: 1, ts: 1, millis: 1, nreturned: 1, docsExamined: 1, nModified: 1, ndeleted: 1 }
).sort({ ts: 1 });

// ----------------------------------------------------------------------------
// ACTIVIDAD 4: Reducir volumen con filtro de escritura
// ----------------------------------------------------------------------------
db.setProfilingLevel(0);
db.system.profile.drop();
db.setProfilingLevel(1, { filter: { op: { $in: ["insert", "update", "remove"] } } });
db.getProfilingStatus();

db.system.profile.find({}, { op: 1, ns: 1, user: 1, appName: 1, "command.q": 1, "command.u": 1, ts: 1 });

// ----------------------------------------------------------------------------
// ACTIVIDAD 5: Revisión de accesos fallidos y exitosos en bitácora
// ----------------------------------------------------------------------------
bitacora()
  .filter(e => e.c === "ACCESS" && e.msg === "Failed to authenticate")
  .map(e => ({
    t: e.t,
    id: e.id,
    ctx: e.ctx,
    user: e.attr.user,
    client: e.attr.client,
    error: e.attr.error,
    result: e.attr.result,
    app: e.attr.doc.application.name
  }));

bitacora()
  .filter(e => e.msg === "Successfully authenticated" && e.attr.user === "app_ventas")
  .slice(-1)
  .map(e => ({
    t: e.t,
    id: e.id,
    ctx: e.ctx,
    client: e.attr.client,
    result: e.attr.result,
    app: e.attr.doc.application.name
  }));

// ----------------------------------------------------------------------------
// ACTIVIDAD 6: Correlación de cambio de configuración mediante ctx
// ----------------------------------------------------------------------------
bitacora()
  .filter(e => e.msg === "Profiler settings changed")
  .map(e => ({ t: e.t, ctx: e.ctx, msg: e.msg, attr: e.attr }));

// Sustituir "conn31" por el ctx observado
bitacora()
  .filter(e => e.ctx === "conn31" && e.msg === "Successfully authenticated")
  .map(e => ({ t: e.t, ctx: e.ctx, user: e.attr.user, db: e.attr.db, client: e.attr.client }));

// ----------------------------------------------------------------------------
// ACTIVIDAD 7: Control compensatorio para cambios de privilegios
// ----------------------------------------------------------------------------
db.getSiblingDB("auditoria").instantaneas_privilegios.insertOne({
  momento: new Date(),
  tomada_por: db.runCommand({ connectionStatus: 1 }).authInfo.authenticatedUsers,
  usuarios: db.getUsers().users.map(u => ({ user: u.user, db: u.db, roles: u.roles }))
});

db.setProfilingLevel(2);
db.grantRolesToUser("app_ventas", [{ role: "dbAdmin", db: "comercial" }]);

db.system.profile.countDocuments({ "command.grantRolesToUser": { $exists: true } });
bitacora().filter(e => JSON.stringify(e).includes("grantRoles")).length;

// Segunda instantánea después del cambio
db.getSiblingDB("auditoria").instantaneas_privilegios.insertOne({
  momento: new Date(),
  tomada_por: db.runCommand({ connectionStatus: 1 }).authInfo.authenticatedUsers,
  usuarios: db.getUsers().users.map(u => ({ user: u.user, db: u.db, roles: u.roles }))
});

db.getSiblingDB("auditoria").instantaneas_privilegios.find({}, { _id: 0 }).sort({ momento: 1 });

// Revocación y restauración de filtro
db.revokeRolesFromUser("app_ventas", [{ role: "dbAdmin", db: "comercial" }]);
db.setProfilingLevel(1, { filter: { op: { $in: ["insert", "update", "remove"] } } });
