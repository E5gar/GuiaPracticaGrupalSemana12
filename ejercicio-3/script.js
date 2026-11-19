const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));
const pad = (n) => String(n).padStart(2, "0");
const esc = (value) => String(value).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" })[c]);
const sanitize = (value) => String(value == null ? "" : value).replace(/<[^>]*>/g, "").replace(/[<>]/g, "").replace(/\s+/g, " ").trim();
const isoDate = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const todayIso = () => isoDate(new Date());
const addDays = (iso, n) => {
  const d = new Date(`${iso}T00:00:00`);
  d.setDate(d.getDate() + n);
  return isoDate(d);
};
const dayOfWeek = (iso) => new Date(`${iso}T00:00:00`).getDay();
const toMin = (hhmm) => {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
};
const fromMin = (min) => `${pad(Math.floor(min / 60))}:${pad(min % 60)}`;
const slotsFor = (iso) => {
  const dow = dayOfWeek(iso);
  if (dow === 0) {
    return [];
  }
  const last = dow === 6 ? 12 * 60 + 30 : 17 * 60 + 30;
  const out = [];
  for (let m = 8 * 60; m <= last; m += 30) {
    out.push(fromMin(m));
  }
  return out;
};
const ageOf = (iso) => {
  const born = new Date(`${iso}T00:00:00`);
  const now = new Date();
  let age = now.getFullYear() - born.getFullYear();
  const beforeBirthday = now.getMonth() < born.getMonth() || (now.getMonth() === born.getMonth() && now.getDate() < born.getDate());
  if (beforeBirthday) {
    age -= 1;
  }
  return age;
};
const daysBetween = (fromIso, toIso) => Math.round((new Date(`${toIso}T00:00:00`) - new Date(`${fromIso}T00:00:00`)) / 86400000);
const hashPass = (text) => {
  let h = 5381;
  for (const ch of text) {
    h = ((h << 5) + h + ch.charCodeAt(0)) >>> 0;
  }
  return `h${h.toString(16)}`;
};

const DB_KEY = "ta_db_v1";
const CLOCK_KEY = "ta_clock";
const AREAS = ["Sistemas", "Contabilidad", "Ventas", "Logistica", "RRHH"];
const DOMINIO = "@tecnoandes.pe";

const hooks = { boot: [], render: [] };
const state = { user: null, view: "empleados" };
let can = () => true;

const nowDate = () => {
  const saved = localStorage.getItem(CLOCK_KEY);
  return saved ? new Date(saved) : new Date();
};
const nowIso = () => isoDate(nowDate());
const nowHHMM = () => `${pad(nowDate().getHours())}:${pad(nowDate().getMinutes())}`;
const stamp = () => `${nowIso()} ${nowHHMM()}:${pad(nowDate().getSeconds())}`;
const isWorkday = (iso) => dayOfWeek(iso) >= 1 && dayOfWeek(iso) <= 5;

const calcHoras = (a) => (a.salida ? Math.round(((toMin(a.salida) - toMin(a.entrada)) / 60) * 100) / 100 : 0);
const calcExtras = (a) => Math.max(0, Math.round((calcHoras(a) - 8) * 100) / 100);

