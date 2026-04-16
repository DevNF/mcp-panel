# mcp-panel

MCP server para o sistema interno de tickets NFPanel (`api.fuganholisistemas.com.br`).

## Requisitos

- Node.js >= 14.8.0

## Instalação

```bash
npx mcp-panel
```

Ou clone e rode localmente:

```bash
git clone git@github.com:DevNF/mcp-panel.git
cd mcp-panel
npm install
node index.js
```

## Configuração

Defina a variável de ambiente `PANEL_API_TOKEN` com o Bearer token da API:

```bash
PANEL_API_TOKEN=seu-token node index.js
```

Opcionalmente, sobrescreva a URL base:

```bash
PANEL_API_URL=https://api.outro-ambiente.com.br PANEL_API_TOKEN=seu-token node index.js
```

## Configuração no Claude Code

Adicione em `~/.claude/settings.json`:

```json
{
  "mcpServers": {
    "mcp-panel": {
      "command": "npx",
      "args": ["-y", "mcp-panel"],
      "env": {
        "PANEL_API_TOKEN": "seu-token"
      }
    }
  }
}
```

---

## Tools disponíveis

### Tickets

| Tool | Descrição |
|------|-----------|
| `tickets_list` | Lista tickets. Filtro opcional por `status` (0–4) |
| `ticket_view` | Exibe todos os detalhes de um ticket, incluindo comentários |
| `ticket_create` | Cria novo ticket interno (`internal: true` automático) |
| `ticket_update` | Atualiza campos de um ticket (envie apenas o que alterar) |
| `ticket_move` | Move para coluna do kanban por ID ou nome (case-insensitive) |
| `ticket_assign` | Reatribui responsável (`user_id`) |
| `ticket_comment` | Posta comentário interno (assinatura adicionada automaticamente) |
| `ticket_close` | Fecha/conclui ticket |
| `ticket_cancel` | Cancela ticket (motivo obrigatório, mínimo 15 chars) |
| `ticket_reopen` | Reabre ticket cancelado ou fechado |
| `ticket_reprove` | Reprova ticket em coluna de Review, Teste ou Concluído |

### Lookups

| Tool | Descrição |
|------|-----------|
| `kanban_columns` | Lista colunas do kanban com `id`, `name` e `type_report` |
| `products_list` | Lista produtos disponíveis com `id` e `name` |
| `product_permissions` | Lista permissões/módulos de um produto (`product_id` obrigatório) |
| `users_list` | Lista todos os usuários do sistema |
| `user_me` | Retorna dados do usuário autenticado pelo token |

---

## Status de tickets

| Valor | Significado |
|-------|-------------|
| `0` | Aberto |
| `1` | Em andamento |
| `2` | Fechado/Concluído |
| `3` | Cancelado |
| `4` | Reprovado |

## Tipos de ticket

| Valor | Significado |
|-------|-------------|
| `1` | Suporte / Bug |
| `2` | Feature |

## Tags válidas

`Migration`, `Script`, `Aguardando Cliente`, `Aguardando Interno`, `Menu`, `Site`, `Reprovado Review`

## type_report das colunas kanban

| Valor | Comportamento automático |
|-------|--------------------------|
| `1` | Trabalho normal |
| `2` | Retrabalho — reabre ticket (status=0) |
| `3` | Review |
| `4` | Teste |
| `5` | Concluído — fecha ticket (status=2) |
