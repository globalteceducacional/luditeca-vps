---
description: Repassar Área do Administrador (front + back) para outra aplicação
---

# Integrar Área do Administrador

Use este comando ao portar ou integrar a **Área do Administrador** em outro projeto (front + back).

## Instruções para o agente

1. **Leia primeiro** o documento completo: `docs/INTEGRACAO-AREA-ADMIN.md`

2. **Mapeie o escopo** — a área admin cobre:
   - Painel: `src/pages/AdminPanel.jsx`
   - Login local: `src/components/AdminLoginModal.jsx`
   - Editores: `BookEditor`, `ActivityEditor`, `LibrasEditor`
   - Managers: `ColoringPagesManager`, `PuzzleGameManager`
   - Schemas: `base44/entities/{Book,Activity,LibrasLesson,PuzzleGame,ColoringPage}.jsonc`

3. **Autenticação em duas camadas:**
   - Base44: `user.role === 'admin'` (obrigatório)
   - UI: `localStorage.admin_session` após senha (padrão `0000`)
   - Documentar/corrigir: `admin_password` não é validada no login hoje

4. **Backend (Base44 ou equivalente):**
   - CRUD das 5 entidades
   - `base44.integrations.Core.UploadFile({ file })` para mídia
   - Rotas públicas filtram `is_published: true` (exceto LibrasLesson)

5. **Rotas front obrigatórias:**
   - `/admin`
   - `/admin/book/:id` (`new` = criar)
   - `/admin/libras/:id`
   - `/admin/activity/:id`

6. **Ao integrar na outra app:**
   - Listar gaps de API (endpoints faltantes)
   - Propor adaptador se não usar Base44
   - Manter contratos de schema dos JSON em `base44/entities/`
   - Garantir que conteúdo publicado apareça em Library, Activities, Puzzle e Coloring
   - Substituir senha só-localStorage por auth server-side se possível

7. **Entregáveis esperados:**
   - Plano de migração (passo a passo)
   - Lista de arquivos a copiar/adaptar
   - Contratos API (request/response por entidade)
   - Checklist de testes manuais pós-integração

## Contexto do usuário

O usuário quer repassar **todo o fluxo e funcionalidade** da Área do Administrador para outra aplicação. Priorize fidelidade ao comportamento atual e documente divergências necessárias na nova stack.
