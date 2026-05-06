const STORAGE_KEY = "opsforms_passagem_servico_supervisao_v1";
const HEADER_KEY = "opsforms_passagem_servico_supervisao_header_v1";

const SUPERVISORES = ["Antônio Marcos", "Osmar Silva", "Diego Praxedes", "Ediclaudio Cunha"];
const BACK_TO_BACK = {
  "Antônio Marcos": "Osmar Silva",
  "Osmar Silva": "Antônio Marcos",
  "Diego Praxedes": "Ediclaudio Cunha",
  "Ediclaudio Cunha": "Diego Praxedes"
};

const simpleIds = [
  "sonda", "periodoInicio", "periodoFim", "supervisorSaindo", "supervisorEntrando",
  "desviosRecentes", "cacaDesviosCriticos", "incidentesQuaseAcidentes", "riscosPrincipais", "acoesMitigacao",
  "statusGeralSonda", "topDrive", "bombasLama", "bop", "sistemaSolidos", "geradores", "falhasRestricoes",
  "comportamento", "segurancaEquipe", "treinamento", "trocasEquipe", "climaOperacional",
  "materiaisFalta", "servicosAndamento", "servicosProgramados", "pendenciasLogisticas",
  "colunaLivreTitulo"
];

const countRows = ["Poço", "Torre", "Caixas", "Cavaletes", "Inspecionar", "Reprovados", "Sucata", "Total"];
const countCols = ["drillPipes", "heavyWeight", "dcs634", "dcs8", "livre"];
const countColLabels = {
  drillPipes: "Drill pipes",
  heavyWeight: "Heavy weight",
  dcs634: 'DCs 6 3/4"',
  dcs8: 'DCs 8"',
  livre: "coluna livre"
};

const dynamicLists = {
  manutencoes: { containerId: "manutencoesList", minItems: 1, makeItem: () => ({ texto: "" }) },
  materiaisRecebidos: { containerId: "materiaisRecebidosList", minItems: 1, makeItem: () => ({ data: "", quantidade: "", descricao: "" }) },
  materiaisEnviados: { containerId: "materiaisEnviadosList", minItems: 1, makeItem: () => ({ data: "", quantidade: "", descricao: "" }) },
  solicitacoesMateriais: { containerId: "solicitacoesMateriaisList", minItems: 1, makeItem: () => ({ data: "", quantidade: "", descricao: "" }) },
  servicosPendentes: { containerId: "servicosPendentesList", minItems: 1, makeItem: () => ({ texto: "" }) },
  outrosAssuntos: { containerId: "outrosAssuntosList", minItems: 1, makeItem: () => ({ texto: "" }) }
};

let state = {
  manutencoes: [dynamicLists.manutencoes.makeItem()],
  materiaisRecebidos: [dynamicLists.materiaisRecebidos.makeItem()],
  materiaisEnviados: [dynamicLists.materiaisEnviados.makeItem()],
  solicitacoesMateriais: [dynamicLists.solicitacoesMateriais.makeItem()],
  servicosPendentes: [dynamicLists.servicosPendentes.makeItem()],
  outrosAssuntos: [dynamicLists.outrosAssuntos.makeItem()],
  countTable: makeEmptyCountTable()
};

const form = document.getElementById("handoverForm");
const previewText = document.getElementById("previewText");
const copyStatus = document.getElementById("copyStatus");
const draftStatus = document.getElementById("draftStatus");

let syncingSupervisor = false;
let renderingLists = false;
let saveTimer = null;

function el(id) { return document.getElementById(id); }
function val(id) { return (el(id)?.value || "").trim(); }
function fallback(value, placeholder = "-") { return value && value.length ? value : placeholder; }

function makeEmptyCountTable() {
  const table = {};
  countRows.forEach(row => {
    table[row] = {};
    countCols.forEach(col => table[row][col] = "");
  });
  return table;
}

function counterpart(name) {
  if (!name) return "";
  return BACK_TO_BACK[name] || "";
}

function syncSupervisor(sourceId) {
  if (syncingSupervisor) return;
  syncingSupervisor = true;
  const targetId = sourceId === "supervisorSaindo" ? "supervisorEntrando" : "supervisorSaindo";
  el(targetId).value = counterpart(el(sourceId).value);
  syncingSupervisor = false;
}

function formatDate(raw) {
  if (!raw) return "-";
  const [year, month, day] = raw.split("-");
  if (!year || !month || !day) return raw;
  return `${day}/${month}/${year}`;
}

function slugDate() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const mi = String(d.getMinutes()).padStart(2, "0");
  return `${yyyy}${mm}${dd}_${hh}${mi}`;
}

