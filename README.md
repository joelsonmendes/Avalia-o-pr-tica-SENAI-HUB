# AvaliaPrática SENAI — Instalações Elétricas Prediais

Ferramenta em HTML, CSS e JavaScript puro para condução das aulas práticas e avaliação individual dos alunos.

## Principais funções

- Cadastro de alunos individual ou em lote.
- Roteiro detalhado das Aulas 2 a 20.
- Modo docente com respostas esperadas usando PIN `2026`.
- Avaliação individual por critérios de 0 a 2 pontos.
- Nota automática de 0 a 10 por aluno e por aula.
- Registro de presença, observações e evidências.
- Relatório por aluno, média da turma e progresso por atividade.
- Exportação em CSV.
- Backup e restauração em JSON.
- PWA offline com `manifest.json` e `service-worker.js`.

## Como usar localmente

1. Abra o arquivo `index.html` no navegador.
2. Cadastre a turma na aba **Alunos**.
3. Consulte o roteiro na aba **Atividades**.
4. Lance as notas na aba **Avaliação**.
5. Exporte relatórios na aba **Relatórios**.
6. Faça backup dos dados na aba **Backup**.

## Como publicar

Pode ser publicado no GitHub Pages, Vercel ou Netlify. A pasta deve manter estes arquivos na raiz:

- `index.html`
- `styles.css`
- `data.js`
- `app.js`
- `manifest.json`
- `service-worker.js`
- `assets/`

## Observação importante

Os dados são salvos no navegador do usuário por LocalStorage. Para evitar perda de registros, exporte o backup JSON ao final de cada dia de aula.
