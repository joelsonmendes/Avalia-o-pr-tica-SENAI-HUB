/* AvaliaPrática SENAI — HTML/CSS/JS puro, offline, com LocalStorage */
const STORAGE_KEY = 'avaliapratica-senai-instalacoes-v1';
const activities = Array.isArray(window.AVALIA_PRATICA_ACTIVITIES) ? window.AVALIA_PRATICA_ACTIVITIES : [];

const defaultState = {
  settings: {
    instituicao: 'SENAI HUB',
    curso: 'Instalação de Sistemas Elétricos Prediais',
    turma: '',
    docente: '',
    local: 'Laboratório de Instalações Elétricas Prediais'
  },
  students: [],
  evaluations: {},
  theme: 'light'
};

let state = loadState();
let currentView = 'dashboard';
let selectedActivityId = activities[0]?.id || '';
let showAnswers = false;
let installPromptEvent = null;

const app = document.getElementById('app');
const toast = document.getElementById('toast');

init();

function init() {
  applyTheme();
  setupNavigation();
  setupPwaInstall();
  render();

  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('./service-worker.js').catch(() => {});
    });
  }
}

function loadState() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) return structuredClone(defaultState);
    const parsed = JSON.parse(saved);
    return {
      ...structuredClone(defaultState),
      ...parsed,
      settings: { ...defaultState.settings, ...(parsed.settings || {}) },
      students: Array.isArray(parsed.students) ? parsed.students : [],
      evaluations: parsed.evaluations && typeof parsed.evaluations === 'object' ? parsed.evaluations : {},
      theme: parsed.theme || 'light'
    };
  } catch (error) {
    console.warn('Falha ao carregar dados locais:', error);
    return structuredClone(defaultState);
  }
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function setupNavigation() {
  document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      currentView = btn.dataset.view;
      document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      render();
      app.focus({ preventScroll: true });
    });
  });

  document.getElementById('themeBtn')?.addEventListener('click', () => {
    state.theme = state.theme === 'dark' ? 'light' : 'dark';
    saveState();
    applyTheme();
  });
}

function setupPwaInstall() {
  const installBtn = document.getElementById('installBtn');
  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    installPromptEvent = event;
    installBtn.hidden = false;
  });

  installBtn?.addEventListener('click', async () => {
    if (!installPromptEvent) return;
    installPromptEvent.prompt();
    await installPromptEvent.userChoice;
    installPromptEvent = null;
    installBtn.hidden = true;
  });
}

function applyTheme() {
  document.documentElement.dataset.theme = state.theme;
}

function render() {
  const views = {
    dashboard: renderDashboard,
    students: renderStudents,
    activities: renderActivities,
    evaluation: renderEvaluation,
    reports: renderReports,
    backup: renderBackup
  };
  (views[currentView] || renderDashboard)();
}

function notify(message, type = 'success') {
  toast.textContent = message;
  toast.className = `toast show ${type}`;
  window.setTimeout(() => toast.className = 'toast', 2800);
}

