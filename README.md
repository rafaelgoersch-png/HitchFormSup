# HitchFormSup

Formulário estático de passagem de serviço para supervisão de sonda. Preencha o
handover e use **Revisar e exportar** para chegar à prévia. **Copiar texto** mantém
as marcações do WhatsApp, **Copiar para Teams** tenta preservar o negrito e
**Abrir WhatsApp** preenche a mensagem sem enviá-la. Se a abertura não funcionar
ou a mensagem for longa demais para o aplicativo, copie e cole manualmente.

Na contagem, deslize a tabela para ver todas as ferramentas. O rótulo da linha
fica visível. Só valores preenchidos entram no texto, inclusive zero e
observações. Se não houver contagem, a seção não sai no texto. O Total é manual.
Rascunhos existentes no navegador e em JSON continuam utilizáveis.

Teste local: `python3 tests/run_browser_checks.py` (Git e Chromium), com dados
fictícios e sem acessar WhatsApp/Teams.
