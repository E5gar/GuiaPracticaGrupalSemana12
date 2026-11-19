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

const DB_KEY = "cm_db_v1";
const ESPECIALIDADES = ["Medicina General", "Pediatria", "Cardiologia", "Dermatologia", "Odontologia", "Psicologia", "Ginecologia", "Traumatologia"];
const HORARIO_TEXTO = "L-V 8:00-18:00, Sab 8:00-13:00";

const hooks = { boot: [], render: [] };
const state = { user: null, view: "registro" };
let can = () => true;

const seedDb = () => {
  const medNombres = ["Carlos", "Lucia", "Andres", "Rosa", "Miguel", "Elena", "Patricia", "Jorge"];
  const medApellidos = ["Quispe Rojas", "Mendoza Valle", "Huaman Soto", "Paredes Lino", "Salazar Ortiz", "Camayo Lazo", "Rivera Cruz", "Ramos Tello"];
  const medicos = ESPECIALIDADES.map((especialidad, i) => ({
    id: i + 1,
    nombres: medNombres[i],
    apellidos: medApellidos[i],
    cmp: String(10234 + i * 4111),
    especialidad,
    consultorio: `C-${101 + i}`,
    horario: HORARIO_TEXTO
  }));
  const pacNombres = ["Ana", "Luis", "Maria", "Pedro", "Sofia", "Diego", "Valeria", "Marco", "Camila", "Raul", "Daniela", "Victor", "Karen", "Hugo", "Lorena"];
  const pacApellidos = ["Garcia Pena", "Torres Lopez", "Flores Rios", "Vargas Diaz", "Castro Meza", "Rojas Leon", "Cardenas Paz", "Medina Soto", "Ortega Luna", "Salas Vega", "Poma Yupanqui", "Arias Chavez", "Soto Lara", "Navarro Gil", "Campos Rey"];
  const alergiasList = ["Ninguna conocida", "Penicilina", "Polen", "Ninguna conocida", "Ibuprofeno", "Mariscos", "Ninguna conocida", "Latex", "Ninguna conocida", "Aspirina", "Ninguna conocida", "Polvo", "Ninguna conocida", "Lactosa", "Ninguna conocida"];
  const pacientes = pacNombres.map((nombres, i) => {
    const docente = i % 5 === 4;
    const apellidos = pacApellidos[i];
    const base = `${nombres}.${apellidos.split(" ")[0]}`.toLowerCase();
    return {
      id: i + 1,
      dni: String(71234500 + i * 13579),
      nombres,
      apellidos,
      nacimiento: docente ? `${1976 + i % 7}-0${1 + i % 9}-1${i % 9}` : `${1999 + i % 5}-0${1 + i % 9}-1${i % 9}`,
      tipo: docente ? "docente" : "estudiante",
      codigo: docente ? `D${400100 + i}` : `E${2021100 + i}`,
      email: `${base}@uncp.edu.pe`,
      alergias: alergiasList[i]
    };
  });
  const citas = [];
  const consultas = [];
  const diagnosticos = ["Cuadro viral de vias respiratorias altas", "Control de rutina sin hallazgos", "Gastritis leve", "Cefalea tensional", "Dermatitis de contacto", "Caries dental inicial", "Ansiedad situacional", "Esguince grado I"];
  const tratamientos = ["Reposo e hidratacion", "Dieta y control en 15 dias", "Tratamiento topico por 7 dias", "Higiene y limpieza dental", "Sesiones de seguimiento semanal"];
  const hoy = todayIso();
  for (let i = 0; i < 30; i += 1) {
    const paciente = pacientes[(i * 7) % 15];
    const medico = medicos[(i * 3) % 8];
    let fecha = addDays(hoy, (i % 11) - 5);
    let placed = false;
    for (let tries = 0; tries < 40 && !placed; tries += 1) {
      const slots = slotsFor(fecha);
      if (slots.length > 0) {
        const hora = slots[(i * 5 + tries) % slots.length];
        const busyMedico = citas.some((c) => c.medicoId === medico.id && c.fecha === fecha && c.hora === hora);
        const busyPaciente = citas.some((c) => c.pacienteId === paciente.id && c.fecha === fecha);
        if (!busyMedico && !busyPaciente) {
          const pasada = fecha < hoy;
          const estado = pasada ? (i % 6 === 0 ? "cancelada" : "completada") : "pendiente";
          const cita = {
            id: citas.length + 1,
            pacienteId: paciente.id,
            medicoId: medico.id,
            fecha,
            hora,
            motivo: `Consulta de ${medico.especialidad.toLowerCase()} por molestias recientes y control general`,
            estado
          };
          citas.push(cita);
          if (estado === "completada") {
            consultas.push({
              id: consultas.length + 1,
              citaId: cita.id,
              pacienteId: paciente.id,
              medicoId: medico.id,
              fecha,
              diagnostico: diagnosticos[i % diagnosticos.length],
              tratamiento: tratamientos[i % tratamientos.length],
              medicamentos: i % 2 === 0 ? "Paracetamol 500 mg cada 8 horas" : "Sin medicamentos",
              control: "",
              adjuntos: i % 3 === 0 ? "Receta simulada RX-" + (100 + i) : "",
              notas: []
            });
          }
          placed = true;
        }
      }
      if (!placed) {
        fecha = addDays(fecha, 1);
      }
    }
  }
  const pass = hashPass("Uncp2026");
  const users = [
    { username: "admin", hash: pass, grupo: "Admins", nombre: "Director del Centro Medico" },
    { username: "recepcion", hash: pass, grupo: "Recepcionistas", nombre: "Recepcion Central" },
    { username: "medico1", hash: pass, grupo: "Medicos", nombre: "Dr. Carlos Quispe", medicoId: 1 },
    { username: "medico2", hash: pass, grupo: "Medicos", nombre: "Dra. Lucia Mendoza", medicoId: 2 },
    { username: "paciente1", hash: pass, grupo: "Pacientes", nombre: "Ana Garcia", pacienteId: 1 },
    { username: "paciente2", hash: pass, grupo: "Pacientes", nombre: "Luis Torres", pacienteId: 2 }
  ];
  return { medicos, pacientes, citas, consultas, users, logs: [] };
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

const validatePaciente = (d) => {
  const errors = {};
  if (!/^\d{8}$/.test(d.dni || "")) {
    errors.dni = "El DNI debe tener exactamente 8 digitos numericos.";
  } else if (db.pacientes.some((p) => p.dni === d.dni)) {
    errors.dni = "Ya existe un paciente registrado con ese DNI.";
  }
  if (sanitize(d.nombres).length < 2) {
    errors.nombres = "Ingresa los nombres del paciente.";
  }
  if (sanitize(d.apellidos).length < 2) {
    errors.apellidos = "Ingresa los apellidos del paciente.";
  }
  if (!d.nacimiento) {
    errors.nacimiento = "Selecciona la fecha de nacimiento.";
  } else if (d.nacimiento > todayIso()) {
    errors.nacimiento = "La fecha de nacimiento no puede ser futura.";
  }
  if (!/^[A-Za-z0-9]{6,10}$/.test(d.codigo || "")) {
    errors.codigo = "El codigo UNCP debe tener entre 6 y 10 caracteres alfanumericos.";
  }
  if (!d.email) {
    errors.email = "El correo institucional es obligatorio.";
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(d.email)) {
    errors.email = "El formato del correo no es valido.";
  } else if (d.tipo === "estudiante" && !/@uncp\.edu\.pe$/i.test(d.email)) {
    errors.email = "Los estudiantes deben usar un correo @uncp.edu.pe.";
  }
  return errors;
};

const validateMedico = (d) => {
  const errors = {};
  if (!/^\d{5}$/.test(d.cmp || "")) {
    errors.mcmp = "El CMP debe tener 5 digitos numericos (ejemplo: 12345).";
  } else if (db.medicos.some((m) => m.cmp === d.cmp)) {
    errors.mcmp = "Ya existe un medico con ese CMP.";
  }
  if (sanitize(d.mnombres).length < 2) {
    errors.mnombres = "Ingresa los nombres del medico.";
  }
  if (sanitize(d.mapellidos).length < 2) {
    errors.mapellidos = "Ingresa los apellidos del medico.";
  }
  if (!/^[A-Za-z]-\d{3}$/.test(d.consultorio || "")) {
    errors.consultorio = "Formato de consultorio invalido (ejemplo: C-109).";
  }
  return errors;
};

const pacientesTable = (list) => `
  <div class="table-wrap"><table class="data-table">
    <thead><tr><th>DNI</th><th>Paciente</th><th>Tipo</th><th>Codigo</th><th>Correo</th><th>Alergias</th></tr></thead>
    <tbody>${list.map((p) => `<tr><td>${esc(p.dni)}</td><td>${esc(fullName(p))}</td><td>${pill(p.tipo, p.tipo === "docente" ? "violet" : "blue")}</td><td>${esc(p.codigo)}</td><td>${esc(p.email)}</td><td>${esc(p.alergias)}</td></tr>`).join("")}</tbody>
  </table></div>`;

const medicosTable = (list) => `
  <div class="table-wrap"><table class="data-table">
    <thead><tr><th>CMP</th><th>Medico</th><th>Especialidad</th><th>Consultorio</th><th>Horario</th></tr></thead>
    <tbody>${list.map((m) => `<tr><td>${esc(m.cmp)}</td><td>${esc(fullName(m))}</td><td>${esc(m.especialidad)}</td><td>${esc(m.consultorio)}</td><td>${esc(m.horario)}</td></tr>`).join("")}</tbody>
  </table></div>`;

const renderRegistro = (host) => {
  const pacienteFields = [
    { id: "dni", label: "DNI", placeholder: "8 digitos", attrs: 'inputmode="numeric" maxlength="12"' },
    { id: "nombres", label: "Nombres" },
    { id: "apellidos", label: "Apellidos" },
    { id: "nacimiento", label: "Fecha de nacimiento", type: "date", attrs: `max="${todayIso()}"` },
    { id: "tipo", label: "Tipo de paciente", type: "select", options: [{ value: "estudiante", label: "Estudiante" }, { value: "docente", label: "Docente" }] },
    { id: "codigo", label: "Codigo UNCP", placeholder: "Ejemplo: E2021105" },
    { id: "email", label: "Correo institucional", type: "email", placeholder: "usuario@uncp.edu.pe" },
    { id: "alergias", label: "Alergias conocidas", placeholder: "Ninguna conocida" }
  ];
  const medicoFields = [
    { id: "mcmp", label: "CMP", placeholder: "Ejemplo: 12345", attrs: 'inputmode="numeric" maxlength="10"' },
    { id: "mnombres", label: "Nombres" },
    { id: "mapellidos", label: "Apellidos" },
    { id: "mespecialidad", label: "Especialidad", type: "select", options: ESPECIALIDADES.map((e) => ({ value: e, label: e })) },
    { id: "consultorio", label: "Consultorio", placeholder: "Ejemplo: C-109" },
    { id: "mhorario", label: "Horario de atencion", type: "select", options: [{ value: HORARIO_TEXTO, label: HORARIO_TEXTO }] }
  ];
  host.innerHTML = `
    <div class="panel stack-md">
      <div class="panel-head"><div class="stack-xs"><h2 class="h3">Registro de pacientes</h2><p class="text-muted">Validacion de DNI, fecha de nacimiento y correo institucional.</p></div>${pill(`${db.pacientes.length} registrados`, "violet")}</div>
      <form id="form-paciente" class="stack-md" novalidate>
        <div class="form-grid">${pacienteFields.map(fieldHtml).join("")}</div>
        <div class="form-actions"><button class="btn btn-primary" type="submit">Registrar paciente</button><button class="btn btn-surface" type="reset">Limpiar</button></div>
      </form>
      <div id="tabla-pacientes"></div>
    </div>
    <div class="panel stack-md" id="panel-medico">
      <div class="panel-head"><div class="stack-xs"><h2 class="h3">Registro de medicos</h2><p class="text-muted">Validacion de CMP, consultorio y horarios de atencion.</p></div>${pill(`${db.medicos.length} registrados`, "blue")}</div>
      <form id="form-medico" class="stack-md" novalidate>
        <div class="form-grid">${medicoFields.map(fieldHtml).join("")}</div>
        <div class="form-actions"><button class="btn btn-primary" type="submit">Registrar medico</button><button class="btn btn-surface" type="reset">Limpiar</button></div>
      </form>
      <div id="tabla-medicos"></div>
    </div>`;
  const refresh = () => {
    $("#tabla-pacientes", host).innerHTML = pacientesTable(db.pacientes.slice(-5).reverse());
    $("#tabla-medicos", host).innerHTML = medicosTable(db.medicos.slice(-5).reverse());
  };
  refresh();
  $("#panel-medico", host).hidden = !can("registrar_medico");

  const formP = $("#form-paciente", host);
  formP.addEventListener("submit", (event) => {
    event.preventDefault();
    const data = readForm(formP);
    data.nombres = sanitize(data.nombres);
    data.apellidos = sanitize(data.apellidos);
    data.alergias = sanitize(data.alergias) || "Ninguna conocida";
    const errors = validatePaciente(data);
    setErrors(formP, errors);
    if (Object.keys(errors).length > 0) {
      toast("Revisa los campos marcados en el formulario.", "error");
      return;
    }
    const res = dispatch({ kind: "action", name: "registrar_paciente", perm: "registrar_paciente", data });
    if (!res.ok) {
      toast(res.reason, "error");
      return;
    }
    db.pacientes.push({ id: nextId(db.pacientes), dni: data.dni, nombres: data.nombres, apellidos: data.apellidos, nacimiento: data.nacimiento, tipo: data.tipo, codigo: data.codigo.toUpperCase(), email: data.email.toLowerCase(), alergias: data.alergias });
    saveDb();
    formP.reset();
    refresh();
    toast("Paciente registrado correctamente.");
  });

  const formM = $("#form-medico", host);
  formM.addEventListener("submit", (event) => {
    event.preventDefault();
    const data = readForm(formM);
    data.cmp = data.mcmp;
    const errors = validateMedico(data);
    setErrors(formM, errors);
    if (Object.keys(errors).length > 0) {
      toast("Revisa los campos marcados en el formulario.", "error");
      return;
    }
    const res = dispatch({ kind: "action", name: "registrar_medico", perm: "registrar_medico", data });
    if (!res.ok) {
      toast(res.reason, "error");
      return;
    }
    db.medicos.push({ id: nextId(db.medicos), nombres: sanitize(data.mnombres), apellidos: sanitize(data.mapellidos), cmp: data.cmp, especialidad: data.mespecialidad, consultorio: data.consultorio.toUpperCase(), horario: data.mhorario });
    saveDb();
    formM.reset();
    refresh();
    toast("Medico registrado correctamente.");
  });
};

registerView({ id: "registro", title: "Registro", order: 30, perm: "registrar_paciente", render: renderRegistro });

document.addEventListener("DOMContentLoaded", () => {
  hooks.boot.forEach((fn) => fn());
  renderApp();
});

const stamp = () => {
  const d = new Date();
  return `${isoDate(d)} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
};

const visibleCitas = () => {
  const user = state.user;
  if (user && user.grupo === "Pacientes") {
    return db.citas.filter((c) => c.pacienteId === user.pacienteId);
  }
  if (user && user.grupo === "Medicos") {
    return db.citas.filter((c) => c.medicoId === user.medicoId);
  }
  return db.citas;
};

const canCancel = (cita) => {
  if (cita.estado !== "pendiente" || !can("cancelar_cita")) {
    return false;
  }
  const user = state.user;
  if (user && user.grupo === "Pacientes") {
    return cita.pacienteId === user.pacienteId;
  }
  return true;
};

const validateCita = (d) => {
  const errors = {};
  const medico = byId(db.medicos, d.medico);
  const nowTime = `${pad(new Date().getHours())}:${pad(new Date().getMinutes())}`;
  if (!d.paciente) {
    errors.paciente = "Selecciona un paciente.";
  }
  if (!d.especialidad) {
    errors.especialidad = "Selecciona una especialidad.";
  }
  if (!medico) {
    errors.medico = "Selecciona un medico.";
  } else if (medico.especialidad !== d.especialidad) {
    errors.medico = "El medico no pertenece a la especialidad elegida.";
  }
  if (!d.fecha) {
    errors.fecha = "Selecciona la fecha de la cita.";
  } else if (d.fecha < todayIso()) {
    errors.fecha = "No se puede agendar una cita en una fecha pasada.";
  }
  if (!d.hora) {
    errors.hora = "Selecciona la hora de la cita.";
  } else if (d.fecha === todayIso() && d.hora <= nowTime) {
    errors.hora = "La hora seleccionada ya paso.";
  }
  const motivo = sanitize(d.motivo);
  if (motivo.length < 20) {
    errors.motivo = `El motivo de consulta debe tener al menos 20 caracteres (actual: ${motivo.length}).`;
  }
  if (!errors.fecha && d.paciente) {
    const dup = db.citas.find((c) => c.estado !== "cancelada" && c.pacienteId === Number(d.paciente) && c.fecha === d.fecha);
    if (dup) {
      errors.fecha = `El paciente ya tiene una cita ese dia a las ${dup.hora}. No se permiten dos citas el mismo dia.`;
    }
  }
  if (!errors.fecha && !errors.hora && medico) {
    const clash = db.citas.find((c) => c.estado !== "cancelada" && c.medicoId === medico.id && c.fecha === d.fecha && Math.abs(toMin(c.hora) - toMin(d.hora)) < 30);
    if (clash) {
      errors.hora = `El medico ya tiene una cita a las ${clash.hora} (30 minutos por cita). El horario se superpone.`;
    }
  }
  return errors;
};

const citasTable = (list, withActions) => `
  <div class="table-wrap"><table class="data-table">
    <thead><tr><th>Fecha</th><th>Hora</th><th>Paciente</th><th>Medico</th><th>Estado</th><th>Motivo</th>${withActions ? "<th>Accion</th>" : ""}</tr></thead>
    <tbody>${list.length === 0 ? `<tr><td colspan="7" class="empty-state">No hay citas para mostrar.</td></tr>` : list.map((c) => {
      const p = byId(db.pacientes, c.pacienteId);
      const m = byId(db.medicos, c.medicoId);
      const action = withActions ? `<td>${canCancel(c) ? `<button class="btn btn-surface btn-small" type="button" data-cancel="${c.id}">Cancelar</button>` : ""}</td>` : "";
      return `<tr><td>${esc(c.fecha)}</td><td>${esc(c.hora)}</td><td>${esc(fullName(p))}</td><td>${esc(m.apellidos.split(" ")[0])} - ${esc(m.especialidad)}</td><td>${estadoPill(c.estado)}</td><td class="wrap">${esc(c.motivo)}</td>${action}</tr>`;
    }).join("")}</tbody>
  </table></div>`;

const renderCitas = (host) => {
  const user = state.user;
  const soloPropio = user && user.grupo === "Pacientes";
  const pacientesOptions = soloPropio
    ? optionsFrom(db.pacientes.filter((p) => p.id === user.pacienteId), (p) => `${p.dni} - ${fullName(p)}`)
    : optionsFrom(db.pacientes, (p) => `${p.dni} - ${fullName(p)}`, "Selecciona un paciente");
  const fields = [
    { id: "paciente", label: "Paciente", type: "select", options: pacientesOptions },
    { id: "especialidad", label: "Especialidad", type: "select", options: [{ value: "", label: "Selecciona una especialidad" }, ...ESPECIALIDADES.map((e) => ({ value: e, label: e }))] },
    { id: "medico", label: "Medico", type: "select", options: [{ value: "", label: "Primero elige la especialidad" }] },
    { id: "fecha", label: "Fecha", type: "date", attrs: `min="${todayIso()}"` },
    { id: "hora", label: "Hora", type: "time", attrs: 'step="1800"', hint: "Cada cita dura 30 minutos." },
    { id: "motivo", label: "Motivo de consulta", type: "textarea", wide: true, placeholder: "Describe el motivo (minimo 20 caracteres)" }
  ];
  const formBlock = can("agendar_cita")
    ? `<form id="form-cita" class="stack-md" novalidate>
        <div class="form-grid">${fields.map(fieldHtml).join("")}</div>
        <div class="form-actions"><button class="btn btn-primary" type="submit">Agendar cita</button><button class="btn btn-surface" type="reset">Limpiar</button></div>
      </form>`
    : `<p class="text-muted">Tu rol no tiene el permiso agendar_cita. Solo puedes consultar y cancelar citas.</p>`;
  host.innerHTML = `
    <div class="panel stack-md">
      <div class="panel-head"><div class="stack-xs"><h2 class="h3">Agendamiento de citas</h2><p class="text-muted">Validaciones cruzadas de paciente, medico y horario.</p></div>${pill("Formulario complejo", "violet")}</div>
      ${formBlock}
    </div>
    <div class="panel stack-md">
      <div class="panel-head">
        <h2 class="h3">Citas registradas</h2>
        <div class="field"><label class="sr-only" for="filtro-estado">Filtrar por estado</label>
          <select id="filtro-estado"><option value="">Todos los estados</option><option value="pendiente">Pendientes</option><option value="completada">Completadas</option><option value="cancelada">Canceladas</option></select>
        </div>
      </div>
      <div id="lista-citas"></div>
    </div>`;

  const refresh = () => {
    const estado = $("#filtro-estado", host).value;
    const all = visibleCitas().filter((c) => !estado || c.estado === estado).sort((a, b) => `${b.fecha}${b.hora}`.localeCompare(`${a.fecha}${a.hora}`));
    const shown = all.slice(0, 12);
    $("#lista-citas", host).innerHTML = `${citasTable(shown, true)}<p class="text-caption">Mostrando ${shown.length} de ${all.length} citas.</p>`;
    $$("[data-cancel]", host).forEach((button) => button.addEventListener("click", () => {
      const res = dispatch({ kind: "action", name: "cancelar_cita", perm: "cancelar_cita", data: { citaId: Number(button.dataset.cancel) } });
      if (!res.ok) {
        toast(res.reason, "error");
        return;
      }
      byId(db.citas, button.dataset.cancel).estado = "cancelada";
      saveDb();
      toast("La cita fue cancelada.");
      refresh();
    }));
  };
  $("#filtro-estado", host).addEventListener("change", refresh);
  refresh();

  const form = $("#form-cita", host);
  if (!form) {
    return;
  }
  const especialidad = $("#especialidad", form);
  const medico = $("#medico", form);
  especialidad.addEventListener("change", () => {
    const list = db.medicos.filter((m) => m.especialidad === especialidad.value);
    const options = especialidad.value ? [{ value: "", label: "Selecciona un medico" }, ...list.map((m) => ({ value: m.id, label: `${fullName(m)} - ${m.consultorio}` }))] : [{ value: "", label: "Primero elige la especialidad" }];
    medico.innerHTML = options.map((o) => `<option value="${esc(o.value)}">${esc(o.label)}</option>`).join("");
  });
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const data = readForm(form);
    data.motivo = sanitize(data.motivo);
    const errors = validateCita(data);
    setErrors(form, errors);
    if (Object.keys(errors).length > 0) {
      toast("La cita no cumple las validaciones. Revisa los campos.", "error");
      return;
    }
    const res = dispatch({ kind: "action", name: "agendar_cita", perm: "agendar_cita", data });
    if (!res.ok) {
      setErrors(form, { hora: res.reason });
      toast(res.reason, "error");
      return;
    }
    db.citas.push({ id: nextId(db.citas), pacienteId: Number(data.paciente), medicoId: Number(data.medico), fecha: data.fecha, hora: data.hora, motivo: data.motivo, estado: "pendiente" });
    saveDb();
    form.reset();
    medico.innerHTML = `<option value="">Primero elige la especialidad</option>`;
    toast("Cita agendada correctamente.");
    refresh();
  });
};

const citasPendientesDeConsulta = () => {
  const user = state.user;
  return db.citas.filter((c) => c.estado !== "cancelada" && !db.consultas.some((k) => k.citaId === c.id) && (!user || user.grupo !== "Medicos" || c.medicoId === user.medicoId));
};

const renderConsulta = (host) => {
  const pendientes = citasPendientesDeConsulta().sort((a, b) => `${b.fecha}${b.hora}`.localeCompare(`${a.fecha}${a.hora}`));
  const options = optionsFrom(pendientes, (c) => `#${c.id} - ${c.fecha} ${c.hora} - ${fullName(byId(db.pacientes, c.pacienteId))}`, "Selecciona la cita atendida");
  const fields = [
    { id: "cita", label: "Cita atendida", type: "select", options, wide: true },
    { id: "diagnostico", label: "Diagnostico", type: "textarea", rows: 2 },
    { id: "tratamiento", label: "Tratamiento", type: "textarea", rows: 2 },
    { id: "medicamentos", label: "Medicamentos recetados", placeholder: "Ejemplo: Paracetamol 500 mg cada 8 horas" },
    { id: "control", label: "Proxima cita de control (opcional)", type: "date" },
    { id: "adjuntos", label: "Archivos adjuntos (simulado)", placeholder: "Describe la receta o examen adjunto", wide: true }
  ];
  host.innerHTML = `
    <div class="panel stack-md">
      <div class="panel-head"><div class="stack-xs"><h2 class="h3">Registro de consulta medica</h2><p class="text-muted">Una consulta registrada no se puede modificar. Solo se pueden agregar notas desde el historial clinico.</p></div>${pill("Post-atencion", "green")}</div>
      <form id="form-consulta" class="stack-md" novalidate>
        <div class="form-grid">${fields.map(fieldHtml).join("")}</div>
        <div class="form-actions"><button class="btn btn-primary" type="submit">Registrar consulta</button><button class="btn btn-surface" type="reset">Limpiar</button></div>
      </form>
    </div>`;
  const form = $("#form-consulta", host);
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const data = readForm(form);
    const cita = byId(db.citas, data.cita);
    const errors = {};
    if (!cita) {
      errors.cita = "Selecciona la cita atendida.";
    }
    if (sanitize(data.diagnostico).length < 10) {
      errors.diagnostico = "El diagnostico debe tener al menos 10 caracteres.";
    }
    if (sanitize(data.tratamiento).length < 10) {
      errors.tratamiento = "El tratamiento debe tener al menos 10 caracteres.";
    }
    if (sanitize(data.medicamentos).length < 3) {
      errors.medicamentos = "Indica los medicamentos recetados o escribe: Sin medicamentos.";
    }
    if (data.control && cita && data.control <= cita.fecha) {
      errors.control = "La proxima cita de control debe ser posterior a la fecha de la consulta.";
    }
    setErrors(form, errors);
    if (Object.keys(errors).length > 0) {
      toast("Corrige los campos marcados antes de registrar.", "error");
      return;
    }
    const res = dispatch({ kind: "action", name: "registrar_consulta", perm: "registrar_consulta", data: { citaId: cita.id, pacienteId: cita.pacienteId } });
    if (!res.ok) {
      toast(res.reason, "error");
      return;
    }
    db.consultas.push({ id: nextId(db.consultas), citaId: cita.id, pacienteId: cita.pacienteId, medicoId: cita.medicoId, fecha: cita.fecha, diagnostico: sanitize(data.diagnostico), tratamiento: sanitize(data.tratamiento), medicamentos: sanitize(data.medicamentos), control: data.control, adjuntos: sanitize(data.adjuntos), notas: [] });
    cita.estado = "completada";
    saveDb();
    toast("Consulta registrada. El registro es inmutable.");
    renderConsulta(host);
  });
};