function uid(prefix = 'id') {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function escapeHTML(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function activityById(id) {
  return activities.find(a => a.id === id) || activities[0];
}

function activeStudents() {
  return state.students.filter(s => s.status !== 'inativo');
}

function evalKey(activityId, studentId) {
  return `${activityId}::${studentId}`;
}

function getEvaluation(activityId, studentId) {
  const key = evalKey(activityId, studentId);
  const saved = state.evaluations[key] || {};
  return {
    presence: saved.presence || 'presente',
    scores: saved.scores || {},
    note: saved.note || '',
    updatedAt: saved.updatedAt || ''
  };
}

function setEvaluation(activityId, studentId, patch) {
  const key = evalKey(activityId, studentId);
  const current = getEvaluation(activityId, studentId);
  state.evaluations[key] = {
    ...current,
    ...patch,
    scores: { ...current.scores, ...(patch.scores || {}) },
    updatedAt: new Date().toISOString()
  };
  saveState();
}

function hasEvaluationData(evaluation) {
  return evaluation.presence !== 'presente' || Boolean(evaluation.note?.trim()) || Object.values(evaluation.scores || {}).some(v => v !== '' && v !== null && v !== undefined);
}

function gradeFor(activity, evaluation) {
  if (!activity || !evaluation) return null;
  if (evaluation.presence === 'ausente') return 0;
  const max = activity.criteria.reduce((sum, c) => sum + Number(c.max || 0), 0);
  if (!max) return null;
  const filled = activity.criteria.some(c => evaluation.scores[c.id] !== undefined && evaluation.scores[c.id] !== '');
  if (!filled && !hasEvaluationData(evaluation)) return null;
  const scored = activity.criteria.reduce((sum, c) => sum + Number(evaluation.scores[c.id] || 0), 0);
  return Math.max(0, Math.min(10, (scored / max) * 10));
}

function formatGrade(value) {
  if (value === null || Number.isNaN(value)) return '—';
  return value.toFixed(1).replace('.', ',');
}

function renderDashboard() {
  const summary = calculateSummary();
  app.innerHTML = `
    <section class="hero-card">
      <div>
        <p class="eyebrow">Painel de acompanhamento</p>
        <h2>${escapeHTML(state.settings.curso)}</h2>
        <p class="muted">Cadastre os alunos, abra a atividade da aula e registre a avaliação individual com critérios técnicos, segurança, organização e observações.</p>
      </div>
      <div class="hero-actions">
        <button class="primary-btn" data-view-target="evaluation">Abrir avaliação</button>
        <button class="secondary-btn" data-view-target="activities">Ver roteiros</button>
      </div>
    </section>

    <section class="stats-grid">
      <article class="stat-card"><span>Alunos ativos</span><strong>${summary.activeStudents}</strong></article>
      <article class="stat-card"><span>Atividades cadastradas</span><strong>${activities.length}</strong></article>
      <article class="stat-card"><span>Registros de avaliação</span><strong>${summary.totalEvaluations}</strong></article>
      <article class="stat-card"><span>Média geral</span><strong>${formatGrade(summary.classAverage)}</strong></article>
    </section>

    <section class="two-column">
      <article class="panel">
        <div class="panel-header">
          <h3>Fluxo recomendado de uso</h3>
        </div>
        <ol class="timeline-list">
          <li><strong>1. Alunos:</strong> cadastre a turma ou cole uma lista de nomes.</li>
          <li><strong>2. Atividades:</strong> consulte o roteiro da aula, perguntas e respostas esperadas.</li>
          <li><strong>3. Avaliação:</strong> marque presença, critérios de desempenho, nota automática e observações.</li>
          <li><strong>4. Relatórios:</strong> gere médias, presença, CSV e impressão para evidência pedagógica.</li>
          <li><strong>5. Backup:</strong> exporte o arquivo JSON para guardar ou migrar para outro computador.</li>
        </ol>
      </article>

      <article class="panel">
        <div class="panel-header">
          <h3>Situação-problema integradora</h3>
        </div>
        <p>A instalação final contempla iluminação comandada por interruptor paralelo, tomadas 127 V e 220 V, proteção elétrica, identificação dos condutores, testes e, quando disponível, bomba/carga simulada por chave boia.</p>
        <div class="notice-card">
          <strong>Regra fixa de segurança:</strong> nenhum circuito deve ser energizado antes da inspeção e autorização do docente.
        </div>
      </article>
    </section>
  `;

  app.querySelectorAll('[data-view-target]').forEach(btn => {
    btn.addEventListener('click', () => goToView(btn.dataset.viewTarget));
  });
}

function calculateSummary() {
  const evals = Object.entries(state.evaluations);
  const grades = [];
  for (const [key, evaluation] of evals) {
    const [activityId] = key.split('::');
    const activity = activityById(activityId);
    const grade = gradeFor(activity, evaluation);
    if (grade !== null) grades.push(grade);
  }
  return {
    activeStudents: activeStudents().length,
    totalEvaluations: evals.filter(([, e]) => hasEvaluationData(e)).length,
    classAverage: grades.length ? grades.reduce((a, b) => a + b, 0) / grades.length : null
  };
}

function goToView(view) {
  const btn = document.querySelector(`.nav-btn[data-view="${view}"]`);
  if (btn) btn.click();
}

function renderStudents() {
  const rows = state.students.map((student, index) => `
    <tr>
      <td>${index + 1}</td>
      <td><strong>${escapeHTML(student.name)}</strong><span class="mobile-muted">${escapeHTML(student.className || state.settings.turma || 'Sem turma')}</span></td>
      <td>${escapeHTML(student.className || state.settings.turma || '—')}</td>
      <td>
        <select class="compact-select student-status" data-id="${student.id}">
          <option value="ativo" ${student.status !== 'inativo' ? 'selected' : ''}>Ativo</option>
          <option value="inativo" ${student.status === 'inativo' ? 'selected' : ''}>Inativo</option>
        </select>
      </td>
      <td class="actions-cell">
        <button class="icon-btn" data-action="edit-student" data-id="${student.id}">Editar</button>
        <button class="icon-btn danger" data-action="delete-student" data-id="${student.id}">Excluir</button>
      </td>
    </tr>
  `).join('');

  app.innerHTML = `
    <section class="panel">
      <div class="panel-header">
        <div>
          <p class="eyebrow">Cadastro da turma</p>
          <h2>Alunos</h2>
        </div>
        <button class="secondary-btn" data-action="seed-students">Inserir exemplo</button>
      </div>

      <form class="form-grid" id="studentForm">
        <label>Nome do aluno
          <input required id="studentName" placeholder="Ex.: Maria Silva" autocomplete="off" />
        </label>
        <label>Turma
          <input id="studentClass" placeholder="Ex.: Predial 2026" value="${escapeHTML(state.settings.turma)}" />
        </label>
        <button class="primary-btn" type="submit">Adicionar aluno</button>
      </form>
    </section>

    <section class="panel">
      <div class="panel-header">
        <h3>Importação rápida</h3>
      </div>
      <p class="muted">Cole um nome por linha. A turma será aplicada a todos os nomes inseridos.</p>
      <textarea id="bulkStudents" rows="5" placeholder="João Silva\nMaria Souza\nCarlos Mendes"></textarea>
      <div class="row-actions">
        <button class="secondary-btn" data-action="bulk-add-students">Importar nomes</button>
        <button class="ghost-btn" data-action="clear-inactive">Remover inativos sem avaliações</button>
      </div>
    </section>

    <section class="panel">
      <div class="panel-header">
        <h3>Lista cadastrada</h3>
        <span class="pill">${state.students.length} aluno(s)</span>
      </div>
      ${state.students.length ? `
        <div class="table-wrap">
          <table class="data-table">
            <thead><tr><th>#</th><th>Aluno</th><th>Turma</th><th>Status</th><th>Ações</th></tr></thead>
            <tbody>${rows}</tbody>
          </table>
        </div>
      ` : emptyState('Cadastre os alunos para liberar a avaliação individual.')}
    </section>
  `;

  app.querySelector('#studentForm').addEventListener('submit', (event) => {
    event.preventDefault();
    const name = app.querySelector('#studentName').value.trim();
    const className = app.querySelector('#studentClass').value.trim();
    addStudent(name, className);
  });

  app.querySelectorAll('[data-action]').forEach(btn => btn.addEventListener('click', handleStudentAction));
  app.querySelectorAll('.student-status').forEach(select => {
    select.addEventListener('change', () => {
      const student = state.students.find(s => s.id === select.dataset.id);
      if (!student) return;
      student.status = select.value;
      saveState();
      notify('Status atualizado.');
      renderStudents();
    });
  });
}

function addStudent(name, className) {
  if (!name) return notify('Informe o nome do aluno.', 'error');
  const duplicated = state.students.some(s => normalize(s.name) === normalize(name));
  if (duplicated) return notify('Esse aluno já está cadastrado.', 'error');
  state.students.push({ id: uid('aluno'), name, className, status: 'ativo', createdAt: new Date().toISOString() });
  saveState();
  notify('Aluno cadastrado.');
  renderStudents();
}

function normalize(value) {
  return String(value || '').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function handleStudentAction(event) {
  const action = event.currentTarget.dataset.action;
  const id = event.currentTarget.dataset.id;

  if (action === 'seed-students') {
    const examples = ['Ana Beatriz Lima', 'Bruno Henrique Souza', 'Carlos Eduardo Mendes', 'Daniela Ferreira', 'Elias Santos', 'Fernanda Costa'];
    examples.forEach(name => {
      if (!state.students.some(s => normalize(s.name) === normalize(name))) {
        state.students.push({ id: uid('aluno'), name, className: state.settings.turma || 'Turma Predial', status: 'ativo', createdAt: new Date().toISOString() });
      }
    });
    saveState();
    notify('Lista de exemplo inserida.');
    renderStudents();
  }

  if (action === 'bulk-add-students') {
    const text = app.querySelector('#bulkStudents').value;
    const names = text.split(/\n|;/).map(x => x.trim()).filter(Boolean);
    const className = state.settings.turma || app.querySelector('#studentClass')?.value || '';
    let count = 0;
    names.forEach(name => {
      if (!state.students.some(s => normalize(s.name) === normalize(name))) {
        state.students.push({ id: uid('aluno'), name, className, status: 'ativo', createdAt: new Date().toISOString() });
        count++;
      }
    });
    saveState();
    notify(`${count} aluno(s) importado(s).`);
    renderStudents();
  }

  if (action === 'edit-student') {
    const student = state.students.find(s => s.id === id);
    if (!student) return;
    const name = prompt('Nome do aluno:', student.name);
    if (name === null) return;
    const className = prompt('Turma:', student.className || state.settings.turma || '') ?? student.className;
    student.name = name.trim() || student.name;
    student.className = className.trim();
    saveState();
    notify('Aluno atualizado.');
    renderStudents();
  }

  if (action === 'delete-student') {
    const student = state.students.find(s => s.id === id);
    if (!student) return;
    const hasEvals = Object.keys(state.evaluations).some(key => key.endsWith(`::${id}`));
    const message = hasEvals
      ? `Excluir ${student.name}? As avaliações desse aluno também serão removidas.`
      : `Excluir ${student.name}?`;
    if (!confirm(message)) return;
    state.students = state.students.filter(s => s.id !== id);
    Object.keys(state.evaluations).forEach(key => {
      if (key.endsWith(`::${id}`)) delete state.evaluations[key];
    });
    saveState();
    notify('Aluno excluído.');
    renderStudents();
  }

  if (action === 'clear-inactive') {
    const before = state.students.length;
    state.students = state.students.filter(student => {
      const hasEvals = Object.keys(state.evaluations).some(key => key.endsWith(`::${student.id}`));
      return student.status !== 'inativo' || hasEvals;
    });
    saveState();
    notify(`${before - state.students.length} aluno(s) removido(s).`);
    renderStudents();
  }
}

function renderActivities() {
  const selected = activityById(selectedActivityId);
  const cards = activities.map(activity => `
    <button class="activity-list-btn ${activity.id === selected.id ? 'active' : ''}" data-activity-id="${activity.id}">
      <span>Aula ${activity.number}</span>
      <strong>${escapeHTML(activity.title.replace(`Aula ${activity.number} — `, ''))}</strong>
    </button>
  `).join('');

  app.innerHTML = `
    <section class="activity-layout">
      <aside class="activity-sidebar panel">
        <div class="panel-header">
          <div>
            <p class="eyebrow">Roteiros de aula</p>
            <h2>Atividades</h2>
          </div>
        </div>
        <div class="activity-list">${cards}</div>
      </aside>

      <article class="panel activity-detail">
        <div class="panel-header activity-title-block">
          <div>
            <p class="eyebrow">${escapeHTML(selected.duration)} • ${escapeHTML(selected.kind)}</p>
            <h2>${escapeHTML(selected.title)}</h2>
          </div>
          <div class="row-actions">
            <button class="secondary-btn" data-action="go-evaluate">Avaliar esta aula</button>
            <button class="ghost-btn" data-action="toggle-answers">${showAnswers ? 'Ocultar respostas' : 'Mostrar respostas'}</button>
          </div>
        </div>
        ${renderActivityBody(selected)}
      </article>
    </section>
  `;

  app.querySelectorAll('.activity-list-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      selectedActivityId = btn.dataset.activityId;
      renderActivities();
    });
  });

  app.querySelector('[data-action="go-evaluate"]')?.addEventListener('click', () => goToView('evaluation'));
  app.querySelector('[data-action="toggle-answers"]')?.addEventListener('click', () => {
    if (!showAnswers) {
      const pin = prompt('Digite o PIN do docente para liberar respostas esperadas:');
      if (pin !== '2026') return notify('PIN incorreto. Respostas mantidas ocultas.', 'error');
    }
    showAnswers = !showAnswers;
    renderActivities();
  });
}