const seedDb = () => {
  const areas = AREAS.map((nombre, i) => ({ id: i + 1, nombre, jefeId: [1, 4, 5, 7, 11][i] }));
  const base = [
    ["Rosa", "Quispe Lara", "Jefe de Sistemas", 1, "2019-03-04", "planilla", 7800],
    ["Luis", "Huaman Soto", "Desarrollador", 1, "2022-08-15", "planilla", 4200],
    ["Marta", "Paredes Rios", "Contador General", 2, "2020-01-13", "planilla", 5200],
    ["Jorge", "Salazar Ortiz", "Jefe de Contabilidad", 2, "2018-06-01", "planilla", 7200],
    ["Elena", "Camayo Diaz", "Jefe de Ventas", 3, "2017-09-18", "planilla", 7000],
    ["Diego", "Rivera Cruz", "Ejecutivo de Ventas", 3, "2023-02-20", "planilla", 3600],
    ["Patricia", "Ramos Tello", "Jefe de Logistica", 4, "2019-11-11", "planilla", 6800],
    ["Carlos", "Mendoza Valle", "Almacenero", 4, "2024-01-08", "locacion", 2800],
    ["Ana", "Garcia Pena", "Analista QA", 1, "2023-07-03", "planilla", 3900],
    ["Hugo", "Navarro Gil", "Ejecutivo de Ventas", 3, "2024-05-27", "locacion", 3400],
    ["Sofia", "Torres Lopez", "Gerente de RRHH", 5, "2016-02-01", "planilla", 9500],
    ["Raul", "Salas Vega", "Asistente de RRHH", 5, "2021-04-19", "planilla", 3000]
  ];
  const empleados = base.map((r, i) => ({
    id: i + 1,
    dni: String(40125000 + i * 7919),
    nombres: r[0],
    apellidos: r[1],
    cargo: r[2],
    areaId: r[3],
    ingreso: r[4],
    contrato: r[5],
    email: `${r[0]}.${r[1].split(" ")[0]}${DOMINIO}`.toLowerCase(),
    salario: r[6],
    activo: i !== 11
  }));
  const hoy = todayIso();
  const dias = [];
  let cursor = addDays(hoy, -1);
  while (dias.length < 5) {
    if (isWorkday(cursor)) {
      dias.push(cursor);
    }
    cursor = addDays(cursor, -1);
  }
  const asistencias = [];
  empleados.filter((e) => e.activo).forEach((e, i) => {
    dias.forEach((fecha, d) => {
      const entrada = fromMin(7 * 60 + 45 + ((i * 7 + d * 3) % 30));
      const salida = fromMin(17 * 60 + ((i * 11 + d * 5) % 100));
      asistencias.push({ id: asistencias.length + 1, empleadoId: e.id, fecha, entrada, salida, creado: `${fecha}T${entrada}`, corregido: false });
    });
  });
  const mk = (empleadoId, tipo, ini, dur, estado, motivo, resueltoPor) => ({
    id: 0,
    empleadoId,
    tipo,
    inicio: addDays(hoy, ini),
    fin: addDays(hoy, ini + dur - 1),
    motivo,
    adjunto: tipo === "medico" ? "Certificado medico simulado CM-2026" : "",
    estado,
    creado: addDays(hoy, -3),
    resueltoPor: resueltoPor || ""
  });
  const permisos = [
    mk(2, "vacaciones", -40, 5, "aprobado", "Vacaciones familiares programadas con anticipacion", "rosa.quispe"),
    mk(9, "vacaciones", -60, 10, "aprobado", "Vacaciones de verano acordadas con el area", "rosa.quispe"),
    mk(2, "personal", 3, 1, "pendiente", "Tramite personal en notaria que requiere asistencia presencial"),
    mk(6, "medico", 2, 2, "pendiente", "Cita con especialista y examenes de laboratorio programados"),
    mk(8, "personal", 5, 1, "pendiente", "Gestion de documentos en el registro civil de la ciudad"),
    mk(9, "duelo", 1, 3, "pendiente", "Fallecimiento de un familiar cercano fuera de la ciudad"),
    mk(4, "otro", 7, 1, "pendiente", "Capacitacion externa sobre normas tributarias vigentes"),
    mk(10, "medico", -10, 1, "rechazado", "Control medico de rutina programado en horario laboral", "elena.camayo"),
    mk(3, "personal", -20, 1, "aprobado", "Matricula de hijo en institucion educativa de la ciudad", "sofia.torres"),
    mk(7, "vacaciones", 20, 7, "aprobado", "Vacaciones programadas por cierre de inventario anual", "sofia.torres")
  ];
  permisos.forEach((p, i) => {
    p.id = i + 1;
  });
  const pass = hashPass("Tecno2026");
  const users = [
    { username: "rrhh", hash: pass, grupo: "Admin RRHH", empleadoId: 11, activo: true },
    { username: "jefe.sistemas", hash: pass, grupo: "Jefe de Area", empleadoId: 1, activo: true },
    { username: "jefe.ventas", hash: pass, grupo: "Jefe de Area", empleadoId: 5, activo: true },
    { username: "empleado1", hash: pass, grupo: "Empleado", empleadoId: 2, activo: true },
    { username: "empleado2", hash: pass, grupo: "Empleado", empleadoId: 6, activo: true },
    { username: "contador", hash: pass, grupo: "Contador", empleadoId: 3, activo: true },
    { username: "exempleado", hash: pass, grupo: "Empleado", empleadoId: 12, activo: false }
  ];
  return { areas, empleados, asistencias, permisos, users, notificaciones: [], logs: [] };
};

const loadDb = () => {
  try {
    const raw = localStorage.getItem(DB_KEY);
    if (raw) {
      return JSON.parse(raw);
    }
  } catch (err) {
    return null;
  }
  return null;
};
let db = loadDb() || seedDb();
const saveDb = () => localStorage.setItem(DB_KEY, JSON.stringify(db));
saveDb();

const byId = (list, id) => list.find((item) => item.id === Number(id));
const fullName = (p) => `${p.apellidos}, ${p.nombres}`;
const nextId = (list) => list.reduce((max, item) => Math.max(max, item.id), 0) + 1;
const areaName = (id) => byId(db.areas, id).nombre;

const toast = (message, kind = "ok") => {
  const region = $("#toast-region");
  const node = document.createElement("div");
  node.className = `toast toast-${kind}`;
  node.textContent = message;
  region.appendChild(node);
  window.setTimeout(() => node.remove(), 4200);
};

const fieldHtml = (f) => {
  let control;
  if (f.type === "select") {
    control = `<select id="${f.id}" name="${f.id}">${f.options.map((o) => `<option value="${esc(o.value)}">${esc(o.label)}</option>`).join("")}</select>`;
  } else if (f.type === "textarea") {
    control = `<textarea id="${f.id}" name="${f.id}" rows="${f.rows || 3}" placeholder="${esc(f.placeholder || "")}"></textarea>`;
  } else {
    control = `<input id="${f.id}" name="${f.id}" type="${f.type || "text"}" placeholder="${esc(f.placeholder || "")}" ${f.attrs || ""} autocomplete="off">`;
  }
  const hint = f.hint ? `<span class="field-hint">${esc(f.hint)}</span>` : "";
  return `<div class="field${f.wide ? " field-wide" : ""}"><label for="${f.id}">${esc(f.label)}</label>${control}${hint}<p class="field-error" data-error-for="${f.id}" role="alert"></p></div>`;
};

const setErrors = (form, errors) => {
  $$("[data-error-for]", form).forEach((node) => {
    const message = errors[node.dataset.errorFor] || "";
    node.textContent = message;
    const input = $(`#${node.dataset.errorFor}`, form);
    if (input) {
      input.classList.toggle("is-invalid", Boolean(message));
    }
  });
};

