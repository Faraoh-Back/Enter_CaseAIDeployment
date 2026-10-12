"""Oráculo independente: Fraction e floor, sem importar código de produção."""
from fractions import Fraction
from math import floor
from pathlib import Path
import json

def round_half_up(v):
    return (1 if v >= 0 else -1) * floor(abs(v) + Fraction(1, 2))

vectors = [
    ('principal abaixo de meio centavo',1,10000,14999,0,100,0),
    ('principal exatamente em meio centavo',1,10000,15000,0,100,0),
    ('principal acima de meio centavo',1,10000,15001,0,100,0),
    ('sem arredondamento intermediário',1,10000,14900,1,100,0),
    ('benefício positivo residual',11,1,1,0,10,1),
    ('benefício negativo residual',9,1,1,0,10,1),
    ('benefício exatamente zero',10,1,1,0,10,1),
    ('benefício em meio centavo positivo',1,1,1,0,50,0),
    ('benefício em meio centavo negativo',1,1,1,0,50,1),
    ('índices iguais e probabilidade zero',630000,1,1,3,0,320000),
    ('limite superior inteiro seguro',9007199254740991,1,1,0,100,0),
]
result=[]
for name,c,ib,ir,m,p,k in vectors:
    principal=Fraction(c*ir,ib)
    total=principal*Fraction(100+m,100)
    displayed=round_half_up(total)
    benefit=Fraction(p*displayed,100)-k
    result.append(dict(nome=name,parametros=dict(condenacao_centavos=c,indice_base=str(ib),indice_final=str(ir),meses=m,probabilidade_percentual=p,custo_centavos=k),
        esperado=dict(principal_corrigido_centavos=round_half_up(principal),juros_centavos=displayed-round_half_up(principal),valor_atualizado_centavos=displayed,beneficio_esperado_centavos=round_half_up(benefit),decisao_recurso='recorrer' if benefit>0 else 'nao_recorrer'),
        total_exato=dict(numerador=str(total.numerator),denominador=str(total.denominator)),residual_positivo=benefit>0 and round_half_up(benefit)==0))
Path(__file__).with_name('fronteiras-financeiras.json').write_text(json.dumps(dict(origem='Oráculo Python fractions.Fraction; casos sintéticos, sem conjunto reservado.',casos=result),ensure_ascii=False,indent=2)+'\n')