function renderActivityBody(activity) {
  return `
    <div class="notice-card strong">
      <strong>Objetivo:</strong> ${escapeHTML(activity.objective)}
    </div>

    <div class="detail-grid">
      ${renderListBlock('Capacidades trabalhadas', activity.capacities)}
      ${renderListBlock('Conhecimentos relacionados', activity.knowledge)}
      ${renderListBlock('Materiais e recursos', activity.materials)}
      ${renderListBlock('Evidências da aula', activity.evidence)}
    </div>

    <section class="detail-section">
      <h3>Passo a passo do docente</h3>
      ${renderOrdered(activity.teacherSteps)}
    </section>

    <section class="detail-section">
      <h3>Passo a passo dos alunos</h3>
      ${renderOrdered(activity.studentSteps)}
    </section>

    <section class="detail-section">
      <h3>Checklist de segurança</h3>
      <div class="check-grid">
        ${activity.safetyChecklist.map(item => `<label><input type="checkbox" /> ${escapeHTML(item)}</label>`).join('')}
      </div>
    </section>

    <section class="detail-section">
      <h3>Perguntas para avaliação oral ${showAnswers ? '<span class="pill success">respostas liberadas</span>' : '<span class="pill">modo aluno</span>'}</h3>
      <div class="qa-list">
        ${activity.questions.map((item, index) => `
          <article class="qa-card">
            <strong>${index + 1}. ${escapeHTML(item.q)}</strong>
            ${showAnswers ? `<p><span>Resposta esperada:</span> ${escapeHTML(item.a)}</p>` : '<p class="muted">Resposta oculta. Use o botão “Mostrar respostas” no modo docente.</p>'}
          </article>
        `).join('')}
      </div>
    </section>

    <section class="detail-section">
      <h3>Critérios de avaliação individual</h3>
      <div class="criteria-grid">
        ${activity.criteria.map(c => `
          <article>
            <strong>${escapeHTML(c.label)}</strong>
            <small>0 = não atendeu • 1 = parcial • 2 = pleno</small>
          </article>
        `).join('')}
      </div>
    </section>
  `;
}

