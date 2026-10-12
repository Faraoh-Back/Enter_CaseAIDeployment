import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { sentencesForFixtures } from './case-files.mjs';

// Preparação do caso de desenvolvimento para build/avaliação. Não calcula nem analisa.
export async function entradasS1() {
  const numero = '3871230-78.2024.8.26.0002';
  const { dir, raw } = await sentencesForFixtures();
  const headers = [...raw.matchAll(/={20,}\r?\nProcesso nº ([\d.\-]+)\r?\n={20,}\r?\n/g)];
  const index = headers.findIndex(m => m[1] === numero);
  if (index < 0) throw new Error('Fixture S1 ausente nos originais');
  const subsidios = (await readFile(path.join(dir, 'status_subsidios.txt'), 'utf8')).trim().split(/\r?\n/);
  const rows = subsidios.slice(1).filter(line => line.split(',')[0] === numero);
  if (rows.length !== 1) throw new Error('Fixture de subsídio S1 ausente ou duplicada');
  return {
    processos_texto: raw.slice(headers[index].index, headers[index + 1]?.index ?? raw.length),
    subsidios_texto: `${subsidios[0]}\n${rows[0]}\n`,
    indices_texto: await readFile(path.join(dir, 'tabela_indices.csv'), 'utf8'),
    custos_texto: await readFile(path.join(dir, 'custo_recurso_por_tribunal.csv'), 'utf8'),
    probabilidades_texto: await readFile(path.join(dir, 'subsidios_probabilidade_reversao.csv'), 'utf8'),
    data_referencia: '2026-05-31',
  };
}
