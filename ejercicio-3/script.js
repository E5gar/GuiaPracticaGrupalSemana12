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
