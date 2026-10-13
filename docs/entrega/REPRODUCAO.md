# Entrega e reprodução

Separei a preparação verificável dos arquivos do envio. Ainda vou concluir S5.4 (ZIP), S5.6 (reprodução do ZIP extraído) e S5.7 (demonstração final no aplicativo), registrando os resultados antes de marcar essas tarefas.

## S5.4 — montar o ZIP

1. Confiro a versão final do PDF. A prévia tipográfica não serve para a entrega. Para gerar a versão com a fonte solicitada, uso Linux com Chromium e Fontconfig instalados e o arquivo legítimo da Times New Roman:

   ```bash
   export REPORT_FONT='/caminho/Times New Roman.ttf'
   npm run render
   ```

   O comando informa uma pasta em `outputs/s5-relatorio/`. Confiro o PDF nela; o manifesto deve indicar `familia: Times New Roman` e `previa: false`. O script verifica os hashes dos outputs antes de renderizar e não chama a LLM. A fonte fica incorporada ao PDF; não redistribuo o arquivo TTF sem conferir sua licença.

2. Preparo somente a lista de arquivos revisada, trocando o caminho pelo PDF gerado:

   ```bash
   npm run entrega:preparar -- --pdf outputs/s5-relatorio/<pasta>/relatorio.pdf
   ```

   O comando informa o diretório `deliverables/enter-case-<id>`. Confere a lista positiva, credenciais, symlinks, hashes de cópia e origem do PDF. Na cópia entregue, normaliza a lista para os caminhos do próprio pacote, incluindo `case/Input/`; registra o hash de origem e o hash da lista portátil. Não cria ZIP. Inclui projeto completo, cinco inputs, fontes, plugin, schemas, dependências fixadas, testes, evidências e entregáveis. Não inclui `.env`, `.git`, `node_modules` nem execuções temporárias.

3. Entro no diretório informado e crio o ZIP fora dele:

   ```bash
   cd deliverables/enter-case-<id>
   zip -r ../Enter_CaseAIDeployment.zip .
   unzip -l ../Enter_CaseAIDeployment.zip
   ```

   Confiro na raiz `projeto.rivet-project`, `processos.xlsx`, `relatorio.pdf`, `racional.md`, `README.md` e `entrega-manifest.json`, além de `case/Input/` e dos arquivos de reprodução. Se alterar qualquer fonte ou entregável, preparo outra pasta e outro ZIP; não adiciono arquivos avulsos ao pacote já conferido.

## S5.6 — reproduzir depois de extrair

Faço esta prova a partir do ZIP, sem recorrer ao diretório original:

```bash
mkdir -p /tmp/enter-case-reproducao
unzip deliverables/Enter_CaseAIDeployment.zip -d /tmp/enter-case-reproducao
cd /tmp/enter-case-reproducao
nvm use
npm ci --ignore-scripts --no-audit --no-fund
```

Confiro o manifesto das cópias antes de executar:

```bash
node --input-type=module <<'JS'
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const m=JSON.parse(await readFile('entrega-manifest.json'));
for(const a of m.arquivos){
  const actual=createHash('sha256').update(await readFile(a.destino)).digest('hex');
  if(actual!==a.sha256)throw new Error(`Hash divergente: ${a.destino}`);
}
console.log(`${m.arquivos.length} arquivos íntegros`);
JS
```

Para a suíte completa, preciso também de Chromium, Fontconfig e Poppler (`pdftotext` e `pdffonts`); os testes de PDF usam Liberation Serif como fonte controlada de teste, explicitamente em modo prévia. No Linux desta implementação ela está em `/usr/share/fonts/truetype/liberation2/LiberationSerif-Regular.ttf`. A versão final exige Times New Roman por `REPORT_FONT`. São requisitos do renderizador; o grafo Rivet não depende deles.

```bash
npm test
npm run s4:check
```

Espero suíte sem falhas e curl com 100 aptos, zero novas chamadas à LLM e os mesmos totais da execução real. Abro `processos.xlsx` e `relatorio.pdf`: quatro abas, 100 linhas, 48 vitórias, 52 condenações, R$ 309.174,54 de passivo, 17 recursos, R$ 54.400,00 de custo e R$ 24.676,16 de benefício esperado.

Para uma nova execução paga, configuro uma credencial no ambiente da máquina extraída e uso:

```bash
export OPENAI_API_KEY='<credencial_local>'
node scripts/executar-carteira.mjs --real
```

Não é necessário refazer a execução paga para provar os hashes ou a reprodução offline. Se optar por ela, registro o novo manifesto e as novas métricas, sem substituir a execução original. Para gerar PDF junto da execução, acrescento `--pdf` e configuro `REPORT_FONT`; CLI e servidor verificam os requisitos do PDF antes de iniciar a análise. Na API, uso `node scripts/servidor.mjs --real --pdf`; o download final inclui `relatorio.pdf`.

Registro: pasta extraída, versão Node, resultado da suíte, diretório do curl, hashes e conferência dos entregáveis. Só então marco S5.6.

## S5.7 — demonstrar no aplicativo Rivet

1. Uso Rivet 1.11.3, versão já conferida. Atualizo o plugin local copiando `index.js` e `package.json` de `rivet/plugins/enter-bounded-extraction/` para a instalação existente. No Linux, meu caminho é `~/.local/share/com.ironcladapp.rivet/plugins/enter-bounded-extraction-latest/package/`.
2. Em instalação nova, primeiro crio a pasta `enter-bounded-extraction-latest/package` no diretório indicado em Plugins, copio os dois arquivos e inicializo o pacote local com `git -C <pasta_do_plugin> init`. Só depois uso Add NPM Plugin com `enter-bounded-extraction`, deixando Version vazio; o pacote é local e não foi publicado no npm. Esse é um repositório do plugin local, separado do case. Reinicio o Rivet e confiro o nó `Extração limitada`. O procedimento já foi validado nesta máquina e está detalhado em [S2.4](../validacao/S2_4_VALIDACAO.md).
3. Abro `projeto.rivet-project`. Mostro `analisar_lote`, a preparação global e o nó sequencial que chama a análise individual. Mostro `s1_extracao` (prompt, schema e extração limitada), `s1_validacao` (evidências), `s1_financeiro` (Code Node com frações e decisão) e `s2_consolidacao_lote` (identidades, resumo e relatório).
4. Para demonstrar sem novas chamadas, abro `docs/output/s5/aceite-consolidacao.rivet-project` e executo somente `s2_consolidacao_lote`. Confiro os quatro Graph Outputs: 100 processos, 100 auditorias, resumo com os totais acima e texto executivo com conclusões.
5. Se demonstrar extração ao vivo, configuro a chave no próprio Rivet e executo a análise individual primeiro. O processo `3871230-78.2024.8.26.0002` deve retornar 3 meses completos, atualizado de R$ 6.673,14 e `nao_recorrer` com subsídios ausentes. Executar `analisar_lote` faz novas chamadas para toda a carteira.

O painel mostra outputs; não cria XLSX/PDF no disco. A CLI/API materializa os arquivos a partir desses outputs. Na defesa, explico onde cada regra reside e acompanho um valor do relatório até a sentença, a evidência, a fração e a linha da planilha. Registro versão do aplicativo e resultado desta demonstração para encerrar S5.7.
