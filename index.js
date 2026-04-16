#!/usr/bin/env node
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import fetch from 'node-fetch';

const BASE_URL = process.env.PANEL_API_URL ?? 'https://api.fuganholisistemas.com.br';
const TOKEN = process.env.PANEL_API_TOKEN;
if (!TOKEN) {
  process.stderr.write('Erro: variável PANEL_API_TOKEN não definida.\n');
  process.exit(1);
}

const SIGNATURE = '<p><em>Inserido através do claude via skill</em></p>';

async function api(method, path, body) {
  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json;
  try { json = JSON.parse(text); } catch { json = { raw: text }; }
  if (!res.ok) {
    return { error: true, status: res.status, body: json };
  }
  return json;
}

const TOOLS = [
  {
    name: 'tickets_list',
    description: 'Lista tickets. Filtro opcional por status: 0=Aberto, 1=Em andamento, 2=Fechado, 3=Cancelado, 4=Reprovado.',
    inputSchema: {
      type: 'object',
      properties: {
        status: { type: 'number', description: '0-4 para filtrar por status. Omitir = todos.' },
      },
    },
  },
  {
    name: 'ticket_view',
    description: 'Exibe todos os detalhes de um ticket, incluindo mensagens/comentários.',
    inputSchema: {
      type: 'object',
      required: ['id'],
      properties: {
        id: { type: 'number', description: 'ID do ticket.' },
      },
    },
  },
  {
    name: 'ticket_create',
    description: 'Cria novo ticket interno. internal sempre true. Adiciona assinatura automática na descrição.',
    inputSchema: {
      type: 'object',
      required: ['subject', 'description', 'kanban_column_id', 'product_id', 'product_permission_id', 'type', 'url', 'solution', 'user_id'],
      properties: {
        subject: { type: 'string', description: 'Título (max 150 chars).' },
        description: { type: 'string', description: 'Descrição HTML detalhada.' },
        kanban_column_id: { type: 'number' },
        product_id: { type: 'number' },
        product_permission_id: { type: 'number' },
        type: { type: 'number', description: '1=Suporte/Bug, 2=Feature.' },
        url: { type: 'string', description: 'URL relacionada (max 200 chars).' },
        solution: { type: 'string', description: 'Prazo SLA formato "YYYY-MM-DD HH:mm".' },
        status: { type: 'number', description: '0=Aberto (padrão).' },
        user_id: { type: 'number', description: 'ID do responsável.' },
        make_user_id: { type: 'number', description: 'ID de quem executa (opcional).' },
        tags: { type: 'array', items: { type: 'string' }, description: 'Tags válidas: Migration, Script, Aguardando Cliente, Aguardando Interno, Menu, Site, Reprovado Review.' },
        users: { type: 'array', items: { type: 'number' }, description: 'IDs de customer_users relacionados.' },
      },
    },
  },
  {
    name: 'ticket_update',
    description: 'Atualiza campos de um ticket existente. Envie apenas os campos a alterar.',
    inputSchema: {
      type: 'object',
      required: ['id'],
      properties: {
        id: { type: 'number' },
        subject: { type: 'string' },
        description: { type: 'string' },
        type: { type: 'number', description: '1=Suporte/Bug, 2=Feature.' },
        url: { type: 'string' },
        solution: { type: 'string', description: 'Prazo SLA "YYYY-MM-DD HH:mm".' },
        user_id: { type: 'number' },
        tags: { type: 'array', items: { type: 'string' } },
      },
    },
  },
  {
    name: 'ticket_move',
    description: 'Move ticket para coluna do kanban por ID ou nome (case-insensitive).',
    inputSchema: {
      type: 'object',
      required: ['id', 'column'],
      properties: {
        id: { type: 'number', description: 'ID do ticket.' },
        column: { type: ['number', 'string'], description: 'ID numérico ou nome da coluna.' },
      },
    },
  },
  {
    name: 'ticket_assign',
    description: 'Reatribui responsável de um ticket.',
    inputSchema: {
      type: 'object',
      required: ['id', 'user_id'],
      properties: {
        id: { type: 'number' },
        user_id: { type: 'number', description: 'ID do novo responsável.' },
      },
    },
  },
  {
    name: 'ticket_comment',
    description: 'Posta comentário interno em um ticket. Adiciona assinatura automática.',
    inputSchema: {
      type: 'object',
      required: ['id', 'message'],
      properties: {
        id: { type: 'number', description: 'ID do ticket.' },
        message: { type: 'string', description: 'Mensagem (texto ou HTML).' },
        user_id: { type: 'number', description: 'ID do autor. Omitir = busca usuário autenticado.' },
      },
    },
  },
  {
    name: 'ticket_close',
    description: 'Fecha/conclui um ticket.',
    inputSchema: {
      type: 'object',
      required: ['id'],
      properties: {
        id: { type: 'number' },
      },
    },
  },
  {
    name: 'ticket_cancel',
    description: 'Cancela um ticket. Motivo obrigatório (mínimo 15 chars).',
    inputSchema: {
      type: 'object',
      required: ['id', 'cancel_reason'],
      properties: {
        id: { type: 'number' },
        cancel_reason: { type: 'string', description: 'Motivo do cancelamento (min 15 chars).' },
      },
    },
  },
  {
    name: 'ticket_reopen',
    description: 'Reabre um ticket cancelado ou fechado.',
    inputSchema: {
      type: 'object',
      required: ['id'],
      properties: {
        id: { type: 'number' },
      },
    },
  },
  {
    name: 'ticket_reprove',
    description: 'Reprova ticket em Review (type_report=3), Teste (4) ou Concluído (5).',
    inputSchema: {
      type: 'object',
      required: ['id', 'reason'],
      properties: {
        id: { type: 'number' },
        reason: { type: 'string', description: 'Motivo da reprovação.' },
      },
    },
  },
  {
    name: 'kanban_columns',
    description: 'Lista todas as colunas do kanban com id, nome e type_report.',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'products_list',
    description: 'Lista produtos disponíveis com id e nome.',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'product_permissions',
    description: 'Lista permissões/módulos de um produto.',
    inputSchema: {
      type: 'object',
      required: ['product_id'],
      properties: {
        product_id: { type: 'number' },
      },
    },
  },
  {
    name: 'users_list',
    description: 'Lista todos os usuários do sistema com id e nome.',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'user_me',
    description: 'Retorna dados do usuário autenticado pelo token atual.',
    inputSchema: { type: 'object', properties: {} },
  },
];