const readForm = (form) => {
  const data = {};
  new FormData(form).forEach((value, key) => {
    data[key] = typeof value === "string" ? value.trim() : value;
  });
  return data;
};

const pill = (text, color) => `<span class="pill pill-${color}">${esc(text)}</span>`;
const estadoPill = (estado) => pill(estado, estado === "completada" ? "green" : estado === "cancelada" ? "amber" : "blue");

const middlewares = [];
const useMiddleware = (name, fn, first = false) => {
  const entry = { name, fn };
  if (first) {
    middlewares.unshift(entry);
  } else {
    middlewares.push(entry);
  }
};

const dispatch = (req) => {
  req.user = state.user;
  let index = 0;
  const next = () => {
    const mw = middlewares[index];
    index += 1;
    if (!mw) {
      return { ok: true, status: 200 };
    }
    return mw.fn(req, next);
  };
  return next();
};

const views = [];
const registerView = (view) => {
  views.push(view);
  views.sort((a, b) => a.order - b.order);
};

const deniedHtml = (res) => `
  <div class="panel denied stack-sm">
    <div class="flex-wrap items-center">${pill(`Error ${res.status}`, "amber")}</div>
    <h2 class="h3">${res.status === 401 ? "Autenticacion requerida" : "Acceso denegado"}</h2>
    <p class="text-muted">${esc(res.reason)}</p>
    <div class="form-actions"><button class="btn btn-primary" type="button" data-go="sesion">Ir a Sesion</button></div>
  </div>`;

const renderTabs = () => {
  const nav = $("#tabs");
  nav.innerHTML = views.map((v) => `<button type="button" class="tab${v.id === state.view ? " is-active" : ""}" data-view="${v.id}">${esc(v.title)}</button>`).join("");
  $$("button", nav).forEach((button) => button.addEventListener("click", () => navigate(button.dataset.view)));
};

const renderApp = () => {
  renderTabs();
  const view = views.find((v) => v.id === state.view) || views[0];
  const host = $("#view");
  host.innerHTML = "";
  const res = dispatch({ kind: "view", name: view.id, perm: view.perm });
  if (res.ok) {
    view.render(host);
  } else {
    host.innerHTML = deniedHtml(res);
    const go = $("[data-go]", host);
    if (go) {
      go.addEventListener("click", () => navigate(go.dataset.go));
    }
  }
  hooks.render.forEach((fn) => fn());
};

const navigate = (id) => {
  state.view = id;
  renderApp();
};

const optionsFrom = (list, labelFn, placeholder) => {
  const options = list.map((item) => ({ value: item.id, label: labelFn(item) }));
  return placeholder ? [{ value: "", label: placeholder }, ...options] : options;
};

const antiguedad = (ingreso) => {
  const start = new Date(`${ingreso}T00:00:00`);
  const end = nowDate();
  let months = (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth());
  if (end.getDate() < start.getDate()) {
    months -= 1;
  }
  months = Math.max(0, months);
  return `${Math.floor(months / 12)} anios y ${months % 12} meses`;
};

const miEmpleado = () => (state.user ? byId(db.empleados, state.user.empleadoId) : null);
const miArea = () => (miEmpleado() ? miEmpleado().areaId : null);

const scopeEmpleados = () => {
  if (state.user && state.user.grupo === "Jefe de Area") {
    return db.empleados.filter((e) => e.areaId === miArea());
  }
  return db.empleados;
};

const validateEmpleado = (d) => {
  const errors = {};
  if (!/^\d{8}$/.test(d.dni || "")) {
    errors.dni = "El DNI debe tener exactamente 8 digitos numericos.";
  } else if (db.empleados.some((e) => e.dni === d.dni)) {
    errors.dni = "El DNI ya esta registrado en el sistema (debe ser unico).";
  }
  if (sanitize(d.nombres).length < 2) {
    errors.nombres = "Ingresa los nombres.";
  }
  if (sanitize(d.apellidos).length < 2) {
    errors.apellidos = "Ingresa los apellidos.";
  }
  if (sanitize(d.cargo).length === 0) {
    errors.cargo = "El cargo no puede estar vacio.";
  }
  if (!/^[a-z0-9._-]+@tecnoandes\.pe$/i.test(d.email || "")) {
    errors.email = "El correo corporativo debe tener el formato usuario@tecnoandes.pe.";
  } else if (db.empleados.some((e) => e.email === d.email.toLowerCase())) {
    errors.email = "Ya existe un empleado con ese correo corporativo.";
  }
  if (!d.ingreso) {
    errors.ingreso = "Selecciona la fecha de ingreso.";
  } else if (d.ingreso > todayIso()) {
    errors.ingreso = "La fecha de ingreso no puede ser futura.";
  }
  if (!d.salario || Number(d.salario) <= 0) {
    errors.salario = "Ingresa un salario mensual valido.";
  }
  return errors;
};