const consultaCard = (k) => {
  const m = byId(db.medicos, k.medicoId);
  const notas = k.notas.length === 0 ? `<p class="text-caption">Sin notas adicionales.</p>` : k.notas.map((n) => `<p class="text-caption"><strong>${esc(n.autor)}</strong> (${esc(n.ts)}): ${esc(n.texto)}</p>`).join("");
  const noteForm = can("registrar_consulta")
    ? `<form class="form-actions" data-note-form="${k.id}"><div class="field" style="flex: 1 1 14rem;"><label class="sr-only" for="nota-${k.id}">Nueva nota</label><input id="nota-${k.id}" name="nota" placeholder="Agregar nota (no modifica la consulta)" autocomplete="off"></div><button class="btn btn-surface btn-small" type="submit">Agregar nota</button></form>`
    : "";
  return `
    <div class="panel stack-sm">
      <div class="panel-head"><h3 class="h4">Consulta del ${esc(k.fecha)}</h3>${pill(`${m.especialidad} - ${m.apellidos.split(" ")[0]}`, "blue")}</div>
      <p><strong>Diagnostico:</strong> ${esc(k.diagnostico)}</p>
      <p><strong>Tratamiento:</strong> ${esc(k.tratamiento)}</p>
      <p><strong>Medicamentos:</strong> ${esc(k.medicamentos)}</p>
      ${k.control ? `<p><strong>Control programado:</strong> ${esc(k.control)}</p>` : ""}
      ${k.adjuntos ? `<p><strong>Adjunto simulado:</strong> ${esc(k.adjuntos)}</p>` : ""}
      <div class="stack-xs">${notas}</div>
      ${noteForm}
    </div>`;
};