function getSimpleState() {
  return Object.fromEntries(simpleIds.map(id => [id, el(id).value]));
}

function getHeaderState() {
  const headerIds = simpleIds.filter(id => el(id).hasAttribute("data-header"));
  return Object.fromEntries(headerIds.map(id => [id, el(id).value]));
}

function getState() {
  return {
    ...getSimpleState(),
    manutencoes: state.manutencoes,
    materiaisRecebidos: state.materiaisRecebidos,
    materiaisEnviados: state.materiaisEnviados,
    solicitacoesMateriais: state.solicitacoesMateriais,
    servicosPendentes: state.servicosPendentes,
    outrosAssuntos: state.outrosAssuntos,
    countTable: state.countTable
  };
}

function setSimpleState(savedState) {
  simpleIds.forEach(id => {
    if (savedState && Object.prototype.hasOwnProperty.call(savedState, id) && el(id)) {
      el(id).value = savedState[id] ?? "";
    }
  });
  if (val("supervisorSaindo") && !val("supervisorEntrando")) syncSupervisor("supervisorSaindo");
  if (val("supervisorEntrando") && !val("supervisorSaindo")) syncSupervisor("supervisorEntrando");
}

function normalizedList(listName, savedItems) {
  const config = dynamicLists[listName];
  const items = Array.isArray(savedItems) ? savedItems : [];
  const clean = items.map(item => ({ ...config.makeItem(), ...item }));
  while (clean.length < config.minItems) clean.push(config.makeItem());
  return clean;
}

function normalizedCountTable(saved) {
  const base = makeEmptyCountTable();
  if (!saved || typeof saved !== "object") return base;
  countRows.forEach(row => {
    countCols.forEach(col => {
      base[row][col] = saved?.[row]?.[col] ?? "";
    });
  });
  return base;
}

function setState(savedState) {
  setSimpleState(savedState || {});
  Object.keys(dynamicLists).forEach(listName => {
    state[listName] = normalizedList(listName, savedState?.[listName]);
  });
  state.countTable = normalizedCountTable(savedState?.countTable);
  renderAllDynamic();
}

function saveState(manual = false) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(getState()));
  localStorage.setItem(HEADER_KEY, JSON.stringify(getHeaderState()));
  setDraftStatus(manual ? "Rascunho salvo manualmente." : "Rascunho salvo automaticamente.");
}

function scheduleSave() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => saveState(false), 250);
}

function loadState() {
  const saved = localStorage.getItem(STORAGE_KEY);
  const header = localStorage.getItem(HEADER_KEY);
  if (saved) {
    try {
      setState(JSON.parse(saved));
      setDraftStatus("Rascunho carregado do navegador.");
      return;
    } catch (e) {}
  }
  if (header) {
    try { setSimpleState(JSON.parse(header)); } catch (e) {}
  }
  renderAllDynamic();
  setDraftStatus("Novo rascunho iniciado.");
}

function setDraftStatus(message) {
  if (!draftStatus) return;
  draftStatus.textContent = message;
}

