-- AeroControl — estrutura do banco (Supabase).
-- Rodar UMA vez no SQL Editor do projeto. Pode rodar de novo sem perder dados.
-- No fim do arquivo, troque os e-mails de quem pode entrar no sistema.

-- ============ quem pode entrar ============
create table if not exists autorizados (
  email text primary key check (email = lower(email)),
  nome text,
  criado_em timestamptz not null default now()
);
alter table autorizados enable row level security;  -- sem política: o site não lê nem altera esta lista

create or replace function eh_autorizado() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from autorizados where email = lower(coalesce(auth.jwt() ->> 'email', '')));
$$;

-- ============ tabelas ============
create table if not exists config (
  id int primary key default 1 check (id = 1),
  alerta_dias int not null default 30,
  alerta_horas numeric not null default 25
);
insert into config (id) values (1) on conflict do nothing;

create table if not exists aeronaves (
  id text primary key default gen_random_uuid()::text,
  matricula text not null,
  fabricante text, modelo text, sn text, ano int,
  tsn numeric not null default 0, tso numeric, posicao_data date, util_mensal numeric, ciclos int,
  manual_ref text, manual_rev date, origem text,
  mapas jsonb not null default '[]',
  criado_em timestamptz default now()
);
create unique index if not exists aeronaves_matricula on aeronaves (upper(matricula));

create table if not exists itens (
  id text primary key default gen_random_uuid()::text,
  aeronave_id text not null references aeronaves(id) on delete cascade,
  mapa text not null, secao text, grupo text, ordem int,
  nome text not null, pn text, ns text,
  tlv_data text, tlv_horas numeric, tbo_data text, tbo_horas numeric,
  validade date, validade_mes boolean, efetuado_data date, efetuado_mes boolean, efetuado_tsn numeric,
  tsn_base numeric, tsn_ign boolean, tso_novo boolean,
  situacao text not null default 'controlado' check (situacao in ('controlado','na','outro','oc','pendente','nota')),
  ref_mapa text, obs text, principal boolean,
  atualizado_em timestamptz default now()
);
create index if not exists itens_aeronave on itens (aeronave_id);

create table if not exists lancamentos (
  id text primary key default gen_random_uuid()::text,
  aeronave_id text not null references aeronaves(id) on delete cascade,
  data date not null, horas numeric not null, pousos int, obs text,
  tsn_antes numeric, tsn_apos numeric, posicao_antes date,
  criado_em timestamptz default now(),
  criado_por text default (auth.jwt() ->> 'email')
);
create index if not exists lancamentos_aeronave on lancamentos (aeronave_id);

create table if not exists cumprimentos (
  id text primary key default gen_random_uuid()::text,
  item_id text not null references itens(id) on delete cascade,
  aeronave_id text not null references aeronaves(id) on delete cascade,
  data date, tsn numeric, obs text, troca jsonb, antes jsonb,
  criado_em timestamptz default now(),
  criado_por text default (auth.jwt() ->> 'email')
);
create index if not exists cumprimentos_item on cumprimentos (item_id);

-- ============ acesso: só usuário logado E autorizado ============
do $$
declare t text;
begin
  foreach t in array array['config','aeronaves','itens','lancamentos','cumprimentos'] loop
    execute format('alter table %I enable row level security', t);
    execute format('drop policy if exists acesso on %I', t);
    execute format('create policy acesso on %I for all to authenticated using (eh_autorizado()) with check (eh_autorizado())', t);
  end loop;
end $$;

-- ============ operações que mexem em mais de uma coisa (tudo ou nada) ============