const renderHistorial = (host) => {
  const user = state.user;
  const soloPropio = user && user.grupo === "Pacientes";
  const lista = soloPropio ? db.pacientes.filter((p) => p.id === user.pacienteId) : db.pacientes;
  host.innerHTML = `
    <div class="panel stack-md">
      <div class="panel-head"><div class="stack-xs"><h2 class="h3">Historial clinico electronico</h2><p class="text-muted">Cada acceso a un historial queda registrado para auditoria.</p></div>${pill("Confidencial", "amber")}</div>
      <form id="form-historial" class="form-actions" novalidate>
        <div class="field" style="flex: 1 1 18rem;"><label for="hpaciente">Paciente</label>
          <select id="hpaciente" name="hpaciente">${optionsFrom(lista, (p) => `${p.dni} - ${fullName(p)}`, soloPropio ? "" : "Selecciona un paciente").map((o) => `<option value="${esc(o.value)}">${esc(o.label)}</option>`).join("")}</select>
        </div>
        <button class="btn btn-primary" type="submit">Abrir historial</button>
      </form>
      <div id="historial-detalle" class="stack-md"></div>
    </div>`;
  const form = $("#form-historial", host);
  const detalle = $("#historial-detalle", host);
  const open = () => {
    const paciente = byId(db.pacientes, $("#hpaciente", form).value);
    if (!paciente) {
      toast("Selecciona un paciente para abrir su historial.", "error");
      return;
    }
    const res = dispatch({ kind: "action", name: "ver_historial", perm: "ver_historial_clinico", data: { pacienteId: paciente.id } });
    if (!res.ok) {
      detalle.innerHTML = "";
      toast(res.reason, "error");
      return;
    }
    const consultas = db.consultas.filter((k) => k.pacienteId === paciente.id).sort((a, b) => b.fecha.localeCompare(a.fecha));
    detalle.innerHTML = `
      <div class="stat-row">
        <div class="stat"><span class="text-caption">Paciente</span><strong>${esc(fullName(paciente))}</strong></div>
        <div class="stat"><span class="text-caption">Edad</span><strong>${ageOf(paciente.nacimiento)} anios</strong></div>
        <div class="stat"><span class="text-caption">Tipo</span><strong>${esc(paciente.tipo)}</strong></div>
        <div class="stat"><span class="text-caption">Alergias</span><strong>${esc(paciente.alergias)}</strong></div>
      </div>
      ${consultas.length === 0 ? `<p class="empty-state">Este paciente aun no tiene consultas registradas.</p>` : consultas.map(consultaCard).join("")}`;
    $$("[data-note-form]", detalle).forEach((noteForm) => noteForm.addEventListener("submit", (event) => {
      event.preventDefault();
      const consulta = byId(db.consultas, noteForm.dataset.noteForm);
      const texto = sanitize(new FormData(noteForm).get("nota"));
      if (texto.length < 5) {
        toast("La nota debe tener al menos 5 caracteres.", "error");
        return;
      }
      const resNote = dispatch({ kind: "action", name: "agregar_nota", perm: "registrar_consulta", data: { consultaId: consulta.id, pacienteId: paciente.id } });
      if (!resNote.ok) {
        toast(resNote.reason, "error");
        return;
      }
      consulta.notas.push({ autor: state.user ? state.user.username : "sistema", ts: stamp(), texto });
      saveDb();
      toast("Nota agregada. La consulta original no fue modificada.");
      open();
    }));
  };
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    open();
  });
  if (soloPropio) {
    open();
  }
};

