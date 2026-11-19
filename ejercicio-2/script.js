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
