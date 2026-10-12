"""Ferramenta offline de anotação/referência; nunca chamada pelo pipeline.

Usa Fraction (Python stdlib) como oráculo independente do BigInt nos Code Nodes.
Lê os dispositivos para pré-anotar; a revisão documental está registrada no README.
"""
from pathlib import Path
from fractions import Fraction
from datetime import date
import csv
import hashlib
import json
import re

ROOT = Path(__file__).resolve().parents[2]
INPUT = next((ROOT / 'case').rglob('processos.txt')).parent
TARGET = Path(__file__).parent / 'golden'
TARGET.mkdir(exist_ok=True)


def sha(text):
    return hashlib.sha256(text.encode()).hexdigest()


def table(name, delimiter=','):
    return list(csv.DictReader((INPUT / name).open(encoding='utf-8-sig'), delimiter=delimiter))


def round_half_away(value):
    sign = -1 if value < 0 else 1
    value = abs(value)
    quotient, remainder = divmod(value.numerator, value.denominator)
    return sign * (quotient + (2 * remainder >= value.denominator))


subs = {r['numero_processo']: r['status_subsidios'] for r in table('status_subsidios.txt')}
indices = {r['mes_referencia']: Fraction(r['numero_indice']) for r in table('tabela_indices.csv')}
prob = {r['status_subsidios']: int(r['probabilidade_reversao'].rstrip('%')) for r in table('subsidios_probabilidade_reversao.csv', ';')}
costs = {r['codigo_cnj_j_tr']: int(Fraction(r['media_custos_totais']) * 100) for r in table('custo_recurso_por_tribunal.csv', ';')}
months = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro']
raw = (INPUT / 'processos.txt').read_text()
pieces = re.split(r'={20,}\nProcesso nº ([\d.\-]+)\n={20,}\n', raw)
records = []
for number, body in zip(pieces[1::2], pieces[2::2]):
    text = f'Processo nº {number}\n{body.strip()}'
    paragraphs = text.split('\n\n')
    disposition = next(p for p in paragraphs if p.startswith('Ante o exposto'))
    result = next(label for pattern, label in [
        ('JULGO EXTINTO', 'extincao'), ('JULGO IMPROCEDENTE', 'improcedencia'),
        ('JULGO PARCIALMENTE PROCEDENTE', 'parcial_procedencia'), ('JULGO PROCEDENTE', 'procedencia')
    ] if pattern in disposition)
    condemned = result in ('procedencia', 'parcial_procedencia')
    topic = re.search(r'(?:alega|fundada em|imputa à requerida) (.*?)(?:, requerendo|, pleiteando|\.)', text)[1]
    reason = paragraphs[paragraphs.index(disposition) - 1]
    money = {kind: int(whole.replace('.', '')) * 100 + int(cents)
             for whole, cents, kind in re.findall(r'R\$ ([\d.]+),(\d{2}) a título de danos (materiais|morais)', disposition)}
    material, moral = money.get('materiais', 0), money.get('morais', 0)
    base_match = re.search(r'correção monetária pela tabela prática a contar de (\w+) de (\d{4}) \(evento danoso\)', disposition)
    base = f'{base_match[2]}-{months.index(base_match[1]) + 1:02}' if base_match else None
    citation_match = re.search(r'desde a citação \((\d{2})/(\d{2})/(\d{4})\)', disposition)
    citation = f'{citation_match[3]}-{citation_match[2]}-{citation_match[1]}' if citation_match else None
    values = re.search(r'CONDENAR .*?danos (?:morais|materiais)\.', disposition)
    extraction = dict(numero_processo=number,
        classe_processual=re.search(r'Classe: (.+)', text)[1], comarca=re.search(r'COMARCA DE (.+)', text)[1],
        resultado_sentenca=result, danos_materiais_centavos=material, danos_morais_centavos=moral,
        valor_total_explicito_centavos=None, mes_base_correcao=base, data_citacao=citation,
        tema=topic, fundamento_decisao=reason,
        evidencias=dict(identificacao=f'Processo nº {number}', resultado=disposition,
            valores=values[0] if values else None, mes_base_correcao=base_match[0] if base_match else None,
            data_citacao=citation_match[0] if citation_match else None, tema=topic, fundamento_decisao=reason))
    expected = dict(valor_condenacao_centavos=material + moral, status_subsidios=subs[number],
        meses_completos=None, principal_corrigido_centavos=0, juros_centavos=0,
        valor_atualizado_centavos=0, probabilidade_reversao_percentual=prob[subs[number]],
        custo_recurso_centavos=None, beneficio_esperado_centavos=None,
        decisao_recurso='nao_recorrer', motivo_decisao='sem_condenacao', memoria=None)
    if condemned:
        assert base is not None and citation is not None and values is not None
        start, end = date.fromisoformat(citation), date(2026, 5, 31)
        m = 12 * (end.year - start.year) + end.month - start.month - (end.day < start.day)
        principal = Fraction(material + moral) * indices['2026-05'] / indices[base]
        total = principal * Fraction(100 + m, 100)
        v = round_half_away(total)
        cost = costs['.'.join(number.split('.')[2:4])]
        benefit = Fraction(prob[subs[number]] * v, 100) - cost
        expected.update(meses_completos=m, principal_corrigido_centavos=round_half_away(principal),
            juros_centavos=v - round_half_away(principal), valor_atualizado_centavos=v,
            custo_recurso_centavos=cost, beneficio_esperado_centavos=round_half_away(benefit),
            decisao_recurso='recorrer' if benefit > 0 else 'nao_recorrer',
            motivo_decisao='beneficio_positivo' if benefit > 0 else 'beneficio_nao_positivo',
            memoria=dict(total_exato_numerador=str(total.numerator), total_exato_denominador=str(total.denominator),
                beneficio_exato_numerador=str(benefit.numerator), beneficio_exato_denominador=str(benefit.denominator)))
    records.append(dict(numero_processo=number, sentenca=text, sentenca_sha256=sha(text),
        extracao_esperada=extraction, calculo_esperado=expected))