registerView({ id: "citas", title: "Citas", order: 40, perm: "auth", render: renderCitas });
registerView({ id: "consulta", title: "Consulta", order: 50, perm: "registrar_consulta", render: renderConsulta });
registerView({ id: "historial", title: "Historial", order: 60, perm: "ver_historial_clinico", render: renderHistorial });

const PERMS = {
  Admins: ["agendar_cita", "cancelar_cita", "generar_reportes", "registrar_paciente", "registrar_medico", "ver_agenda", "marcar_completadas", "ver_auditoria"],
  Medicos: ["ver_agenda", "registrar_consulta", "ver_historial_clinico", "cancelar_cita", "marcar_completadas"],
  Recepcionistas: ["agendar_cita", "cancelar_cita", "registrar_paciente", "ver_agenda"],
  Pacientes: ["agendar_cita", "cancelar_cita", "ver_historial_clinico"]
};
const ALL_PERMS = ["agendar_cita", "cancelar_cita", "ver_historial_clinico", "generar_reportes", "registrar_paciente", "registrar_medico", "registrar_consulta", "ver_agenda", "marcar_completadas", "ver_auditoria"];
const GRUPOS = Object.keys(PERMS);

const SESSION_KEY = "cm_session";
const CSRF_KEY = "cm_csrf";
const COOKIE_ID = "cm_sessionid";
const COOKIE_CSRF = "cm_csrftoken";
const urlParams = new URLSearchParams(window.location.search);
const SESSION_SECONDS = Number(urlParams.get("timeout")) > 0 ? Number(urlParams.get("timeout")) : 20 * 60;
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