function renderListBlock(title, items) {
  return `
    <article class="mini-card">
      <h3>${escapeHTML(title)}</h3>
      <ul>${items.map(item => `<li>${escapeHTML(item)}</li>`).join('')}</ul>
    </article>
  `;
}

function renderOrdered(items) {
  return `<ol class="step-list">${items.map(item => `<li>${escapeHTML(item)}</li>`).join('')}</ol>`;
}

function renderEvaluation() {
  const selected = activityById(selectedActivityId);
  const students = activeStudents();
  const options = activities.map(activity => `<option value="${activity.id}" ${activity.id === selected.id ? 'selected' : ''}>Aula ${activity.number} — ${escapeHTML(activity.title.replace(`Aula ${activity.number} — `, ''))}</option>`).join('');

  app.innerHTML = `
    <section class="panel">
      <div class="panel-header">
        <div>
          <p class="eyebrow">Registro individual</p>
          <h2>Avaliação da aula prática</h2>
        </div>
        <div class="row-actions">
          <button class="secondary-btn" data-action="mark-present">Todos presentes</button>
          <button class="ghost-btn" data-action="export-activity-csv">Exportar CSV</button>
        </div>
      </div>

      <label class="wide-label">Selecione a atividade
        <select id="activitySelect">${options}</select>
      </label>

      <div class="notice-card">
        <strong>${escapeHTML(selected.title)}</strong><br />
        ${escapeHTML(selected.objective)}
      </div>

      <div class="criteria-strip">
        ${selected.criteria.map(c => `<span title="${escapeHTML(c.label)}"><strong>${escapeHTML(shortLabel(c.label))}</strong> 0–2</span>`).join('')}
      </div>
    </section>

    <section class="panel">
      <div class="panel-header">
        <h3>Alunos avaliados individualmente</h3>
        <span class="pill">${students.length} ativo(s)</span>
      </div>
      ${students.length ? renderEvaluationTable(selected, students) : emptyState('Cadastre alunos ativos para iniciar a avaliação.')}
    </section>
  `;

  app.querySelector('#activitySelect').addEventListener('change', (event) => {
    selectedActivityId = event.target.value;
    renderEvaluation();
  });

  app.querySelector('[data-action="mark-present"]')?.addEventListener('click', () => {
    students.forEach(student => setEvaluation(selected.id, student.id, { presence: 'presente' }));
    notify('Todos os alunos ativos foram marcados como presentes.');
    renderEvaluation();
  });

  app.querySelector('[data-action="export-activity-csv"]')?.addEventListener('click', () => exportActivityCsv(selected));

  setupEvaluationListeners(selected);
}

