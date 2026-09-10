# Proposta: reconciliar Atividade Atual com o cronograma

**Não aplicada.** Este documento descreve o que precisa ser decidido antes de
qualquer escrita. O código já expõe a divergência na tela; o dado continua como
está até alguém com conhecimento do negócio decidir.

Levantamento feito na base de produção em 10/09/2026.

## O que aconteceu

O sistema guarda a etapa do processo em dois lugares:

1. `processos.atividade_atual` — texto, escolhido no formulário
2. a primeira etapa não concluída em `cronograma_atividades`

Na migração para os ritos **DIOP**, os cronogramas foram regenerados — todos os
74 processos batem 100% com o modelo ativo, nenhuma etapa fora. O texto de
`atividade_atual`, porém, ficou com o vocabulário do rito **Padrão** anterior.

| | Processos |
|---|---|
| Texto não existe no rito ativo do próprio processo | 39 |
| Campo vazio | 17 |
| Texto confere com o rito | 18 |

## Por que não dá para corrigir em massa

A tentação é sobrescrever o texto com a etapa que o cronograma aponta. **Isso
perderia informação.** Dos 5 processos em andamento com texto órfão, **4 têm
zero etapas concluídas no cronograma** — ou seja, o cronograma nunca foi
atualizado e aponta a etapa 1, enquanto o texto declara uma fase muito adiante:

| Processo | Modalidade | Texto declara | Cronograma aponta | Etapas concluídas |
|---|---|---|---|---|
| AGSUS.000716/2025-73 | Concorrência | Fase de Julgamento das Propostas | Análise do TR | **0** |
| AGSUS.001860/2026-16 | Pregão Eletrônico | Análise jurídica e Emissão de Parecer | Análise TR/UAC | **0** |
| AGSUS.002950/2026-16 | Credenciamento | Fase de Julgamento das Propostas | Análise do TR e demais documentos (UAC) | **0** |
| AGSUS.015208/2026-71 | Pregão Eletrônico | Análise do Termo de Referência e anexos | Análise TR/UAC | **0** |
| AGSUS.016320/2026-29 | Cotação de Preços | Disponibilidade orçamentária | Elaboração do Relatório de Contratação | 10 |

Nos quatro primeiros **o texto é a fonte confiável e o cronograma é que está
parado**. Sobrescrever diria que uma obra em julgamento de propostas está na
análise inicial do TR.

Só no último o cronograma está sendo mantido, e aí sim o texto é que ficou para
trás.

## O que fazer, por grupo

### Grupo A — 31 processos encerrados (Concluído, Cancelado, Devolvido)

"Atividade atual" não se aplica a processo encerrado. O campo pode ser limpo sem
perda: o status já diz o que aconteceu, e vários textos aqui são o próprio
status disfarçado de etapa ("Concluído", "Fazer relatório final / Concluído",
"Processo Arquivado pela Área Deandante").

Baixo risco. Precisa apenas de confirmação de que o histórico não é consultado
por esse campo.

```sql
-- Revisar antes de executar.
UPDATE processos p
SET atividade_atual = NULL
FROM status_processo s
WHERE s.id = p.status_id
  AND s.nome IN ('Concluído', 'Homologado', 'Cancelado', 'Devolvido')
  AND NULLIF(TRIM(COALESCE(p.atividade_atual, '')), '') IS NOT NULL;
```

### Grupo B — 5 processos em andamento

Um a um, com quem acompanha o processo. Para os quatro com cronograma parado, o
caminho é **avançar o cronograma até a etapa real**, não mexer no texto. A tela
de Cronograma já permite marcar etapas concluídas e reposicionar o rito.

### Grupo C — 3 processos "Não recebido"

Nada começou. Limpar o campo, como no Grupo A.

### Grupo D — 41 cronogramas sem nenhuma etapa concluída

É o problema de fundo: **55% dos cronogramas nunca foram atualizados**, e 9
deles são de processos em andamento. Enquanto isso não mudar, prazo por etapa,
alerta de vencimento e tempo médio por etapa continuam calculados sobre metade
da base.

Não é correção de dado, é rotina de trabalho. O dashboard passou a expor a
contagem para que pare de ser invisível.

## Modelo duplicado

`Cronograma Padrão Cotação de Preços` existe duas vezes (9 e 19 etapas), ambas
sem processos usando. O seletor pega `ativo = true` ordenado por `created_at
DESC` com `limit 1` — funciona hoje, mas fica imprevisível se o `ativo` mudar.

```sql
-- Revisar antes de executar: confirmar que nenhum processo usa o modelo.
-- DELETE FROM modelo_cronograma WHERE id = '<id do duplicado sem uso>';
-- CREATE UNIQUE INDEX modelo_cronograma_nome_modalidade_uk
--   ON modelo_cronograma (modalidade_id, nome);
```

O índice único só pode ser criado depois de remover a duplicata.