const startSession = (user) => {
  state.user = user;
  session = { username: user.username, id: randomToken(), last: Date.now() };
  persistSession();
  setCookie(COOKIE_ID, session.id, SESSION_SECONDS);
  writeLog("INFO", "login", `grupo=${user.grupo}`);
  hooks.afterLogin.forEach((fn) => fn(user));
  state.view = "citas";
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

const renderSessionBar = () => {
  const bar = $("#session-bar");
  if (!state.user) {
    bar.innerHTML = `<div class="session-chip">${pill("Invitado", "amber")}<span class="text-muted">Sin sesion activa. Solo puedes ver Sesion y Roles.</span></div>`;
    return;
  }
  bar.innerHTML = `
    <div class="session-chip">${pill(state.user.grupo, "violet")}<strong>${esc(state.user.nombre)}</strong><span class="text-caption">Usuario: ${esc(state.user.username)}</span>
      <span class="text-caption">Sesion expira en <strong id="session-countdown" class="mono">--:--</strong></span></div>
    <button class="btn btn-surface btn-small" type="button" data-logout>Cerrar sesion</button>`;
  $("[data-logout]", bar).addEventListener("click", () => endSession("logout"));
  updateCountdown();
};

const updateCountdown = () => {
  const node = $("#session-countdown");
  if (!node || !session) {
    return;
  }
  const remaining = Math.max(0, Math.ceil((SESSION_SECONDS * 1000 - (Date.now() - session.last)) / 1000));
  node.textContent = `${pad(Math.floor(remaining / 60))}:${pad(remaining % 60)}`;
};

const credentialsTable = () => `
  <div class="table-wrap"><table class="data-table">
    <thead><tr><th>Usuario</th><th>Grupo</th><th>Clave</th></tr></thead>
    <tbody>${db.users.map((u) => `<tr><td>${esc(u.username)}</td><td>${esc(u.grupo)}</td><td>Uncp2026</td></tr>`).join("")}</tbody>
  </table></div>`;

const sessionConfigHtml = () => `
  <div class="panel stack-md">
    <div class="panel-head"><div class="stack-xs"><h2 class="h3">Configuracion de sesion</h2><p class="text-muted">Equivalente a los ajustes de sesion de Django. Revisa las cookies en DevTools > Application > Cookies.</p></div>${pill("Timeout configurado", "blue")}</div>
    <div class="table-wrap"><table class="data-table">
      <thead><tr><th>Parametro</th><th>Valor</th></tr></thead>
      <tbody>
        <tr><td>SESSION_COOKIE_AGE</td><td>${SESSION_SECONDS} segundos (${Math.round(SESSION_SECONDS / 60 * 10) / 10} minutos de inactividad)</td></tr>
        <tr><td>SESSION_COOKIE_NAME</td><td>${COOKIE_ID}</td></tr>
        <tr><td>SESSION_COOKIE_SAMESITE</td><td>Strict</td></tr>
        <tr><td>SESSION_SAVE_EVERY_REQUEST</td><td>Si (la expiracion se renueva con cada actividad)</td></tr>
        <tr><td>CSRF_COOKIE_NAME</td><td>${COOKIE_CSRF}</td></tr>
      </tbody>
    </table></div>
    <div class="stack-xs"><span class="text-label">document.cookie en este momento</span><pre class="code-block" id="cookie-dump"></pre></div>
  </div>`;

const refreshCookieDump = () => {
  const node = $("#cookie-dump");
  if (node) {
    node.textContent = document.cookie || "Sin cookies visibles. Abre el sitio desde un servidor local (localhost) para que el navegador las guarde.";
  }
};

const renderSesion = (host) => {
  const notice = state.notice ? `<p class="notice notice-warn">${esc(state.notice)}</p>` : "";
  state.notice = "";
  if (state.user) {
    const perms = PERMS[state.user.grupo];
    host.innerHTML = `
      <div class="panel stack-md">
        <div class="panel-head"><div class="stack-xs"><h2 class="h3">Sesion activa</h2><p class="text-muted">Has iniciado sesion como ${esc(state.user.nombre)}.</p></div>${pill(state.user.grupo, "violet")}</div>
        <div class="stack-xs"><span class="text-label">Permisos del grupo</span><div class="flex-wrap">${perms.map((p) => pill(p, "green")).join("")}</div></div>
        <div class="form-actions"><button class="btn btn-primary" type="button" data-logout-view>Cerrar sesion</button></div>
      </div>
      ${sessionConfigHtml()}`;
    $("[data-logout-view]", host).addEventListener("click", () => endSession("logout"));
    refreshCookieDump();
    return;
  }
  const csrf = sessionStorage.getItem(CSRF_KEY) || randomToken();
  sessionStorage.setItem(CSRF_KEY, csrf);
  setCookie(COOKIE_CSRF, csrf, SESSION_SECONDS);
  host.innerHTML = `
    <div class="grid-2">
      <div class="panel stack-md">
        <div class="stack-xs"><h2 class="h3">Iniciar sesion</h2><p class="text-muted">Login diferenciado por tipo de usuario.</p></div>
        ${notice}
        <form id="form-login" class="stack-md" novalidate>
          <input type="hidden" name="csrfmiddlewaretoken" value="${csrf}">
          <div class="form-grid">${fieldHtml({ id: "username", label: "Usuario", placeholder: "Ejemplo: medico1" })}${fieldHtml({ id: "password", label: "Contrasena", type: "password" })}</div>
          <div class="form-actions"><button class="btn btn-primary" type="submit">Ingresar</button></div>
        </form>
      </div>
      <div class="panel stack-md">
        <div class="stack-xs"><h2 class="h3">Usuarios de prueba</h2><p class="text-muted">Cuentas precargadas por grupo.</p></div>
        ${credentialsTable()}
      </div>
    </div>
    ${sessionConfigHtml()}`;
  refreshCookieDump();
  const form = $("#form-login", host);
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const data = readForm(form);
    const errors = {};
    if (data.csrfmiddlewaretoken !== sessionStorage.getItem(CSRF_KEY)) {
      toast("Token CSRF invalido. Recarga la pagina.", "error");
      return;
    }
    if (!data.username) {
      errors.username = "Ingresa tu usuario.";
    }
    if (!data.password) {
      errors.password = "Ingresa tu contrasena.";
    }
    setErrors(form, errors);
    if (Object.keys(errors).length > 0) {
      return;
    }
    const user = db.users.find((u) => u.username === data.username && u.hash === hashPass(data.password));
    if (!user) {
      writeLog("WARNING", "login_fallido", `usuario_intentado=${sanitize(data.username)}`);
      setErrors(form, { password: "Usuario o contrasena incorrectos." });
      toast("Credenciales invalidas.", "error");
      return;
    }
    startSession(user);
    toast(`Bienvenido, ${user.nombre}.`);
  });
};