function escapeHtml(text) {
  return String(text)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function line(label, value) {
  return `${label}: ${fallback(value)}`;
}

function bulletLines(items, formatter) {
  const lines = items
    .map(formatter)
    .map(text => text.trim())
    .filter(Boolean)
    .map(text => `• ${text}`);
  return lines.length ? lines.join("\n") : "• -";
}

function indentedBulletLines(entries) {
  const lines = entries
    .map(([label, value]) => `  - ${label}: ${fallback(value)}`);
  return lines.join("\n");
}

function renderTextItem(listName, item, index, placeholder) {
  const canRemove = state[listName].length > dynamicLists[listName].minItems;
  return `
    <div class="item-row" data-list="${listName}" data-index="${index}">
      <span class="item-bullet">•</span>
      <textarea data-field="texto" placeholder="${placeholder}">${escapeHtml(item.texto || "")}</textarea>
      <button class="btn small item-remove" type="button" ${canRemove ? "" : "disabled"}>Remover</button>
    </div>
  `;
}

function renderMaterialItem(listName, item, index) {
  const canRemove = state[listName].length > dynamicLists[listName].minItems;
  return `
    <div class="material-row" data-list="${listName}" data-index="${index}">
      <label>Data
        <input data-field="data" type="date" value="${escapeHtml(item.data || "")}" />
      </label>
      <label>Quantidade
        <input data-field="quantidade" type="text" placeholder="Ex: 20 jts" value="${escapeHtml(item.quantidade || "")}" />
      </label>
      <label>Descrição
        <input data-field="descricao" type="text" placeholder="Descrição do material" value="${escapeHtml(item.descricao || "")}" />
      </label>
      <button class="btn small item-remove" type="button" ${canRemove ? "" : "disabled"}>Remover</button>
    </div>
  `;
}

function renderDynamicLists() {
  renderingLists = true;

  el("manutencoesList").innerHTML = state.manutencoes
    .map((item, index) => renderTextItem("manutencoes", item, index, "Manutenção programada, data prevista e observação"))
    .join("");

  el("materiaisRecebidosList").innerHTML = state.materiaisRecebidos
    .map((item, index) => renderMaterialItem("materiaisRecebidos", item, index))
    .join("");

  el("materiaisEnviadosList").innerHTML = state.materiaisEnviados
    .map((item, index) => renderMaterialItem("materiaisEnviados", item, index))
    .join("");

  el("solicitacoesMateriaisList").innerHTML = state.solicitacoesMateriais
    .map((item, index) => renderMaterialItem("solicitacoesMateriais", item, index))
    .join("");

  el("servicosPendentesList").innerHTML = state.servicosPendentes
    .map((item, index) => renderTextItem("servicosPendentes", item, index, "Serviço pendente na sonda, manutenção operacional, solda, etc."))
    .join("");

  el("outrosAssuntosList").innerHTML = state.outrosAssuntos
    .map((item, index) => renderTextItem("outrosAssuntos", item, index, "Informação relevante não coberta acima"))
    .join("");

  renderingLists = false;
}

function renderCountTable() {
  const tbody = el("countTableBody");
  tbody.innerHTML = countRows.map(row => `
    <tr data-row="${row}">
      <td>${row}</td>
      ${countCols.map(col => `
        <td><input data-count-row="${row}" data-count-col="${col}" type="text" value="${escapeHtml(state.countTable[row]?.[col] || "")}" /></td>
      `).join("")}
    </tr>
  `).join("");
}

function renderAllDynamic() {
  renderDynamicLists();
  renderCountTable();
  updatePreview(false);
}

function addListItem(listName) {
  state[listName].push(dynamicLists[listName].makeItem());
  renderDynamicLists();
  updatePreview();
}

function removeListItem(listName, index) {
  if (state[listName].length <= dynamicLists[listName].minItems) return;
  state[listName].splice(index, 1);
  renderDynamicLists();
  updatePreview();
}

function updateListItem(target) {
  const row = target.closest("[data-list]");
  if (!row) return;
  const listName = row.dataset.list;
  const index = Number(row.dataset.index);
  const field = target.dataset.field;
  if (!Number.isInteger(index) || !field || !state[listName]?.[index]) return;
  state[listName][index][field] = target.value;
}

function updateCountItem(target) {
  const row = target.dataset.countRow;
  const col = target.dataset.countCol;
  if (!row || !col) return;
  if (!state.countTable[row]) state.countTable[row] = {};
  state.countTable[row][col] = target.value;
}

function materialOutputLine(item) {
  const date = formatDate(item.data || "");
  const qty = (item.quantidade || "").trim();
  const desc = (item.descricao || "").trim();
  if (!item.data && !qty && !desc) return "";
  return `${date} | ${fallback(qty)} | ${fallback(desc)}`;
}

function textItemLine(item) {
  return (item.texto || "").trim();
}

function buildCountOutput() {
  const livreLabel = fallback(val("colunaLivreTitulo"), countColLabels.livre);
  const labels = { ...countColLabels, livre: livreLabel };
  const lines = [];

  countRows.forEach(row => {
    const filled = countCols
      .map(col => [labels[col], (state.countTable[row]?.[col] || "").trim()])
      .filter(([, value]) => value);
    if (filled.length) {
      lines.push(`• ${row}: ${filled.map(([label, value]) => `${label}: ${value}`).join(" | ")}`);
    }
  });

  return lines.length ? lines.join("\n") : "• -";
}

function buildOutput() {
  const periodo = `${formatDate(val("periodoInicio"))} a ${formatDate(val("periodoFim"))}`;

  return [
    "*PASSAGEM DE SERVIÇO - SUPERVISÃO DE SONDA*",
    "",
    `Sonda: ${fallback(val("sonda"))} | Período: ${periodo}`,
    `Handover: ${fallback(val("supervisorSaindo"))} > ${fallback(val("supervisorEntrando"))}`,
    "",
    "*1. Segurança*",
    `• ${line("Desvios recentes (últimos 7 dias)", val("desviosRecentes"))}`,
    `• ${line("Caça-desvios críticos em aberto", val("cacaDesviosCriticos"))}`,
    `• ${line("Incidentes / quase-acidentes", val("incidentesQuaseAcidentes"))}`,
    `• ${line("Riscos principais atuais da operação", val("riscosPrincipais"))}`,
    `• ${line("Ações de mitigação implementadas", val("acoesMitigacao"))}`,
    "",
    "*2. Equipamentos da Sonda*",
    `• ${line("Status geral da sonda", val("statusGeralSonda"))}`,
    "• Equipamentos críticos:",
    indentedBulletLines([
      ["Top Drive", val("topDrive")],
      ["Bombas de lama", val("bombasLama")],
      ["BOP", val("bop")],
      ["Sistema de sólidos", val("sistemaSolidos")],
      ["Geradores", val("geradores")]
    ]),
    `• ${line("Falhas ou restrições em andamento", val("falhasRestricoes"))}`,
    "• Manutenções programadas (próximos dias):",
    bulletLines(state.manutencoes, textItemLine),
    "",
    "*3. Pessoas e Liderança*",
    "• Pontos de atenção com equipe (acompanhamento PRONTOS):",
    indentedBulletLines([
      ["Comportamento", val("comportamento")],
      ["Segurança", val("segurancaEquipe")],
      ["Treinamento", val("treinamento")]
    ]),
    `• ${line("Trocas de equipe previstas", val("trocasEquipe"))}`,
    `• ${line("Clima operacional (avaliação do supervisor)", val("climaOperacional"))}`,
    "",
    "*4. Logística e Materiais*",
    `• ${line("Materiais críticos em falta ou próximos do limite", val("materiaisFalta"))}`,
    `• ${line("Serviços em andamento", val("servicosAndamento"))}`,
    `• ${line("Serviços programados", val("servicosProgramados"))}`,
    `• ${line("Pendências logísticas", val("pendenciasLogisticas"))}`,
    "",
    "*4.1 Materiais Recebidos*",
    bulletLines(state.materiaisRecebidos, materialOutputLine),
    "",
    "*4.2 Materiais Enviados*",
    bulletLines(state.materiaisEnviados, materialOutputLine),
    "",
    "*4.3 Solicitação de Materiais*",
    bulletLines(state.solicitacoesMateriais, materialOutputLine),
    "",
    "*5. Serviços Pendentes*",
    bulletLines(state.servicosPendentes, textItemLine),
    "",
    "*6. Contagem de Coluna da Sonda*",
    buildCountOutput(),
    "",
    "*7. Outros Assuntos Relevantes*",
    bulletLines(state.outrosAssuntos, textItemLine)
  ].join("\n");
}

function updatePreview(shouldSave = true) {
  previewText.textContent = buildOutput();
  copyStatus.textContent = "";
  if (shouldSave) scheduleSave();
}

function buildTeamsPlainText() {
  return buildOutput().replace(/^\*(.+)\*$/gm, "$1");
}

function buildTeamsHtml() {
  const lines = buildOutput().split("\n");
  const htmlLines = lines.map(rawLine => {
    const lineText = rawLine.replace(/^\*(.+)\*$/, "$1");
    const escaped = escapeHtml(lineText);

    if (!rawLine.trim()) return "<br>";
    if (/^\*.+\*$/.test(rawLine.trim())) {
      return `<div><strong>${escaped}</strong></div>`;
    }
    return `<div>${escaped}</div>`;
  });

  return `<!doctype html><html><body>${htmlLines.join("")}</body></html>`;
}

async function writePlainTextToClipboard(text) {
  try {
    await navigator.clipboard.writeText(text);
  } catch (error) {
    const temp = document.createElement("textarea");
    temp.value = text;
    temp.style.position = "fixed";
    temp.style.left = "-9999px";
    document.body.appendChild(temp);
    temp.focus();
    temp.select();
    document.execCommand("copy");
    document.body.removeChild(temp);
  }
}

async function copyText(openWhatsapp = false) {
  const text = buildOutput();
  try {
    await writePlainTextToClipboard(text);
    copyStatus.textContent = openWhatsapp ? "Texto copiado. Abrindo WhatsApp..." : "Texto copiado.";
    if (openWhatsapp) window.open("https://web.whatsapp.com/", "_blank", "noopener,noreferrer");
  } catch (error) {
    copyStatus.textContent = "Não consegui copiar automaticamente. Selecione o texto do preview e copie manualmente.";
  }
}

async function copyTeamsText() {
  const html = buildTeamsHtml();
  const plainText = buildTeamsPlainText();

  try {
    if (window.ClipboardItem && navigator.clipboard?.write) {
      await navigator.clipboard.write([
        new ClipboardItem({
          "text/html": new Blob([html], { type: "text/html" }),
          "text/plain": new Blob([plainText], { type: "text/plain" })
        })
      ]);
    } else {
      await writePlainTextToClipboard(plainText);
    }
    copyStatus.textContent = "Texto copiado para Teams com negrito.";
  } catch (error) {
    await writePlainTextToClipboard(plainText);
    copyStatus.textContent = "Texto copiado para Teams sem asteriscos. Se o negrito não vier, cole no Teams e ajuste os títulos.";
  }
}

function clearHeader() {
  simpleIds.filter(id => el(id).hasAttribute("data-header")).forEach(id => el(id).value = "");
  updatePreview();
}

function clearData() {
  simpleIds.filter(id => !el(id).hasAttribute("data-header")).forEach(id => el(id).value = "");
  Object.keys(dynamicLists).forEach(listName => {
    state[listName] = [];
    while (state[listName].length < dynamicLists[listName].minItems) {
      state[listName].push(dynamicLists[listName].makeItem());
    }
  });
  state.countTable = makeEmptyCountTable();
  renderAllDynamic();
  updatePreview();
}

function clearAll() {
  const ok = confirm("Limpar tudo e apagar o rascunho salvo neste navegador?");
  if (!ok) return;
  localStorage.removeItem(STORAGE_KEY);
  localStorage.removeItem(HEADER_KEY);
  simpleIds.forEach(id => el(id).value = "");
  clearData();
  setDraftStatus("Rascunho apagado.");
}

function exportDraft() {
  const payload = {
    app: "passagem_servico_supervisao_sonda",
    version: 1,
    exportedAt: new Date().toISOString(),
    data: getState(),
    outputText: buildOutput()
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `passagem_servico_supervisao_${slugDate()}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  setDraftStatus("Rascunho exportado em JSON.");
}

async function importDraftFile(file) {
  if (!file) return;
  try {
    const text = await file.text();
    const imported = JSON.parse(text);
    const data = imported?.data || imported;
    if (!data || typeof data !== "object") throw new Error("Formato inválido");
    setState(data);
    saveState(true);
    updatePreview(false);
    setDraftStatus("Rascunho importado com sucesso.");
  } catch (error) {
    alert("Erro ao importar rascunho. Verifique se o arquivo é um JSON válido exportado por este formulário.");
  } finally {
    el("importDraftInput").value = "";
  }
}

form.addEventListener("input", event => {
  if (renderingLists) return;
  const target = event.target;
  if (target.dataset.field) updateListItem(target);
  if (target.dataset.countRow) updateCountItem(target);
  updatePreview();
});

form.addEventListener("change", event => {
  const target = event.target;
  if (target.id === "supervisorSaindo") syncSupervisor("supervisorSaindo");
  if (target.id === "supervisorEntrando") syncSupervisor("supervisorEntrando");
  if (target.dataset.field) updateListItem(target);
  if (target.dataset.countRow) updateCountItem(target);
  updatePreview();
});

form.addEventListener("click", event => {
  const removeBtn = event.target.closest(".item-remove");
  if (!removeBtn) return;
  const row = removeBtn.closest("[data-list]");
  if (!row) return;
  removeListItem(row.dataset.list, Number(row.dataset.index));
});

el("addManutencaoBtn").addEventListener("click", () => addListItem("manutencoes"));
el("addMaterialRecebidoBtn").addEventListener("click", () => addListItem("materiaisRecebidos"));
el("addMaterialEnviadoBtn").addEventListener("click", () => addListItem("materiaisEnviados"));
el("addSolicitacaoMaterialBtn").addEventListener("click", () => addListItem("solicitacoesMateriais"));
el("addServicoPendenteBtn").addEventListener("click", () => addListItem("servicosPendentes"));
el("addOutroAssuntoBtn").addEventListener("click", () => addListItem("outrosAssuntos"));

el("copyBtn").addEventListener("click", () => copyText(false));
el("copyTeamsBtn").addEventListener("click", copyTeamsText);
el("copyWhatsappBtn").addEventListener("click", () => copyText(true));
el("saveDraftBtn").addEventListener("click", () => saveState(true));
el("exportDraftBtn").addEventListener("click", exportDraft);
el("importDraftBtn").addEventListener("click", () => el("importDraftInput").click());
el("importDraftInput").addEventListener("change", event => importDraftFile(event.target.files[0]));
el("clearHeaderBtn").addEventListener("click", clearHeader);
el("clearDataBtn").addEventListener("click", clearData);
el("clearAllBtn").addEventListener("click", clearAll);

loadState();
updatePreview(false);