const renderEmpleados = (host) => {
  const fields = [
    { id: "dni", label: "DNI", placeholder: "8 digitos", attrs: 'inputmode="numeric" maxlength="12"' },
    { id: "nombres", label: "Nombres" },
    { id: "apellidos", label: "Apellidos" },
    { id: "cargo", label: "Cargo" },
    { id: "area", label: "Area", type: "select", options: db.areas.map((a) => ({ value: a.id, label: a.nombre })) },
    { id: "ingreso", label: "Fecha de ingreso", type: "date", attrs: `max="${todayIso()}"` },
    { id: "contrato", label: "Tipo de contrato", type: "select", options: [{ value: "planilla", label: "Planilla" }, { value: "locacion", label: "Locacion de servicios" }] },
    { id: "email", label: "Correo corporativo", type: "email", placeholder: "usuario@tecnoandes.pe" },
    { id: "salario", label: "Salario mensual (S/)", type: "number", attrs: 'min="0" step="50"' }
  ];
  const formBlock = can("registrar_empleado")
    ? `<form id="form-empleado" class="stack-md" novalidate>
        <div class="form-grid">${fields.map(fieldHtml).join("")}</div>
        <div class="form-actions"><button class="btn btn-primary" type="submit">Registrar empleado</button><button class="btn btn-surface" type="reset">Limpiar</button></div>
      </form>`
    : `<p class="text-muted">Solo el Admin RRHH puede registrar empleados.</p>`;
  host.innerHTML = `
    <div class="panel stack-md">
      <div class="panel-head"><div class="stack-xs"><h2 class="h3">Registro de empleados</h2><p class="text-muted">DNI unico, correo corporativo y fecha de ingreso validados.</p></div>${pill(`${db.empleados.length} empleados`, "violet")}</div>
      ${formBlock}
    </div>
    <div class="panel stack-md">
      <div class="panel-head"><h2 class="h3">Nomina</h2>
        <div class="field"><label class="sr-only" for="filtro-area">Filtrar por area</label>
          <select id="filtro-area"><option value="">Todas las areas</option>${db.areas.map((a) => `<option value="${a.id}">${esc(a.nombre)}</option>`).join("")}</select>
        </div>
      </div>
      <div id="tabla-empleados"></div>
    </div>`;
  const refresh = () => {
    const area = $("#filtro-area", host).value;
    const list = scopeEmpleados().filter((e) => !area || e.areaId === Number(area));
    const salaryVisible = can("ver_salarios");
    $("#tabla-empleados", host).innerHTML = `<div class="table-wrap"><table class="data-table">
      <thead><tr><th>DNI</th><th>Empleado</th><th>Cargo</th><th>Area</th><th>Contrato</th><th>Ingreso</th><th>Antiguedad</th><th>Salario</th></tr></thead>
      <tbody>${list.map((e) => `<tr><td>${salaryVisible || !state.user ? esc(e.dni) : esc(e.dni.slice(0, 2) + "******")}</td><td>${esc(fullName(e))}${e.activo ? "" : " " + pill("inactivo", "amber")}</td><td>${esc(e.cargo)}</td><td>${esc(areaName(e.areaId))}</td><td>${pill(e.contrato, e.contrato === "planilla" ? "blue" : "violet")}</td><td>${esc(e.ingreso)}</td><td>${esc(antiguedad(e.ingreso))}</td><td>${salaryVisible ? `S/ ${Number(e.salario).toLocaleString("es-PE")}` : "Restringido"}</td></tr>`).join("")}</tbody>
    </table></div><p class="text-caption">${list.length} empleados mostrados. Salarios y datos personales solo visibles para RRHH.</p>`;
  };
  $("#filtro-area", host).addEventListener("change", refresh);
  refresh();
  const form = $("#form-empleado", host);
  if (!form) {
    return;
  }
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const data = readForm(form);
    data.nombres = sanitize(data.nombres);
    data.apellidos = sanitize(data.apellidos);
    data.cargo = sanitize(data.cargo);
    const errors = validateEmpleado(data);
    setErrors(form, errors);
    if (Object.keys(errors).length > 0) {
      toast("Revisa los campos marcados en el formulario.", "error");
      return;
    }
    const res = dispatch({ kind: "action", name: "registrar_empleado", perm: "registrar_empleado", data });
    if (!res.ok) {
      toast(res.reason, "error");
      return;
    }
    db.empleados.push({ id: nextId(db.empleados), dni: data.dni, nombres: data.nombres, apellidos: data.apellidos, cargo: data.cargo, areaId: Number(data.area), ingreso: data.ingreso, contrato: data.contrato, email: data.email.toLowerCase(), salario: Number(data.salario), activo: true });
    saveDb();
    form.reset();
    toast("Empleado registrado correctamente.");
    renderApp();
  });
};

registerView({ id: "empleados", title: "Empleados", order: 30, perm: "ver_equipo", render: renderEmpleados });

document.addEventListener("DOMContentLoaded", () => {
  hooks.boot.forEach((fn) => fn());
  renderApp();
});

const permisoPill = (estado) => pill(estado, estado === "aprobado" ? "green" : estado === "rechazado" ? "violet" : "amber");
const diasDe = (p) => daysBetween(p.inicio, p.fin) + 1;
const vacacionesTomadas = (empleadoId, withPending) => db.permisos.filter((p) => p.empleadoId === empleadoId && p.tipo === "vacaciones" && (p.estado === "aprobado" || (withPending && p.estado === "pendiente"))).reduce((sum, p) => sum + diasDe(p), 0);
const vacacionesDisponibles = (empleadoId) => 30 - vacacionesTomadas(empleadoId, false);

