/* Synthetic browser checks. Clipboard and external navigation are substituted. */
(async () => {
  const result = { checks: [], outputs: {} };
  const byId = id => document.getElementById(id);
  const output = () => byId('previewText').textContent;
  const assert = (test, label) => {
    if (!test) throw new Error(label);
    result.checks.push(label);
  };
  const settle = async () => { for (let i = 0; i < 15; i++) await Promise.resolve(); };
  const set = (node, value) => {
    node.value = value;
    node.dispatchEvent(new Event(node.tagName === 'SELECT' ? 'change' : 'input', { bubbles: true }));
  };
  const cell = (row, col) => document.querySelector(`[data-count-row="${row}"][data-count-col="${col}"]`);
  const legacyDraft = {
    sonda: 'SONDA TESTE', supervisorSaindo: 'Osmar Silva', periodoInicio: '2026-11-24',
    periodoFim: '2026-11-25', topDrive: 'Operacional', colunaLivreTitulo: 'Ferramenta livre',
    countTable: { 'Poço': { drillPipes: '0', dcs634: '7', dcs8: '3', livre: 'em inspeção' }, 'Caixas': { heavyWeight: '2' } },
    materiaisRecebidos: [{ data: '2026-11-24', quantidade: '0', descricao: 'Item sintético' }]
  };
  const expectedTools = { hw5: 'HW 5"', hw412: 'HW 4.1/2"', hw4: 'HW 4"', dcs614: 'DC 6.1/4"', dcs434: 'DC 4.3/4"' };
  const verifyLink = text => {
    const link = byId('whatsappLink');
    const url = new URL(link.href);
    assert(link.tagName === 'A' && link.target === '_blank' && link.rel.includes('noopener'), 'WhatsApp is a native link with safe target');
    assert(url.origin === 'https://wa.me' && url.searchParams.get('text') === text, 'WhatsApp URL decodes to the exact canonical report');
  };
  const putDraft = async data => {
    const file = new File([JSON.stringify({ data })], 'hitch-sintetico.json', { type: 'application/json' });
    const files = new DataTransfer();
    files.items.add(file);
    const input = byId('importDraftInput');
    const draftStatus = byId('draftStatus');
    draftStatus.textContent = '';
    const imported = new Promise(resolve => {
      const observer = new MutationObserver(() => {
        if (draftStatus.textContent !== 'Rascunho importado com sucesso.') return;
        observer.disconnect();
        resolve();
      });
      observer.observe(draftStatus, { subtree: true, childList: true });
    });
    input.files = files.files;
    input.dispatchEvent(new Event('change', { bubbles: true }));
    await imported;
    assert(!input.value, 'JSON draft imported through the file input');
  };
  async function run() {
    assert(window.__errors.length === 0, 'Page initialized without errors: ' + window.__errors.join('; '));
    if (window.__restore) {
      assert(byId('draftStatus').textContent.includes('carregado do navegador'), 'A new page restores the saved draft on initial load');
      assert(cell('Poço', 'dcs614').value === '0' && cell('Poço', 'hw5').value === 'em uso', 'Explicit zero and note restored to controls');
      assert(cell('Poço', 'dcs8').value === '3' && cell('Poço', 'dcs434').value.trim() === '', 'Legacy DCs 8 and omitted tool preserved after reopen');
      assert(output() === window.__restore.output, 'Full report matches its text before reopening');
      verifyLink(output());
      return;
    }
    result.outputs.empty = output();
    await putDraft(legacyDraft);
    result.outputs.legacy = output();
    if (!window.__baseline) return;
    const oldEmpty = window.__baseline.empty.replace('*6. Contagem de Coluna da Sonda*\n• -\n\n', '');
    assert(result.outputs.empty === oldEmpty, 'Blank report is unchanged apart from its omitted empty count section');
    assert(result.outputs.legacy === window.__baseline.legacy, 'Populated version 1 report with old tools remains byte-identical');
    assert(byId('supervisorEntrando').value === 'Antônio Marcos', 'Paired supervisor from an old draft still resolves');
    const columnNames = [...document.querySelectorAll('#countTableHead th')].map(th => th.textContent);
    for (const [key, label] of Object.entries(expectedTools)) {
      assert(columnNames.filter(n => n === label).length === 1 && !!cell('Poço', key), `One separately editable column: ${label}`);
    }
    assert(columnNames.filter(n => n === 'DCs 8"').length === 1 && !!cell('Poço', 'dcs8'), 'Reuse the existing DC 8-inch column and key');
    assert(columnNames.includes('DCs 6 3/4"') && columnNames.includes('Heavy weight'), 'Keep distinct older tool columns');
    assert(document.querySelectorAll('#countTableBody input').length === 80, 'Eight rows × ten tool fields');
    assert(document.querySelector('a[href="#countSection"]') && document.querySelector('a[href="#reportPreview"]'), 'Quick jumps reach count and preview');
    const table = document.querySelector('.table-wrap');
    const header = table.querySelector('tbody th');
    const left = header.getBoundingClientRect().left;
    table.scrollLeft = 500;
    assert(table.scrollLeft > 0 && Math.abs(header.getBoundingClientRect().left - left) < 2, `Wide table scrolls independently while row header stays visible (${table.scrollLeft}, ${header.getBoundingClientRect().left - left})`);
    assert(document.documentElement.scrollWidth === document.documentElement.clientWidth, `Wide table does not overflow the full page (${document.documentElement.scrollWidth}/${document.documentElement.clientWidth})`);
    const imported = { ...legacyDraft, countTable: { ...legacyDraft.countTable, 'Poço': { ...legacyDraft.countTable['Poço'], dcs614: 0, hw5: '  em uso  ', dcs434: '  ' } } };
    await putDraft(imported);
    assert(cell('Poço', 'dcs614').value === '0', 'A numerical zero from JSON is preserved and shown');
    assert(output().includes('HW 5": em uso') && output().includes('DC 6.1/4": 0'), 'A note and zero serialize as tool values');
    assert(!output().includes('DC 4.3/4"') && !output().includes('HW 4.1/2"'), 'Whitespace and blank tools emit no labels or placeholders');
    set(cell('Torre', 'hw412'), '7');
    set(cell('Caixas', 'hw4'), ' 11 ');
    set(cell('Cavaletes', 'dcs434'), 'reprovado');
    assert(output().includes('• Torre: HW 4.1/2": 7') && output().includes('HW 4": 11') && output().includes('DC 4.3/4": reprovado'), 'All other new tools update from typed input');
    set(cell('Cavaletes', 'dcs434'), '');
    set(cell('Poço', 'hw5'), 'em uso');
    byId('saveDraftBtn').click();
    const state = localStorage.getItem('opsforms_passagem_servico_supervisao_v1');
    result.saved = { state, output: output() };
    assert(JSON.parse(state).countTable['Torre'].hw412 === '7', 'New tools persist under the same draft key');
    const verifySnapshot = output();
    const clipboard = [], popup = [];
    let writeText = async text => { clipboard.push(text); };
    window.open = (...args) => popup.push(args);
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: value => writeText(value) } });
    verifyLink(verifySnapshot);
    const link = byId('whatsappLink');
    link.addEventListener('click', event => event.preventDefault(), { once: true });
    link.click();
    assert(clipboard.length === 0 && popup.length === 0, 'WhatsApp does not copy or launch a scripted popup');
    byId('copyBtn').click(); await settle();
    assert(clipboard.at(-1) === verifySnapshot && popup.length === 0 && byId('copyStatus').textContent === 'Texto copiado.', 'Plain copy preserves every character and launches nothing');
    byId('copyTeamsBtn').click(); await settle();
    assert(clipboard.at(-1) === verifySnapshot.replace(/^\*(.+)\*$/gm, '$1') && byId('copyStatus').textContent.includes('sem formatação'), 'Teams plain fallback does not claim bold');
    const rich = [];
    Object.defineProperty(window, 'ClipboardItem', { configurable: true, value: class { constructor(parts) { this.parts = parts; } } });
    navigator.clipboard.write = async values => { rich.push(values[0].parts); };
    byId('copyTeamsBtn').click(); await settle();
    const html = await rich[0]['text/html'].text();
    assert(html.includes('<strong>6. Contagem de Coluna da Sonda</strong>') && html.includes('DC 6.1/4&quot;: 0') && byId('copyStatus').textContent.includes('com negrito'), 'Teams rich copy keeps titles in bold and escapes tool labels');
    delete navigator.clipboard.write;
    writeText = async () => { throw new Error('clipboard denied'); };
    document.execCommand = () => false;
    byId('copyBtn').click(); await settle();
    assert(!byId('copyBtn').disabled && byId('copyStatus').textContent.includes('não foi possível') && window.getSelection().toString() === verifySnapshot, 'Rejected copy never reports success and selects the complete preview');
    let finish;
    writeText = () => new Promise(resolve => { finish = resolve; });
    byId('copyBtn').click();
    assert(byId('copyTeamsBtn').disabled, 'Both copy buttons avoid concurrent writes');
    set(cell('Poço', 'dcs614'), '4');
    verifyLink(output());
    finish(); await settle();
    assert(byId('copyStatus').textContent.includes('mudou durante a cópia'), 'An edit during copy cannot report success for stale output');
    byId('clearDataBtn').click();
    assert(!output().includes('Contagem de Coluna da Sonda') && cell('Torre', 'hw412').value === '' && byId('sonda').value === 'SONDA TESTE', 'Clear data removes all tool values while preserving header');
    assert(window.__errors.length === 0, 'No page or asynchronous errors');
  }
  try { await run(); result.ok = true; } catch (error) { result.ok = false; result.error = error.stack; }
  const marker = document.createElement('script'); marker.id = 'test-result'; marker.type = 'application/json';
  marker.textContent = JSON.stringify(result); document.body.append(marker);
})();
