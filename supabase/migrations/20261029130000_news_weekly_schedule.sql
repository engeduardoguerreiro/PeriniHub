-- Coleta semanal do PeriniHub Tech: além dos horários, os dias da semana em
-- que a coleta roda (0 = domingo … 6 = sábado, no fuso editorial). Antes a
-- coleta rodava todos os dias em 3 horários; agora o padrão é 1 vez por
-- semana (segunda, 08:00), editável no painel.

alter table public.news_editorial_settings
  add column schedule_weekdays smallint[] not null default '{1}'
    check (cardinality(schedule_weekdays) between 1 and 7 and schedule_weekdays <@ '{0,1,2,3,4,5,6}'::smallint[]);

update public.news_editorial_settings
set schedule_weekdays = '{1}', schedule_times = '{08:00}'
where id = 1;