def stratum(r):
    return r['extracao_esperada']['resultado_sentenca'], r['calculo_esperado']['status_subsidios']


def rank(r):
    benefit = r['calculo_esperado']['beneficio_esperado_centavos']
    return (abs(benefit) if benefit is not None else 0, sha(r['numero_processo']))


# 3 de cada resultado por conjunto. Improcedência/ausentes inexiste no lote:
# a vaga é redistribuída a completos, grupo de maior tamanho entre improcedências.
slots = [(outcome, status) for outcome in ['procedencia', 'parcial_procedencia', 'improcedencia', 'extincao']
         for status in (['completos', 'completos', 'essenciais'] if outcome == 'improcedencia' else ['completos', 'essenciais', 'ausentes'])]
used = set()
development, reserved = [], []
anchor = '3871230-78.2024.8.26.0002'
for key in slots:
    candidates = sorted((r for r in records if stratum(r) == key and r['numero_processo'] not in used), key=rank)
    dev = next((r for r in candidates if r['numero_processo'] == anchor), candidates[0])
    used.add(dev['numero_processo'])
    held = next(r for r in candidates if r['numero_processo'] not in used)
    used.add(held['numero_processo'])
    development.append(dev)
    reserved.append(held)

for name, selected in [('desenvolvimento', development), ('reservado', reserved)]:
    assert len(selected) == 12
    assert {r['calculo_esperado']['status_subsidios'] for r in selected} == {'completos', 'essenciais', 'ausentes'}
    condemned = [r for r in selected if r['calculo_esperado']['valor_condenacao_centavos'] > 0]
    assert {r['extracao_esperada']['danos_morais_centavos'] > 0 for r in condemned} == {True, False}
    (TARGET / f'{name}.json').write_text(json.dumps(selected, ensure_ascii=False, indent=2) + '\n')

manifest = dict(versao=1, finalidade='Fixtures de teste e avaliação; não são resultados do pipeline.',
    data_referencia='2026-05-31', metodo='Pré-anotação por redação dos dispositivos; Fraction para cálculo de referência; revisão documental descrita no README.',
    selecao='3 casos por resultado em cada conjunto; cobertura de subsídios existentes; proximidade ao limiar dentro de cada estrato; caso S1 fixo no desenvolvimento; desempate por SHA-256 do CNJ.',
    hashes_insumos={p.name: hashlib.sha256(p.read_bytes()).hexdigest() for p in sorted(INPUT.iterdir()) if p.is_file()},
    hashes_conjuntos={p.name: hashlib.sha256(p.read_bytes()).hexdigest() for p in sorted(TARGET.glob('*.json')) if p.name != 'manifest.json'},
    temas_controlados=sorted({r['extracao_esperada']['tema'] for r in records}),
    estrato_inexistente='improcedencia / ausentes',
    uso_reservado='Não executar nem usar como exemplos de prompt antes da avaliação S3; a leitura para anotação não equivale a avaliação cega independente.')
(TARGET / 'manifest.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + '\n')
print('Gerados 12 gabaritos de desenvolvimento e 12 reservados, disjuntos.')