const renderRoles = (host) => {
  host.innerHTML = `
    <div class="panel stack-md">
      <div class="panel-head"><div class="stack-xs"><h2 class="h3">Diagrama de roles y permisos</h2><p class="text-muted">Cada grupo hereda un conjunto de permisos granulares. El acceso se valida en el middleware de autorizacion.</p></div>${pill("4 grupos", "violet")}</div>
      <div class="grid-2">${GRUPOS.map((g) => `
        <div class="panel stack-sm role-card">
          <div class="panel-head"><h3 class="h4">${esc(g)}</h3>${pill(`${PERMS[g].length} permisos`, "blue")}</div>
          <div class="flex-wrap">${PERMS[g].map((p) => pill(p, "green")).join("")}</div>
        </div>`).join("")}</div>
    </div>
    <div class="panel stack-md">
      <h2 class="h3">Matriz de permisos</h2>
      <div class="table-wrap"><table class="data-table matrix">
        <thead><tr><th>Permiso</th>${GRUPOS.map((g) => `<th>${esc(g)}</th>`).join("")}</tr></thead>
        <tbody>${ALL_PERMS.map((p) => `<tr><td>${esc(p)}</td>${GRUPOS.map((g) => `<td class="${PERMS[g].includes(p) ? "cell-yes" : "cell-no"}">${PERMS[g].includes(p) ? "Si" : "No"}</td>`).join("")}</tr>`).join("")}</tbody>
      </table></div>
      <p class="text-caption">ver_historial_clinico: solo medicos y el propio paciente. generar_reportes: solo administradores.</p>
    </div>`;
};