const actorSelectHtml = () => (state.user ? "" : `<div class="field"><label for="actor">Empleado (simulacion sin sesion)</label><select id="actor">${db.empleados.filter((e) => e.activo).map((e) => `<option value="${e.id}">${esc(fullName(e))} - ${esc(areaName(e.areaId))}</option>`).join("")}</select></div>`);
const actorId = (host) => {
  if (state.user) {
    return state.user.empleadoId;
  }
  const select = $("#actor", host);
  return select ? Number(select.value) : null;
};

const asistenciaTable = (list, withEmpleado) => `
  <div class="table-wrap"><table class="data-table">
    <thead><tr><th>Fecha</th>${withEmpleado ? "<th>Empleado</th>" : ""}<th>Entrada</th><th>Salida</th><th>Horas</th><th>Horas extra</th><th>Origen</th></tr></thead>
    <tbody>${list.length === 0 ? `<tr><td colspan="7" class="empty-state">Sin registros de asistencia.</td></tr>` : list.map((a) => `<tr><td>${esc(a.fecha)}</td>${withEmpleado ? `<td>${esc(fullName(byId(db.empleados, a.empleadoId)))}</td>` : ""}<td>${esc(a.entrada)}</td><td>${a.salida ? esc(a.salida) : pill("abierta", "amber")}</td><td>${a.salida ? calcHoras(a).toFixed(2) : "-"}</td><td>${calcExtras(a) > 0 ? pill(`+${calcExtras(a).toFixed(2)} h`, "violet") : "0.00"}</td><td>${a.corregido ? pill("corregido RRHH", "blue") : "marcacion"}</td></tr>`).join("")}</tbody>
  </table></div>`;

const renderMarcacion = (host) => {
  const saved = localStorage.getItem(CLOCK_KEY);
  host.innerHTML = `
    <div class="panel stack-md">
      <div class="panel-head"><div class="stack-xs"><h2 class="h3">Reloj del sistema</h2><p class="text-muted">Hora usada para marcar asistencia y validar horarios. Puedes simularla para las pruebas.</p></div>${pill(`${nowIso()} ${nowHHMM()}`, "blue")}</div>
      <div class="form-actions">
        <div class="field" style="flex: 1 1 16rem;"><label for="reloj">Hora simulada</label><input id="reloj" type="datetime-local" value="${saved || ""}"></div>
        <button class="btn btn-surface" type="button" id="reloj-aplicar">Aplicar hora simulada</button>
        <button class="btn btn-surface" type="button" id="reloj-real">Usar hora real</button>
      </div>
    </div>
    <div class="panel stack-md">
      <div class="panel-head"><div class="stack-xs"><h2 class="h3">Marcacion de asistencia</h2><p class="text-muted">El registro toma la hora del sistema al enviar el formulario. Jornada de 8 horas, extras sobre ese limite.</p></div>${pill("Formulario diario", "green")}</div>
      <form id="form-marcar" class="stack-md" novalidate>
        ${actorSelectHtml()}
        <p class="field-error" id="marcar-error" role="alert"></p>
        <div class="form-actions"><button class="btn btn-primary" type="submit" name="tipo" value="entrada">Marcar entrada</button><button class="btn btn-surface" type="submit" name="tipo" value="salida">Marcar salida</button></div>
      </form>
      <div id="marcar-historial" class="stack-sm"></div>
    </div>`;
  const refresh = () => {
    const id = actorId(host);
    const list = db.asistencias.filter((a) => a.empleadoId === id).sort((a, b) => `${b.fecha}${b.entrada}`.localeCompare(`${a.fecha}${a.entrada}`)).slice(0, 8);
    $("#marcar-historial", host).innerHTML = `<h3 class="h4">Mis ultimos registros</h3>${asistenciaTable(list, false)}`;
  };
  refresh();
  const actor = $("#actor", host);
  if (actor) {
    actor.addEventListener("change", refresh);
  }
  $("#reloj-aplicar", host).addEventListener("click", () => {
    const value = $("#reloj", host).value;
    if (!value) {
      toast("Selecciona una fecha y hora para simular.", "error");
      return;
    }
    localStorage.setItem(CLOCK_KEY, value);
    toast("Hora simulada aplicada.");
    renderApp();
  });
  $("#reloj-real", host).addEventListener("click", () => {
    localStorage.removeItem(CLOCK_KEY);
    toast("Se usa la hora real del equipo.");
    renderApp();
  });
  const form = $("#form-marcar", host);
  const errorNode = $("#marcar-error", host);
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const tipo = event.submitter ? event.submitter.value : "entrada";
    const empleadoId = actorId(host);
    const fecha = nowIso();
    const hora = nowHHMM();
    const abierto = db.asistencias.filter((a) => a.empleadoId === empleadoId && !a.salida).sort((a, b) => `${b.fecha}${b.entrada}`.localeCompare(`${a.fecha}${a.entrada}`))[0];
    let message = "";
    if (tipo === "entrada") {
      const hoy = db.asistencias.find((a) => a.empleadoId === empleadoId && a.fecha === fecha && !a.salida);
      if (hoy) {
        message = `Ya registraste una entrada hoy a las ${hoy.entrada} y aun no marcaste salida.`;
      }
    } else if (!abierto) {
      message = "No tienes una entrada abierta para registrar la salida.";
    } else if (abierto.fecha !== fecha) {
      message = `El registro del ${abierto.fecha} supera las 24 horas y el empleado ya no puede modificarlo. Solicita una correccion a RRHH.`;
    } else if (toMin(hora) <= toMin(abierto.entrada)) {
      message = `La hora de salida (${hora}) debe ser posterior a la entrada (${abierto.entrada}).`;
    }
    errorNode.textContent = message;
    if (message) {
      toast(message, "error");
      return;
    }
    const res = dispatch({ kind: "action", name: `marcar_${tipo}`, perm: "registrar_asistencia", data: { empleadoId, fecha, hora } });
    if (!res.ok) {
      errorNode.textContent = res.reason;
      toast(res.reason, "error");
      return;
    }
    if (tipo === "entrada") {
      db.asistencias.push({ id: nextId(db.asistencias), empleadoId, fecha, entrada: hora, salida: null, creado: `${fecha}T${hora}`, corregido: false });
      toast(`Entrada registrada a las ${hora}.`);
    } else {
      abierto.salida = hora;
      const extras = calcExtras(abierto);
      toast(`Salida registrada. Horas trabajadas: ${calcHoras(abierto).toFixed(2)}${extras > 0 ? `, horas extra: ${extras.toFixed(2)}` : ""}.`);
    }
    saveDb();
    refresh();
  });
};