-- grava itens (insere ou atualiza pelo id) e apaga outros, na mesma transação
create or replace function gravar_itens(apagar text[] default '{}', gravar jsonb default '[]')
returns int language plpgsql set search_path = public as $$
declare n int;
begin
  delete from itens where id = any(coalesce(apagar, '{}'));
  insert into itens (id, aeronave_id, mapa, secao, grupo, ordem, nome, pn, ns, tlv_data, tlv_horas, tbo_data, tbo_horas,
    validade, validade_mes, efetuado_data, efetuado_mes, efetuado_tsn, tsn_base, tsn_ign, tso_novo, situacao, ref_mapa, obs, principal, atualizado_em)
  select id, aeronave_id, mapa, secao, grupo, ordem, nome, pn, ns, tlv_data, tlv_horas, tbo_data, tbo_horas,
    validade, validade_mes, efetuado_data, efetuado_mes, efetuado_tsn, tsn_base, tsn_ign, tso_novo, coalesce(situacao, 'controlado'), ref_mapa, obs, principal, now()
  from jsonb_populate_recordset(null::itens, coalesce(gravar, '[]'))
  on conflict (id) do update set
    aeronave_id = excluded.aeronave_id, mapa = excluded.mapa, secao = excluded.secao, grupo = excluded.grupo, ordem = excluded.ordem,
    nome = excluded.nome, pn = excluded.pn, ns = excluded.ns, tlv_data = excluded.tlv_data, tlv_horas = excluded.tlv_horas,
    tbo_data = excluded.tbo_data, tbo_horas = excluded.tbo_horas, validade = excluded.validade, validade_mes = excluded.validade_mes,
    efetuado_data = excluded.efetuado_data, efetuado_mes = excluded.efetuado_mes, efetuado_tsn = excluded.efetuado_tsn,
    tsn_base = excluded.tsn_base, tsn_ign = excluded.tsn_ign, tso_novo = excluded.tso_novo, situacao = excluded.situacao,
    ref_mapa = excluded.ref_mapa, obs = excluded.obs, principal = excluded.principal, atualizado_em = now();
  get diagnostics n = row_count;
  return n;
end $$;

-- lança horas: grava o lançamento e move o TSN da célula (trava a aeronave contra lançamentos simultâneos)
create or replace function registrar_lancamento(p_aeronave text, p_data date, p_horas numeric, p_pousos int default null, p_obs text default '')
returns jsonb language plpgsql set search_path = public as $$
declare a aeronaves; l lancamentos;
begin
  select * into a from aeronaves where id = p_aeronave for update;
  if not found then raise exception 'Aeronave não encontrada.'; end if;
  insert into lancamentos (aeronave_id, data, horas, pousos, obs, tsn_antes, tsn_apos, posicao_antes)
  values (p_aeronave, p_data, p_horas, p_pousos, coalesce(p_obs, ''), a.tsn, round(a.tsn + p_horas, 1), a.posicao_data)
  returning * into l;
  update aeronaves set tsn = l.tsn_apos,
    posicao_data = case when posicao_data is null or p_data >= posicao_data then p_data else posicao_data end,
    ciclos = case when coalesce(p_pousos, 0) > 0 then coalesce(ciclos, 0) + p_pousos else ciclos end
  where id = p_aeronave returning * into a;
  return jsonb_build_object('lancamento', to_jsonb(l), 'aeronave', to_jsonb(a));
end $$;

-- desfaz só o último lançamento da aeronave (o TSN volta junto)
create or replace function desfazer_lancamento(p_aeronave text)
returns jsonb language plpgsql set search_path = public as $$
declare a aeronaves; l lancamentos;
begin
  perform 1 from aeronaves where id = p_aeronave for update;
  select * into l from lancamentos where aeronave_id = p_aeronave and tsn_antes is not null
    order by criado_em desc nulls last limit 1;
  if not found then raise exception 'Não há lançamento para desfazer.'; end if;
  update aeronaves set tsn = l.tsn_antes, posicao_data = l.posicao_antes,
    ciclos = case when coalesce(l.pousos, 0) > 0 then greatest(0, coalesce(ciclos, 0) - l.pousos) else ciclos end
  where id = p_aeronave returning * into a;
  delete from lancamentos where id = l.id;
  return jsonb_build_object('lancamento', to_jsonb(l), 'aeronave', to_jsonb(a));
end $$;