function shortLabel(label) {
  const cut = label.split(',')[0].split(' e ')[0].trim();
  return cut.length > 22 ? `${cut.slice(0, 22)}…` : cut;
}

function renderEvaluationTable(activity, students) {
  const headerCriteria = activity.criteria.map(c => `<th>${escapeHTML(shortLabel(c.label))}</th>`).join('');
  const rows = students.map(student => {
    const evaluation = getEvaluation(activity.id, student.id);
    const grade = gradeFor(activity, evaluation);
    const disabled = evaluation.presence === 'ausente' ? 'disabled' : '';
    return `
      <tr class="eval-row ${evaluation.presence === 'ausente' ? 'is-absent' : ''}" data-student-id="${student.id}">
        <td class="student-cell">
          <strong>${escapeHTML(student.name)}</strong>
          <span>${escapeHTML(student.className || state.settings.turma || '')}</span>
        </td>
        <td>
          <select class="compact-select eval-presence" data-student-id="${student.id}">
            <option value="presente" ${evaluation.presence === 'presente' ? 'selected' : ''}>Presente</option>
            <option value="parcial" ${evaluation.presence === 'parcial' ? 'selected' : ''}>Parcial</option>
            <option value="ausente" ${evaluation.presence === 'ausente' ? 'selected' : ''}>Ausente</option>
          </select>
        </td>
        ${activity.criteria.map(c => `
          <td>
            <select class="score-select" data-student-id="${student.id}" data-criteria-id="${c.id}" ${disabled}>
              <option value="">—</option>
              <option value="0" ${String(evaluation.scores[c.id]) === '0' ? 'selected' : ''}>0</option>
              <option value="1" ${String(evaluation.scores[c.id]) === '1' ? 'selected' : ''}>1</option>
              <option value="2" ${String(evaluation.scores[c.id]) === '2' ? 'selected' : ''}>2</option>
            </select>
          </td>
        `).join('')}
        <td><strong class="grade-badge" data-grade-student="${student.id}">${formatGrade(grade)}</strong></td>
        <td><textarea class="note-input" data-student-id="${student.id}" rows="2" placeholder="Observação individual">${escapeHTML(evaluation.note)}</textarea></td>
      </tr>
    `;
  }).join('');

  return `
    <div class="table-wrap eval-table-wrap">
      <table class="data-table eval-table">
        <thead>
          <tr><th>Aluno</th><th>Presença</th>${headerCriteria}<th>Nota</th><th>Observação</th></tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
  `;
}