const renderCorreccion = (host) => {
  const recientes = db.asistencias.slice().sort((a, b) => `${b.fecha}${b.entrada}`.localeCompare(`${a.fecha}${a.entrada}`)).slice(0, 40);
  const fields = [
    { id: "registro", label: "Registro de asistencia", type: "select", wide: true, options: optionsFrom(recientes, (a) => `${a.fecha} - ${fullName(byId(db.empleados, a.empleadoId))} (${a.entrada} a ${a.salida || "sin salida"})`, "Selecciona el registro a corregir") },
    { id: "entrada", label: "Nueva hora de entrada", type: "time" },
    { id: "salida", label: "Nueva hora de salida", type: "time" },
    { id: "motivo", label: "Motivo", type: "select", options: [{ value: "", label: "Selecciona el motivo" }, { value: "error de sistema", label: "Error de sistema" }, { value: "olvido", label: "Olvido" }, { value: "otro", label: "Otro" }] },
    { id: "justificacion", label: "Justificacion (minimo 50 caracteres)", type: "textarea", wide: true, placeholder: "Describe con detalle por que se corrige el registro" }
  ];
  host.innerHTML = `
    <div class="panel stack-md">
      <div class="panel-head"><div class="stack-xs"><h2 class="h3">Correccion de asistencia</h2><p class="text-muted">Solo RRHH. Requiere motivo y justificacion obligatoria. Todo cambio queda en auditoria.</p></div>${pill("Solo RRHH", "amber")}</div>
      <form id="form-correccion" class="stack-md" novalidate>
        <div class="form-grid">${fields.map(fieldHtml).join("")}</div>
        <div class="form-actions"><button class="btn btn-primary" type="submit">Aplicar correccion</button><button class="btn btn-surface" type="reset">Limpiar</button></div>
      </form>
    </div>`;
  const form = $("#form-correccion", host);
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const data = readForm(form);
    const registro = byId(db.asistencias, data.registro);
    const justificacion = sanitize(data.justificacion);
    const errors = {};
    if (!registro) {
      errors.registro = "Selecciona el registro a corregir.";
    }
    if (!data.entrada) {
      errors.entrada = "Indica la hora de entrada.";
    }
    if (!data.salida) {
      errors.salida = "Indica la hora de salida.";
    } else if (data.entrada && toMin(data.salida) <= toMin(data.entrada)) {
      errors.salida = "La hora de salida debe ser posterior a la entrada.";
    }
    if (!data.motivo) {
      errors.motivo = "Selecciona el motivo de la correccion.";
    }
    if (justificacion.length < 50) {
      errors.justificacion = `La justificacion debe tener al menos 50 caracteres (actual: ${justificacion.length}).`;
    }
    setErrors(form, errors);
    if (Object.keys(errors).length > 0) {
      toast("La correccion no cumple las validaciones.", "error");
      return;
    }
    const res = dispatch({ kind: "action", name: "corregir_asistencia", perm: "corregir_asistencia", data: { registroId: registro.id, empleadoId: registro.empleadoId, motivo: data.motivo, antes: `${registro.entrada}-${registro.salida || "sin salida"}`, despues: `${data.entrada}-${data.salida}` } });
    if (!res.ok) {
      toast(res.reason, "error");
      return;
    }
    registro.entrada = data.entrada;
    registro.salida = data.salida;
    registro.corregido = true;
    saveDb();
    toast("Registro corregido. El cambio quedo auditado.");
    renderCorreccion(host);
  });
};

const validatePermiso = (d, empleadoId) => {
  const errors = {};
  if (!d.tipo) {
    errors.tipo = "Selecciona el tipo de permiso.";
  }
  if (!d.inicio) {
    errors.inicio = "Selecciona la fecha de inicio.";
  }
  if (!d.fin) {
    errors.fin = "Selecciona la fecha de fin.";
  } else if (d.inicio && d.fin < d.inicio) {
    errors.fin = "La fecha de fin debe ser igual o posterior a la fecha de inicio.";
  }
  if (sanitize(d.motivo).length < 30) {
    errors.motivo = `El motivo detallado debe tener al menos 30 caracteres (actual: ${sanitize(d.motivo).length}).`;
  }
  if (!errors.inicio && !errors.fin) {
    const clash = db.permisos.find((p) => p.empleadoId === empleadoId && p.estado !== "rechazado" && d.inicio <= p.fin && d.fin >= p.inicio);
    if (clash) {
      errors.inicio = `Se superpone con un permiso ${clash.estado} del ${clash.inicio} al ${clash.fin}.`;
    }
  }
  if (!errors.inicio && !errors.fin && d.tipo === "vacaciones") {
    const solicitados = daysBetween(d.inicio, d.fin) + 1;
    const disponibles = 30 - vacacionesTomadas(empleadoId, true);
    if (solicitados > disponibles) {
      errors.fin = `Solicitas ${solicitados} dias pero solo tienes ${disponibles} dias de vacaciones disponibles.`;
    }
  }
  return errors;
};