registerView({ id: "sesion", title: "Sesion", order: 10, perm: null, render: renderSesion });
registerView({ id: "roles", title: "Roles", order: 20, perm: null, render: renderRoles });

hooks.render.push(renderSessionBar);

hooks.boot.push(() => {
  state.view = "sesion";
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (raw) {
      const saved = JSON.parse(raw);
      const user = db.users.find((u) => u.username === saved.username);
      if (user && Date.now() - saved.last < SESSION_SECONDS * 1000) {
        session = saved;
        state.user = user;
        state.view = "citas";
      } else {
        sessionStorage.removeItem(SESSION_KEY);
      }
    }
  } catch (err) {
    sessionStorage.removeItem(SESSION_KEY);
  }
  ["click", "keydown", "touchstart", "scroll"].forEach((name) => document.addEventListener(name, touchSession, { passive: true }));
  window.setInterval(() => {
    if (!state.user || !session) {
      return;
    }
    if (Date.now() - session.last >= SESSION_SECONDS * 1000) {
      endSession("expired");
      return;
    }
    updateCountdown();
    refreshCookieDump();
  }, 1000);
});

const AUDITED_ACTIONS = ["agendar_cita", "cancelar_cita", "registrar_consulta", "ver_historial", "agregar_nota", "registrar_paciente", "registrar_medico", "marcar_completadas"];

const describeRequest = (req) => {
  const d = req.data || {};
  const parts = [];
  if (d.pacienteId) {
    const p = byId(db.pacientes, d.pacienteId);
    parts.push(`paciente_dni=${p ? p.dni : d.pacienteId}`);
  }
  if (d.citaId) {
    parts.push(`cita=${d.citaId}`);
  }
  if (d.consultaId) {
    parts.push(`consulta=${d.consultaId}`);
  }
  if (d.fecha && d.hora) {
    parts.push(`fecha=${d.fecha} hora=${d.hora}`);
  }
  if (Array.isArray(d.ids)) {
    parts.push(`citas=${d.ids.join(",")}`);
  }
  if (d.dni) {
    parts.push(`dni=${d.dni}`);
  }
  if (d.cmp) {
    parts.push(`cmp=${d.cmp}`);
  }
  return parts.join(" ");
};

useMiddleware("auditoria", (req, next) => {
  const res = next();
  if (req.kind === "action" && AUDITED_ACTIONS.includes(req.name)) {
    if (res.ok) {
      writeLog(req.name === "ver_historial" ? "SENSIBLE" : "AUDIT", req.name, describeRequest(req));
    } else {
      writeLog("WARNING", `${req.name}_rechazado`, `motivo=${res.reason}`);
    }
  }
  return res;
});

const dentroDeHorario = (fecha, hora) => {
  const dow = dayOfWeek(fecha);
  const start = toMin(hora);
  if (dow === 0) {
    return false;
  }
  const end = dow === 6 ? 13 * 60 : 18 * 60;
  return start >= 8 * 60 && start + 30 <= end;
};

useMiddleware("horario", (req, next) => {
  if (req.kind === "action" && req.name === "agendar_cita" && req.data && req.data.fecha && req.data.hora) {
    if (!dentroDeHorario(req.data.fecha, req.data.hora)) {
      return { ok: false, status: 422, reason: "Fuera del horario de atencion: L-V 8:00-18:00 y Sab 8:00-13:00. Cada cita dura 30 minutos." };
    }
  }
  return next();
});

const showMedicoAlerts = (user) => {
  const region = $("#alert-region");
  region.innerHTML = "";
  if (!user || user.grupo !== "Medicos") {
    return;
  }
  const hoy = todayIso();
  const pendientes = db.citas.filter((c) => c.medicoId === user.medicoId && c.estado === "pendiente" && c.fecha >= hoy);
  const deHoy = pendientes.filter((c) => c.fecha === hoy);
  region.innerHTML = `<p class="notice notice-info">Alerta del middleware: tienes ${pendientes.length} citas pendientes, ${deHoy.length} de ellas para hoy.</p>`;
  writeLog("INFO", "alerta_citas_pendientes", `pendientes=${pendientes.length} hoy=${deHoy.length}`);
};

hooks.afterLogin.push(showMedicoAlerts);
hooks.boot.push(() => {
  if (state.user) {
    const region = $("#alert-region");
    const hoy = todayIso();
    if (state.user.grupo === "Medicos" && region) {
      const pendientes = db.citas.filter((c) => c.medicoId === state.user.medicoId && c.estado === "pendiente" && c.fecha >= hoy);
      region.innerHTML = `<p class="notice notice-info">Alerta del middleware: tienes ${pendientes.length} citas pendientes.</p>`;
    }
  }
});

const levelColor = { AUDIT: "blue", SENSIBLE: "violet", WARNING: "amber", INFO: "green" };

