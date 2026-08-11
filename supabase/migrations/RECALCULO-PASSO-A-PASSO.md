# Recálculo dos cronogramas pelos modelos das modalidades

Alinha os 66 processos existentes aos ritos definidos nos modelos ativos
(os mesmos que o Simulador de Cronograma usa).

Rode os blocos **na ordem**, no SQL Editor do Supabase. Cada um é
independente e o passo 4 é reversível pelo backup do passo 1.

---

## Passo 1 — Backup (obrigatório)

```sql
create table cronograma_atividades_bkp_20260811 as
select * from cronograma_atividades;

select count(*) as etapas_salvas from cronograma_atividades_bkp_20260811;
```

Guarde esse número. É a sua saída de emergência.

---

## Passo 2 — Fotografia do estado atual

```sql
-- Quantos processos ainda usam cronograma antigo (sem vínculo com modelo)
select m.nome as modalidade,
       count(distinct p.id) filter (where ca.modelo_etapa_id is null) as cronograma_antigo,
       count(distinct p.id)                                           as processos,
       count(*) filter (where ca.data_fim is null)                    as etapas_sem_data
from processos p
join modalidades m on m.id = p.modalidade_id
join cronograma_atividades ca on ca.processo_id = p.id
group by m.nome
order by cronograma_antigo desc;
```

`etapas_sem_data > 0` confirma o bug do marco. `cronograma_antigo > 0`
confirma processos criados antes dos modelos DIOP.

---

## Passo 3 — Aplicar a correção do motor

Cole o conteúdo de `20260811010000_fix_marco_e_recalc_modelos.sql` e execute.

Confira que o marco voltou a ter data:

```sql
-- Pregão começando numa segunda: nenhuma data pode vir nula
select somar_dias_uteis('2026-08-10'::date, 0) as marco,        -- 2026-08-10
       somar_dias_uteis('2026-08-08'::date, 0) as marco_sabado, -- 2026-08-10
       somar_dias_uteis('2026-08-10'::date, 1) as um_dia,       -- 2026-08-10
       somar_dias_uteis('2026-09-01'::date, 5) as com_feriado,  -- 2026-09-08
       somar_dias_uteis(null, 5)               as nulo;         -- null, sem travar
```

---

## Passo 4 — Simular o recálculo (sem gravar)

```sql
begin;
select modalidade, resultado, count(*) as processos,
       sum(etapas_novas) as etapas,
       sum(concluidos_preservados) as concluidas_preservadas,
       sum(em_andamento_preservados) as em_andamento_preservadas
from recalc_cronograma_modelos()
group by modalidade, resultado
order by modalidade;
rollback;
```

**Leia o resultado antes de seguir.** Todos os `resultado` devem ser `OK`.
Se aparecer `ERRO: ...`, pare e me mande a mensagem.

Compare `concluidas_preservadas` com o que existe hoje:

```sql
select count(*) from cronograma_atividades where status = 'concluido';
```

Os números devem ser próximos. Uma queda grande significa que o casamento
por similaridade não reconheceu etapas — nesse caso não aplique.

---

## Passo 5 — Aplicar de verdade

```sql
select * from recalc_cronograma_modelos();
```

Guarde o relatório (é uma linha por processo).

---

## Passo 6 — Conferir

```sql
-- Nenhuma etapa pode ficar sem data
select count(*) as etapas_sem_data from cronograma_atividades where data_fim is null;

-- Todas devem estar vinculadas a um modelo
select count(*) as sem_modelo from cronograma_atividades where modelo_etapa_id is null;

-- Contagem por modalidade deve bater com o simulador
select m.nome as modalidade, count(distinct p.id) as processos,
       round(avg(cnt.etapas)) as etapas_por_processo
from processos p
join modalidades m on m.id = p.modalidade_id
join lateral (select count(*) as etapas from cronograma_atividades
              where processo_id = p.id) cnt on true
group by m.nome order by m.nome;
```

Esperado por processo: Pregão 20, Cotação 17, Credenciamento 15,
Concorrência 23, Dispensa 16, Inexigibilidade 18.

Depois abra dois ou três processos na tela e confira contra o Simulador,
usando a mesma `data_entrada`.

---

## Reverter, se necessário

```sql
begin;
delete from cronograma_atividades;
insert into cronograma_atividades select * from cronograma_atividades_bkp_20260811;
commit;
```

Confirme o total antes do `commit`.

---

## Depois de tudo estável

```sql
drop table cronograma_atividades_bkp_20260811;
```

Não apague antes de alguns dias de uso.

---

## O que o recálculo preserva e o que reescreve

**Preserva** (casando etapa antiga com nova por similaridade de descrição):
status `concluido` / `em_andamento`, responsável, `data_inicio_real`,
`data_fim_real` e observação.

**Reescreve**: descrição, fase, setor, duração e as datas previstas
(`data_inicio` / `data_fim`) — que passam a seguir o modelo da modalidade.

**Atenção**: ajustes manuais de prazo feitos etapa a etapa (com justificativa)
são substituídos pelas durações do modelo. Se algum processo tem prazo
negociado fora do padrão, ele volta ao padrão e precisa ser reajustado à mão.
Vale levantar antes:

```sql
select p.id_processo, ca.descricao, ca.dias_uteis, ca.justificativa_override
from cronograma_atividades ca
join processos p on p.id = ca.processo_id
where ca.overridden = true;
```
