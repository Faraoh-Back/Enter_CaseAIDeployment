import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';

// Localiza somente os insumos; interpretação de produção será feita no grafo.
export async function inputDirectory(dir = 'case') {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const candidate = path.join(dir, entry.name);
    if (entry.name === 'Input') return candidate;
    const nested = await inputDirectory(candidate);
    if (nested) return nested;
  }
  return null;
}

// Uso exclusivo na preparação de fixtures/testes. Nunca executa o pipeline de análise.
export async function sentencesForFixtures() {
  const dir = await inputDirectory();
  if (!dir) throw new Error('Input do case não encontrado');
  const raw = await readFile(path.join(dir, 'processos.txt'), 'utf8');
  const pieces = raw.split(/={20,}\r?\nProcesso nº ([\d.\-]+)\r?\n={20,}\r?\n/);
  const sentences = [];
  for (let i = 1; i < pieces.length; i += 2) sentences.push({ numero: pieces[i], texto: `Processo nº ${pieces[i]}\n${pieces[i + 1].trim()}` });
  return { dir, raw, sentences };
}