const permisosTable = (list, withEmpleado) => `
  <div class="table-wrap"><table class="data-table">
    <thead><tr>${withEmpleado ? "<th>Empleado</th>" : ""}<th>Tipo</th><th>Inicio</th><th>Fin</th><th>Dias</th><th>Estado</th><th>Motivo</th></tr></thead>
    <tbody>${list.length === 0 ? `<tr><td colspan="7" class="empty-state">Sin permisos registrados.</td></tr>` : list.map((p) => `<tr>${withEmpleado ? `<td>${esc(fullName(byId(db.empleados, p.empleadoId)))}</td>` : ""}<td>${esc(p.tipo)}</td><td>${esc(p.inicio)}</td><td>${esc(p.fin)}</td><td>${diasDe(p)}</td><td>${permisoPill(p.estado)}</td><td class="wrap">${esc(p.motivo)}</td></tr>`).join("")}</tbody>
  </table></div>`;

const renderPermisos = (host) => {
  const fields = [
    { id: "tipo", label: "Tipo de permiso", type: "select", options: [{ value: "", label: "Selecciona el tipo" }, { value: "personal", label: "Personal" }, { value: "medico", label: "Medico" }, { value: "duelo", label: "Duelo" }, { value: "maternidad/paternidad", label: "Maternidad/paternidad" }, { value: "vacaciones", label: "Vacaciones" }, { value: "otro", label: "Otro" }] },
    { id: "inicio", label: "Fecha de inicio", type: "date" },
    { id: "fin", label: "Fecha de fin", type: "date" },
    { id: "adjunto", label: "Documento adjunto (descripcion simulada)", placeholder: "Ejemplo: Certificado medico del hospital" },
    { id: "motivo", label: "Motivo detallado (minimo 30 caracteres)", type: "textarea", wide: true }
  ];
  host.innerHTML = `
    <div class="panel stack-md">
      <div class="panel-head"><div class="stack-xs"><h2 class="h3">Solicitud de permiso o vacaciones</h2><p class="text-muted">Validacion de fechas, superposicion y dias de vacaciones disponibles.</p></div>${pill("Formulario complejo", "violet")}</div>
      <form id="form-permiso" class="stack-md" novalidate>
        ${actorSelectHtml()}
        <div class="form-grid">${fields.map(fieldHtml).join("")}</div>
        <p class="text-caption" id="vac-info"></p>
        <div class="form-actions"><button class="btn btn-primary" type="submit">Enviar solicitud</button><button class="btn btn-surface" type="reset">Limpiar</button></div>
      </form>
    </div>
    <div class="panel stack-md"><h2 class="h3">Mis solicitudes</h2><div id="mis-permisos"></div></div>
    <div class="panel stack-md"><h2 class="h3">Notificaciones</h2><div id="mis-notificaciones" class="stack-xs"></div></div>`;
  const form = $("#form-permiso", host);
  const refresh = () => {
    const id = actorId(host);
    $("#vac-info", host).textContent = `Vacaciones disponibles: ${vacacionesDisponibles(id)} de 30 dias (aprobadas descontadas).`;
    $("#mis-permisos", host).innerHTML = permisosTable(db.permisos.filter((p) => p.empleadoId === id).sort((a, b) => b.inicio.localeCompare(a.inicio)), false);
    const notes = db.notificaciones.filter((n) => n.empleadoId === id).slice(-5).reverse();
    $("#mis-notificaciones", host).innerHTML = notes.length === 0 ? `<p class="text-muted">No tienes notificaciones.</p>` : notes.map((n) => `<p class="notice notice-info">${esc(n.ts)} - ${esc(n.texto)}</p>`).join("");
  };
  refresh();
  const actor = $("#actor", host);
  if (actor) {
    actor.addEventListener("change", refresh);
  }
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const data = readForm(form);
    data.motivo = sanitize(data.motivo);
    data.adjunto = sanitize(data.adjunto);
    const empleadoId = actorId(host);
    const errors = validatePermiso(data, empleadoId);
    setErrors(form, errors);
    if (Object.keys(errors).length > 0) {
      toast("La solicitud no cumple las validaciones.", "error");
      return;
    }
    const res = dispatch({ kind: "action", name: "solicitar_permiso", perm: "solicitar_permiso", data: { empleadoId, tipo: data.tipo, inicio: data.inicio, fin: data.fin } });
    if (!res.ok) {
      toast(res.reason, "error");
      return;
    }
    db.permisos.push({ id: nextId(db.permisos), empleadoId, tipo: data.tipo, inicio: data.inicio, fin: data.fin, motivo: data.motivo, adjunto: data.adjunto, estado: "pendiente", creado: nowIso(), resueltoPor: "" });
    saveDb();
    form.reset();
    toast("Solicitud enviada. Queda pendiente de aprobacion.");
    refresh();
  });
};