-- registra um cumprimento: guarda o item como estava e aplica os campos novos
create or replace function registrar_cumprimento(p_item text, p_campos jsonb, p_data date, p_tsn numeric, p_obs text default '', p_troca jsonb default null)
returns jsonb language plpgsql set search_path = public as $$
declare velho itens; novo itens; c cumprimentos;
begin
  select * into velho from itens where id = p_item for update;
  if not found then raise exception 'Item não encontrado.'; end if;
  novo := jsonb_populate_record(velho, coalesce(p_campos, '{}') - 'id' - 'aeronave_id');
  perform gravar_itens('{}', jsonb_build_array(to_jsonb(novo)));
  insert into cumprimentos (item_id, aeronave_id, data, tsn, obs, troca, antes)
  values (p_item, velho.aeronave_id, p_data, p_tsn, coalesce(p_obs, ''), p_troca, to_jsonb(velho))
  returning * into c;
  select * into novo from itens where id = p_item;
  return jsonb_build_object('cumprimento', to_jsonb(c), 'item', to_jsonb(novo));
end $$;

-- desfaz um cumprimento: o item volta a ser como era antes dele
create or replace function desfazer_cumprimento(p_id text)
returns jsonb language plpgsql set search_path = public as $$
declare c cumprimentos; it itens;
begin
  select * into c from cumprimentos where id = p_id for update;
  if not found then raise exception 'Registro não encontrado.'; end if;
  if c.antes is not null and exists (select 1 from itens where id = c.item_id) then
    perform gravar_itens('{}', jsonb_build_array(c.antes));
  end if;
  delete from cumprimentos where id = p_id;
  select * into it from itens where id = c.item_id;
  return to_jsonb(it);
end $$;

-- troca TODOS os dados pelos de um backup (aeronaves, itens, horas, histórico e alertas)
create or replace function restaurar_backup(p jsonb)
returns boolean language plpgsql set search_path = public as $$
begin
  delete from aeronaves where true;  -- itens, horas e histórico saem em cascata
  insert into aeronaves select (jsonb_populate_record(null::aeronaves, jsonb_build_object('criado_em', now(), 'mapas', '[]'::jsonb) || e)).*
    from jsonb_array_elements(coalesce(p -> 'aeronaves', '[]')) e;
  perform gravar_itens('{}', coalesce(p -> 'itens', '[]'));
  insert into lancamentos select (jsonb_populate_record(null::lancamentos, jsonb_build_object('id', gen_random_uuid()::text, 'criado_em', now(), 'obs', '') || e)).*
    from jsonb_array_elements(coalesce(p -> 'lancamentos', '[]')) e;
  insert into cumprimentos select (jsonb_populate_record(null::cumprimentos, jsonb_build_object('id', gen_random_uuid()::text, 'criado_em', now(), 'obs', '') || e)).*
    from jsonb_array_elements(coalesce(p -> 'cumprimentos', '[]')) e;
  if p ? 'config' then
    update config set alerta_dias = coalesce((p -> 'config' ->> 'alerta_dias')::int, alerta_dias),
      alerta_horas = coalesce((p -> 'config' ->> 'alerta_horas')::numeric, alerta_horas) where id = 1;
  end if;
  return true;
end $$;

-- as funções rodam com as permissões de quem chama: as regras de acesso acima continuam valendo
revoke execute on function gravar_itens, registrar_lancamento, desfazer_lancamento, registrar_cumprimento,
  desfazer_cumprimento, restaurar_backup from public, anon;
grant execute on function gravar_itens, registrar_lancamento, desfazer_lancamento, registrar_cumprimento,
  desfazer_cumprimento, restaurar_backup, eh_autorizado to authenticated;
revoke execute on function eh_autorizado from public, anon;

-- ============ TROQUE AQUI: e-mails que podem entrar ============
-- O usuário também precisa existir em Authentication › Users (Add user › Create new user).
insert into autorizados (email, nome) values
  ('ericdudu1999@gmail.com', 'Eric')
  -- , ('email-do-mario@empresa.com', 'Mario')
on conflict (email) do nothing;