function setupEvaluationListeners(activity) {
  app.querySelectorAll('.eval-presence').forEach(select => {
    select.addEventListener('change', () => {
      const studentId = select.dataset.studentId;
      setEvaluation(activity.id, studentId, { presence: select.value });
      updateEvaluationRow(activity, studentId);
      notify('Presença atualizada.');
    });
  });

  app.querySelectorAll('.score-select').forEach(select => {
    select.addEventListener('change', () => {
      const studentId = select.dataset.studentId;
      const criteriaId = select.dataset.criteriaId;
      setEvaluation(activity.id, studentId, { scores: { [criteriaId]: select.value } });
      updateGradeBadge(activity, studentId);
    });
  });

  app.querySelectorAll('.note-input').forEach(textarea => {
    textarea.addEventListener('input', debounce(() => {
      setEvaluation(activity.id, textarea.dataset.studentId, { note: textarea.value });
      updateGradeBadge(activity, textarea.dataset.studentId);
    }, 250));
  });
}

function updateEvaluationRow(activity, studentId) {
  const row = app.querySelector(`.eval-row[data-student-id="${studentId}"]`);
  if (!row) return;
  const evaluation = getEvaluation(activity.id, studentId);
  row.classList.toggle('is-absent', evaluation.presence === 'ausente');
  row.querySelectorAll('.score-select').forEach(select => {
    select.disabled = evaluation.presence === 'ausente';
  });
  updateGradeBadge(activity, studentId);
}

function updateGradeBadge(activity, studentId) {
  const badge = app.querySelector(`[data-grade-student="${studentId}"]`);
  if (!badge) return;
  badge.textContent = formatGrade(gradeFor(activity, getEvaluation(activity.id, studentId)));
}

function debounce(fn, delay) {
  let timer;
  return function debounced(...args) {
    clearTimeout(timer);
    timer = setTimeout(() => fn.apply(this, args), delay);
  };
}