async function resolveColumn(column) {
  if (typeof column === 'number') return { id: column, name: String(column) };

  const data = await api('GET', '/api/kanban-columns');
  const cols = Array.isArray(data) ? data : (data.data ?? []);
  const normalize = (s) => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const needle = normalize(String(column));
  const match = cols.find((c) => normalize(c.name ?? c.description ?? '').includes(needle));
  if (!match) {
    return { error: true, available: cols.map((c) => ({ id: c.id, name: c.name ?? c.description })) };
  }
  return { id: match.id, name: match.name ?? match.description };
}

async function getMyUserId() {
  const me = await api('GET', '/api/users/me');
  return me?.id ?? me?.data?.id ?? null;
}

async function handleTool(name, args) {
  switch (name) {
    case 'tickets_list': {
      const data = await api('GET', '/api/tickets');
      const list = Array.isArray(data) ? data : (data.data ?? []);
      const filtered = args.status !== undefined ? list.filter((t) => t.status === args.status) : list;
      return filtered;
    }

    case 'ticket_view':
      return api('GET', `/api/tickets/${args.id}`);

    case 'ticket_create': {
      const desc = String(args.description).endsWith(SIGNATURE)
        ? args.description
        : args.description + SIGNATURE;
      return api('POST', '/api/tickets', {
        ...args,
        internal: true,
        status: args.status ?? 0,
        description: desc,
      });
    }

    case 'ticket_update': {
      const { id, ...fields } = args;
      return api('PUT', `/api/tickets/${id}`, fields);
    }

    case 'ticket_move': {
      const col = await resolveColumn(args.column);
      if (col.error) return { error: 'Coluna não encontrada.', available: col.available };
      const result = await api('PUT', `/api/tickets/${args.id}`, { kanban_column_id: col.id });
      return { moved_to: { id: col.id, name: col.name }, result };
    }

    case 'ticket_assign':
      return api('PUT', `/api/tickets/${args.id}`, { make_user_id: args.user_id });

    case 'ticket_comment': {
      const userId = args.user_id ?? await getMyUserId();
      const msg = args.message.includes(SIGNATURE) ? args.message : args.message + SIGNATURE;
      const body = msg.startsWith('<') ? msg : `<p>${msg}</p>`;
      return api('POST', `/api/tickets/${args.id}/messages`, {
        message: body,
        type: 2,
        user_id: userId,
      });
    }

    case 'ticket_close':
      return api('POST', `/api/tickets/${args.id}/finished`);

    case 'ticket_cancel': {
      if (String(args.cancel_reason).length < 15) {
        return { error: 'cancel_reason deve ter pelo menos 15 caracteres.' };
      }
      return api('POST', `/api/tickets/${args.id}/cancel`, { cancel_reason: args.cancel_reason });
    }

    case 'ticket_reopen':
      return api('POST', `/api/tickets/${args.id}/reopen`);

    case 'ticket_reprove':
      return api('POST', `/api/tickets/${args.id}/reprove`, { reason: args.reason });

    case 'kanban_columns':
      return api('GET', '/api/kanban-columns');

    case 'products_list':
      return api('GET', '/api/products');

    case 'product_permissions':
      return api('GET', `/api/products/${args.product_id}/permissions`);

    case 'users_list':
      return api('GET', '/api/users');

    case 'user_me':
      return api('GET', '/api/users/me');

    default:
      return { error: `Tool desconhecida: ${name}` };
  }
}

const server = new Server(
  { name: 'mcp-panel', version: '1.0.0' },
  { capabilities: { tools: {} } },
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: TOOLS }));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  try {
    const result = await handleTool(name, args ?? {});
    return {
      content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
    };
  } catch (err) {
    return {
      content: [{ type: 'text', text: JSON.stringify({ error: err.message }) }],
      isError: true,
    };
  }
});

const transport = new StdioServerTransport();
await server.connect(transport);