const renderAuditoria = (host) => {
  host.innerHTML = `
    <div class="panel stack-md">
      <div class="panel-head"><div class="stack-xs"><h2 class="h3">Registro de auditoria</h2><p class="text-muted">Middleware de auditoria medica: quien accedio a que historial, intentos no autorizados y acciones criticas.</p></div>
        <div class="field"><label class="sr-only" for="filtro-nivel">Filtrar por nivel</label>
          <select id="filtro-nivel"><option value="">Todos los niveles</option><option>AUDIT</option><option>SENSIBLE</option><option>WARNING</option><option>INFO</option></select>
        </div>
      </div>
      <div class="stat-row" id="log-stats"></div>
      <div class="stack-xs"><span class="text-label">Salida del middleware (equivalente a la consola)</span><pre class="console" id="log-console"></pre></div>
      <div id="log-table"></div>
    </div>`;
  const refresh = () => {
    const nivel = $("#filtro-nivel", host).value;
    const all = db.logs.slice().reverse();
    const shown = all.filter((l) => !nivel || l.level === nivel).slice(0, 40);
    const count = (level) => db.logs.filter((l) => l.level === level).length;
    $("#log-stats", host).innerHTML = ["AUDIT", "SENSIBLE", "WARNING", "INFO"].map((l) => `<div class="stat"><span class="text-caption">${l}</span><strong>${count(l)}</strong></div>`).join("");
    $("#log-console", host).textContent = shown.length === 0 ? "Sin registros todavia." : shown.map((l) => `[${l.level}] ${l.ts} usuario=${l.user} accion=${l.action} ${l.detail}`).join("\n");
    $("#log-table", host).innerHTML = `<div class="table-wrap"><table class="data-table">
      <thead><tr><th>Fecha y hora</th><th>Nivel</th><th>Usuario</th><th>Accion</th><th>Detalle</th></tr></thead>
      <tbody>${shown.length === 0 ? `<tr><td colspan="5" class="empty-state">No hay registros.</td></tr>` : shown.map((l) => `<tr><td>${esc(l.ts)}</td><td>${pill(l.level, levelColor[l.level] || "blue")}</td><td>${esc(l.user)}</td><td>${esc(l.action)}</td><td class="wrap">${esc(l.detail)}</td></tr>`).join("")}</tbody>
    </table></div>`;
  };
  $("#filtro-nivel", host).addEventListener("change", refresh);
  refresh();
};

registerView({ id: "auditoria", title: "Auditoria", order: 80, perm: "ver_auditoria", render: renderAuditoria });

const ultimaConsulta = (pacienteId) => {
  const fechas = db.consultas.filter((k) => k.pacienteId === pacienteId).map((k) => k.fecha).sort();
  return fechas.length > 0 ? fechas[fechas.length - 1] : null;
};

const defaultAgenda = () => {
  const hoy = todayIso();
  const user = state.user;
  const list = db.citas.filter((c) => c.estado === "pendiente" && c.fecha >= hoy && (!user || user.grupo !== "Medicos" || c.medicoId === user.medicoId)).sort((a, b) => `${a.fecha}${a.hora}`.localeCompare(`${b.fecha}${b.hora}`));
  if (list.length > 0) {
    return { fecha: list[0].fecha, medicoId: list[0].medicoId };
  }
  return { fecha: hoy, medicoId: user && user.medicoId ? user.medicoId : db.medicos[0].id };
};

const renderAgenda = (host) => {
  const user = state.user;
  const soloPropio = user && user.grupo === "Medicos";
  const medicosList = soloPropio ? db.medicos.filter((m) => m.id === user.medicoId) : db.medicos;
  const inicio = defaultAgenda();
  const mark = can("marcar_completadas");
  host.innerHTML = `
    <div class="panel-head"><div class="stack-xs"><h2 class="h3">Agenda diaria por medico</h2><p class="text-muted">Selecciona medico y fecha. Accion masiva: marcar citas como completadas.</p></div>${pill("Operativo", "green")}</div>
    <div class="form-grid">
      <div class="field"><label for="agenda-medico">Medico</label><select id="agenda-medico">${medicosList.map((m) => `<option value="${m.id}"${m.id === inicio.medicoId ? " selected" : ""}>${esc(fullName(m))} - ${esc(m.especialidad)}</option>`).join("")}</select></div>
      <div class="field"><label for="agenda-fecha">Fecha</label><input id="agenda-fecha" type="date" value="${inicio.fecha}"></div>
    </div>
    <div id="agenda-tabla"></div>
    ${mark ? `<div class="form-actions"><button class="btn btn-primary" type="button" id="agenda-marcar">Marcar citas como completadas</button><span class="text-caption" id="agenda-contador"></span></div>` : ""}`;
  const medicoSel = $("#agenda-medico", host);
  const fechaSel = $("#agenda-fecha", host);
  const refresh = () => {
    const list = db.citas.filter((c) => c.medicoId === Number(medicoSel.value) && c.fecha === fechaSel.value).sort((a, b) => a.hora.localeCompare(b.hora));
    $("#agenda-tabla", host).innerHTML = `<div class="table-wrap"><table class="data-table">
      <thead><tr>${mark ? "<th>Sel.</th>" : ""}<th>Hora</th><th>Paciente</th><th>DNI</th><th>Edad</th><th>Estado</th><th>Motivo</th></tr></thead>
      <tbody>${list.length === 0 ? `<tr><td colspan="7" class="empty-state">Sin citas para este medico en la fecha elegida.</td></tr>` : list.map((c) => {
        const p = byId(db.pacientes, c.pacienteId);
        const box = mark ? `<td>${c.estado === "pendiente" ? `<input type="checkbox" data-pick="${c.id}" aria-label="Seleccionar cita ${c.id}">` : ""}</td>` : "";
        return `<tr>${box}<td>${esc(c.hora)}</td><td>${esc(fullName(p))}</td><td>${esc(p.dni)}</td><td>${ageOf(p.nacimiento)}</td><td>${estadoPill(c.estado)}</td><td class="wrap">${esc(c.motivo)}</td></tr>`;
      }).join("")}</tbody></table></div>`;
    const counter = $("#agenda-contador", host);
    if (counter) {
      counter.textContent = `${list.length} citas en la agenda, ${list.filter((c) => c.estado === "pendiente").length} pendientes.`;
    }
  };
  medicoSel.addEventListener("change", refresh);
  fechaSel.addEventListener("change", refresh);
  refresh();
  const button = $("#agenda-marcar", host);
  if (button) {
    button.addEventListener("click", () => {
      const ids = $$("[data-pick]:checked", host).map((box) => Number(box.dataset.pick));
      if (ids.length === 0) {
        toast("Selecciona al menos una cita pendiente.", "error");
        return;
      }
      const res = dispatch({ kind: "action", name: "marcar_completadas", perm: "marcar_completadas", data: { ids } });
      if (!res.ok) {
        toast(res.reason, "error");
        return;
      }
      ids.forEach((id) => {
        byId(db.citas, id).estado = "completada";
      });
      saveDb();
      toast(`${ids.length} citas marcadas como completadas.`);
      refresh();
    });
  }
};