function renderReports() {
  const summaries = state.students.map(student => studentSummary(student));
  const rows = summaries.map(item => `
    <tr>
      <td><strong>${escapeHTML(item.student.name)}</strong><span class="mobile-muted">${escapeHTML(item.student.className || state.settings.turma || '')}</span></td>
      <td>${escapeHTML(item.student.status || 'ativo')}</td>
      <td>${item.evaluated}/${activities.length}</td>
      <td>${formatGrade(item.average)}</td>
      <td>${item.presences}</td>
      <td>${item.absences}</td>
      <td>${item.lastNote ? escapeHTML(item.lastNote) : '—'}</td>
    </tr>
  `).join('');

  app.innerHTML = `
    <section class="panel">
      <div class="panel-header">
        <div>
          <p class="eyebrow">Evidências e resultados</p>
          <h2>Relatórios</h2>
        </div>
        <div class="row-actions">
          <button class="secondary-btn" data-action="export-summary-csv">Exportar resumo CSV</button>
          <button class="ghost-btn" data-action="print-report">Imprimir / PDF</button>
        </div>
      </div>
      <div class="report-cover">
        <strong>${escapeHTML(state.settings.instituicao)}</strong>
        <span>${escapeHTML(state.settings.curso)}</span>
        <span>Turma: ${escapeHTML(state.settings.turma || '—')} • Docente: ${escapeHTML(state.settings.docente || '—')}</span>
      </div>
    </section>

    <section class="panel printable-area">
      <div class="panel-header"><h3>Resumo por aluno</h3></div>
      ${state.students.length ? `
        <div class="table-wrap">
          <table class="data-table">
            <thead><tr><th>Aluno</th><th>Status</th><th>Avaliações</th><th>Média</th><th>Presenças</th><th>Ausências</th><th>Última observação</th></tr></thead>
            <tbody>${rows}</tbody>
          </table>
        </div>
      ` : emptyState('Nenhum aluno cadastrado.')}
    </section>

    <section class="panel">
      <div class="panel-header"><h3>Mapa de atividades</h3></div>
      <div class="activity-progress-grid">
        ${activities.map(activity => renderActivityProgress(activity)).join('')}
      </div>
    </section>
  `;

  app.querySelector('[data-action="export-summary-csv"]')?.addEventListener('click', exportSummaryCsv);
  app.querySelector('[data-action="print-report"]')?.addEventListener('click', () => window.print());
}

function studentSummary(student) {
  const grades = [];
  let evaluated = 0;
  let presences = 0;
  let absences = 0;
  let lastNote = '';

  for (const activity of activities) {
    const evaluation = getEvaluation(activity.id, student.id);
    if (hasEvaluationData(evaluation)) {
      evaluated++;
      const grade = gradeFor(activity, evaluation);
      if (grade !== null) grades.push(grade);
      if (evaluation.presence === 'ausente') absences++;
      else presences++;
      if (evaluation.note?.trim()) lastNote = evaluation.note.trim();
    }
  }

  return {
    student,
    evaluated,
    presences,
    absences,
    average: grades.length ? grades.reduce((a, b) => a + b, 0) / grades.length : null,
    lastNote
  };
}

function renderActivityProgress(activity) {
  const evaluated = activeStudents().filter(student => hasEvaluationData(getEvaluation(activity.id, student.id))).length;
  const total = activeStudents().length || 1;
  const percent = Math.round((evaluated / total) * 100);
  return `
    <article class="progress-card">
      <strong>Aula ${activity.number}</strong>
      <span>${escapeHTML(activity.title.replace(`Aula ${activity.number} — `, ''))}</span>
      <div class="progress-bar"><i style="width:${percent}%"></i></div>
      <small>${evaluated}/${total} avaliados</small>
    </article>
  `;
}

function renderBackup() {
  app.innerHTML = `
    <section class="panel">
      <div class="panel-header">
        <div>
          <p class="eyebrow">Configurações</p>
          <h2>Identificação da turma</h2>
        </div>
      </div>
      <form id="settingsForm" class="form-grid settings-grid">
        <label>Instituição
          <input name="instituicao" value="${escapeHTML(state.settings.instituicao)}" />
        </label>
        <label>Curso
          <input name="curso" value="${escapeHTML(state.settings.curso)}" />
        </label>
        <label>Turma
          <input name="turma" value="${escapeHTML(state.settings.turma)}" />
        </label>
        <label>Docente
          <input name="docente" value="${escapeHTML(state.settings.docente)}" />
        </label>
        <label>Local
          <input name="local" value="${escapeHTML(state.settings.local)}" />
        </label>
        <button class="primary-btn" type="submit">Salvar configurações</button>
      </form>
    </section>

    <section class="panel two-column-panel">
      <div>
        <h3>Backup dos dados</h3>
        <p class="muted">Exporte um arquivo JSON para guardar todas as avaliações, alunos e configurações. Esse arquivo pode ser importado em outro computador.</p>
        <div class="row-actions">
          <button class="secondary-btn" data-action="export-json">Exportar JSON</button>
          <button class="ghost-btn danger" data-action="reset-all">Limpar tudo</button>
        </div>
      </div>
      <div>
        <h3>Importar backup</h3>
        <input type="file" id="importFile" accept="application/json" />
        <button class="secondary-btn" data-action="import-json">Importar JSON</button>
      </div>
    </section>

    <section class="panel">
      <div class="panel-header"><h3>Orientação de implantação</h3></div>
      <ol class="timeline-list">
        <li>Para usar localmente, abra o arquivo <strong>index.html</strong> no navegador.</li>
        <li>Para publicar, suba a pasta no GitHub Pages, Vercel ou Netlify.</li>
        <li>Para instalar no celular, acesse o link pelo Chrome/Edge e toque em <strong>Instalar aplicativo</strong>.</li>
        <li>O app salva os dados no navegador. Use o backup JSON para não perder registros.</li>
      </ol>
    </section>
  `;

  app.querySelector('#settingsForm').addEventListener('submit', event => {
    event.preventDefault();
    const data = new FormData(event.target);
    state.settings = {
      instituicao: data.get('instituicao')?.toString().trim() || defaultState.settings.instituicao,
      curso: data.get('curso')?.toString().trim() || defaultState.settings.curso,
      turma: data.get('turma')?.toString().trim() || '',
      docente: data.get('docente')?.toString().trim() || '',
      local: data.get('local')?.toString().trim() || defaultState.settings.local
    };
    saveState();
    notify('Configurações salvas.');
  });

  app.querySelector('[data-action="export-json"]').addEventListener('click', exportJson);
  app.querySelector('[data-action="import-json"]').addEventListener('click', importJson);
  app.querySelector('[data-action="reset-all"]').addEventListener('click', resetAll);
}