registerView({ id: "marcacion", title: "Marcacion", order: 40, perm: "registrar_asistencia", render: renderMarcacion });
registerView({ id: "permisos", title: "Permisos", order: 50, perm: "solicitar_permiso", render: renderPermisos });
registerView({ id: "correccion", title: "Correccion", order: 70, perm: "corregir_asistencia", render: renderCorreccion });

const PERMS = {
  "Admin RRHH": ["registrar_asistencia", "solicitar_permiso", "aprobar_permiso", "ver_reportes", "ver_reportes_globales", "corregir_asistencia", "registrar_empleado", "ver_equipo", "ver_salarios", "gestion_rrhh", "ver_auditoria"],
  "Jefe de Area": ["registrar_asistencia", "solicitar_permiso", "aprobar_permiso", "ver_reportes", "ver_reportes_area", "ver_equipo"],
  "Empleado": ["registrar_asistencia", "solicitar_permiso"],
  "Contador": ["ver_reportes", "ver_reportes_globales"]
};
const ALL_PERMS = ["registrar_asistencia", "solicitar_permiso", "aprobar_permiso", "ver_reportes_area", "ver_reportes_globales", "corregir_asistencia", "ver_reportes", "ver_equipo", "registrar_empleado", "ver_salarios", "gestion_rrhh", "ver_auditoria"];
const GRUPOS = Object.keys(PERMS);

const SESSION_KEY = "ta_session";
const CSRF_KEY = "ta_csrf";
const COOKIE_ID = "ta_sessionid";
const COOKIE_CSRF = "ta_csrftoken";
const urlParams = new URLSearchParams(window.location.search);
const SESSION_SECONDS = Number(urlParams.get("timeout")) > 0 ? Number(urlParams.get("timeout")) : 45 * 60;
let session = null;
hooks.afterLogin = [];

const randomToken = () => Array.from(crypto.getRandomValues(new Uint8Array(16))).map((b) => b.toString(16).padStart(2, "0")).join("");
const setCookie = (name, value, seconds) => {
  const secure = window.location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `${name}=${value}; max-age=${seconds}; path=/; SameSite=Strict${secure}`;
};
const clearCookie = (name) => {
  document.cookie = `${name}=; max-age=0; path=/; SameSite=Strict`;
};

can = (perm) => {
  if (!perm) {
    return true;
  }
  if (!state.user) {
    return false;
  }
  if (perm === "auth") {
    return true;
  }
  return PERMS[state.user.grupo].includes(perm);
};

const nombreUsuario = () => {
  const emp = miEmpleado();
  return emp ? `${emp.nombres} ${emp.apellidos}` : state.user.username;
};

const writeLog = (level, action, detail) => {
  const entry = { ts: stamp(), level, user: state.user ? state.user.username : "anonimo", action, detail: detail || "" };
  db.logs.push(entry);
  if (db.logs.length > 300) {
    db.logs.shift();
  }
  saveDb();
  const output = level === "WARNING" ? console.warn : console.log;
  output(`[${entry.level}] ${entry.ts} usuario=${entry.user} accion=${entry.action} ${entry.detail}`);
  return entry;
};

useMiddleware("sesion", (req, next) => {
  if (req.perm && !req.user) {
    writeLog("WARNING", "acceso_sin_sesion", `destino=${req.name}`);
    return { ok: false, status: 401, reason: "Debes iniciar sesion para acceder a este recurso." };
  }
  return next();
});

useMiddleware("autorizacion", (req, next) => {
  if (req.perm && req.perm !== "auth" && !can(req.perm)) {
    writeLog("WARNING", "acceso_no_autorizado", `destino=${req.name} permiso=${req.perm}`);
    return { ok: false, status: 403, reason: `Tu grupo (${req.user.grupo}) no tiene el permiso ${req.perm}.` };
  }
  return next();
});

const persistSession = () => {
  sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
};

const touchSession = () => {
  if (!session) {
    return;
  }
  const now = Date.now();
  if (now - session.last < 1000) {
    return;
  }
  session.last = now;
  persistSession();
  setCookie(COOKIE_ID, session.id, SESSION_SECONDS);
};

const defaultView = (user) => {
  const wanted = user.grupo === "Contador" ? ["reportes"] : ["marcacion"];
  const found = wanted.find((id) => views.some((v) => v.id === id));
  return found || "sesion";
};

const startSession = (user) => {
  state.user = user;
  session = { username: user.username, id: randomToken(), last: Date.now() };
  persistSession();
  setCookie(COOKIE_ID, session.id, SESSION_SECONDS);
  writeLog("INFO", "login", `grupo=${user.grupo}`);
  hooks.afterLogin.forEach((fn) => fn(user));
  state.view = defaultView(user);
  renderApp();
};

const endSession = (reason) => {
  const wasUser = state.user;
  if (wasUser) {
    writeLog(reason === "expired" ? "WARNING" : "INFO", reason === "expired" ? "sesion_expirada" : "logout", `inactividad_max=${SESSION_SECONDS}s`);
  }
  state.user = null;
  session = null;
  sessionStorage.removeItem(SESSION_KEY);
  clearCookie(COOKIE_ID);
  const alerts = $("#alert-region");
  if (alerts) {
    alerts.innerHTML = "";
  }
  state.view = "sesion";
  state.notice = reason === "expired" ? "Tu sesion expiro por inactividad. Inicia sesion nuevamente." : "";
  renderApp();
  if (reason === "expired") {
    toast("Sesion cerrada por inactividad.", "error");
  }
};
