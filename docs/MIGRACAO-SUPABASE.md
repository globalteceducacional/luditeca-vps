# Migração de dados Supabase → Postgres (VPS)

## Pré-requisitos

- Novo schema já aplicado (`prisma migrate deploy` na API).
- Tabela `users` local (não `auth.users`): crie contas com `npm run create-admin` ou registo público e mapeie IDs antigos → novos se necessário.

## Exportar do Supabase (SQL)

No painel SQL ou `psql` contra o projeto Supabase:

1. **books, authors, categories** (ajuste `COPY` para ficheiros se preferir):

```sql
COPY (SELECT * FROM public.books) TO STDOUT WITH CSV HEADER;
```

Repita para `authors` e `categories`.

2. **media_files**: exporte linhas de `public.media_files`. O campo `user_id` deve referenciar o novo UUID em `public.users` (não o `auth.users`). Se os UUIDs forem mantidos ao importar utilizadores, pode preservar `user_id`; caso contrário, use um script de mapeamento.

3. **Ficheiros no Storage**: copie os buckets (`covers`, `pages`, `presentations`, …) para o diretório local da API (ex.: volume `luditeca_storage` em `/app/storage/<bucket>/...` no Docker), com `rsync`, `rclone` ou upload manual, mantendo os mesmos caminhos relativos para não quebrar referências na base.

## Importar na VPS

1. `psql` contra o Postgres da VPS (ou `docker compose exec db psql -U luditeca -d luditeca`).
2. Importe CSV com `COPY ... FROM STDIN` ou insira via script Node + Prisma.
3. Respeite a ordem de FKs: `authors`, `categories`, depois `books` (se houver FKs para autor/categoria).

## Utilizadores

- Se não exportar `auth.users`, recrie logins na API e atualize `media_files.user_id` / referências em dados JSON com um script one-off.
- Passwords antigas do Supabase não são portáveis: os utilizadores devem usar **nova senha** ou fluxo de “esqueci a senha” (a implementar na API se precisar).