function exportActivityCsv(activity) {
  const headers = ['Aluno', 'Turma', 'Presença', ...activity.criteria.map(c => c.label), 'Nota', 'Observação'];
  const rows = activeStudents().map(student => {
    const ev = getEvaluation(activity.id, student.id);
    return [
      student.name,
      student.className || state.settings.turma || '',
      ev.presence,
      ...activity.criteria.map(c => ev.scores[c.id] ?? ''),
      formatGrade(gradeFor(activity, ev)),
      ev.note || ''
    ];
  });
  downloadCsv(`avaliacao-aula-${activity.number}.csv`, [headers, ...rows]);
}

function exportSummaryCsv() {
  const headers = ['Aluno', 'Turma', 'Status', 'Atividades avaliadas', 'Média', 'Presenças', 'Ausências', 'Última observação'];
  const rows = state.students.map(student => {
    const summary = studentSummary(student);
    return [
      student.name,
      student.className || state.settings.turma || '',
      student.status || 'ativo',
      `${summary.evaluated}/${activities.length}`,
      formatGrade(summary.average),
      summary.presences,
      summary.absences,
      summary.lastNote
    ];
  });
  downloadCsv('relatorio-resumo-turma.csv', [headers, ...rows]);
}

function downloadCsv(filename, rows) {
  const csv = rows.map(row => row.map(csvCell).join(';')).join('\n');
  downloadFile(filename, '\ufeff' + csv, 'text/csv;charset=utf-8');
}

function csvCell(value) {
  const text = String(value ?? '').replaceAll('"', '""');
  return `"${text}"`;
}

function exportJson() {
  const payload = {
    exportedAt: new Date().toISOString(),
    app: 'AvaliaPrática SENAI',
    version: '1.0.0',
    state
  };
  downloadFile('backup-avaliapratica-senai.json', JSON.stringify(payload, null, 2), 'application/json');
}

function importJson() {
  const file = app.querySelector('#importFile').files?.[0];
  if (!file) return notify('Selecione um arquivo JSON de backup.', 'error');
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const parsed = JSON.parse(reader.result);
      const imported = parsed.state || parsed;
      if (!imported.students || !imported.evaluations) throw new Error('Formato inválido');
      state = {
        ...structuredClone(defaultState),
        ...imported,
        settings: { ...defaultState.settings, ...(imported.settings || {}) },
        students: imported.students || [],
        evaluations: imported.evaluations || {},
        theme: imported.theme || state.theme
      };
      saveState();
      applyTheme();
      notify('Backup importado com sucesso.');
      renderBackup();
    } catch (error) {
      notify('Não foi possível importar. Verifique o arquivo.', 'error');
    }
  };
  reader.readAsText(file, 'utf-8');
}

function resetAll() {
  if (!confirm('Deseja apagar alunos, avaliações e configurações salvas neste navegador?')) return;
  state = structuredClone(defaultState);
  saveState();
  applyTheme();
  notify('Dados locais apagados.');
  renderBackup();
}

function downloadFile(filename, content, type) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function emptyState(message) {
  return `
    <div class="empty-state">
      <div class="empty-icon">⚡</div>
      <h3>Nenhum registro encontrado</h3>
      <p>${escapeHTML(message)}</p>
    </div>
  `;
}
