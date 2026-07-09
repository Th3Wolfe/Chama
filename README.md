<p align="center">
  <img src="./img/logo-chama-no-bg.png" alt="Chama - Chamados TI" width="400">
</p>

<h1 align="center">Chamados TI</h1>

<p align="center">
  Sistema de gestão de chamados de TI feito para órgãos públicos de médio e pequeno porte.<br>
  Abertura, acompanhamento e resolução de chamados com histórico auditável, dashboard e relatórios em PDF.
</p>

<p align="center">
  <img src="https://img.shields.io/badge/status-V1-blue" alt="status">
  <img src="https://img.shields.io/badge/node-18%2B-339933?logo=node.js&logoColor=white" alt="node">
  <img src="https://img.shields.io/badge/postgresql-14%2B-336791?logo=postgresql&logoColor=white" alt="postgresql">
  <img src="https://img.shields.io/badge/license-uso%20interno-lightgrey" alt="license">
</p>

---

## Sobre o projeto

O **Chamados TI** substitui o fluxo informal de pedidos de suporte (telefone, WhatsApp, corredor) por um sistema único: qualquer servidor abre um chamado descrevendo o problema, e a equipe técnica assume, atualiza o status e resolve — tudo com histórico completo e visível.

A V1 é feita sob medida para a Câmara de Itajubá (instância única, rede local, sem Active Directory), mas o schema já reserva o campo `organizacao_id` em todas as tabelas centrais, para que uma futura evolução multi-organização não exija redesenho do banco.

**Principais decisões desta versão:**
- Autenticação via login corporativo do **Google Workspace** (OAuth) — sem senha própria.
- Sem envio de e-mail e sem Socket.IO: notificações in-app com **polling**.
- **Nada é apagado fisicamente** — status, categoria e responsável ficam sempre auditáveis.
- Uso restrito à rede local da Câmara (sem exposição à internet nesta fase).

## Índice

- [Funcionalidades](#funcionalidades)
- [Arquitetura e stack](#arquitetura-e-stack)
- [Estrutura do repositório](#estrutura-do-repositório)
- [Modelo de dados](#modelo-de-dados)
- [Como rodar localmente](#como-rodar-localmente)
- [Variáveis de ambiente](#variáveis-de-ambiente)
- [Primeiro administrador](#primeiro-administrador)
- [Perfis de acesso](#perfis-de-acesso)
- [Roteiro / fora de escopo na V1](#roteiro--fora-de-escopo-na-v1)
- [Documentação adicional](#documentação-adicional)

## Funcionalidades

**Chamados**
- Abertura com título, setor, categoria, descrição e anexo (imagem, até 50MB, configurável).
- Usuário comum vê e comenta apenas os próprios chamados; pode marcá-los como resolvidos (chamado encerrado não é reaberto — abre-se um novo).
- Administrador/técnico vê todos os chamados de todos os setores, assume chamados sem responsável, transfere entre técnicos e altera status, categoria e prioridade a qualquer momento.
- Trocar a categoria recalcula automaticamente a prioridade (com base na prioridade padrão da categoria), permitindo sobrescrita manual depois.
- Linha do tempo por chamado: mudanças de status, comentários e responsáveis, tudo com autor e data.

**Categorias e prioridades**
- Categorias pré-cadastradas (Hardware, Software, Rede, Impressora, Internet, E-mail, Sistema Interno) e totalmente editáveis pelo administrador.
- Prioridade padrão por categoria (Baixa/Média/Alta), visível apenas ao administrador.

**Dashboard**
- Totais de chamados abertos, sem responsável, em andamento e resolvidos no dia, além do tempo médio de atendimento.
- Listas de chamados sem responsável / em andamento / resolvidos, com opção de assumir diretamente da lista.

**Notificações**
- Notificações internas (in-app) ao administrador quando surge um novo chamado ou nova interação, via polling.

**Inventário (base para evolução futura)**
- Cadastro de equipamentos (nome, marca, modelo, nº de série, status) e vínculo com usuários.

**Relatórios**
- Chamados por mês, categoria, setor e técnico, e tempo médio de atendimento — exportáveis em PDF.

## Arquitetura e stack

| Camada | Tecnologia |
|---|---|
| Frontend | React + TypeScript + Vite |
| Backend | Node.js + Express |
| Banco de dados | PostgreSQL |
| Autenticação | Google Workspace OAuth (Passport.js) |
| Upload de anexos | Multer |
| Geração de PDF | PDFKit |
| Atualização em tempo real | Polling/refresh (Socket.IO adiado para versão futura) |

```
Frontend (Vite :5173)  ──HTTP/cookie de sessão──▶  Backend (Express :3000)  ──▶  PostgreSQL
        │                                                  │
        └── login "Entrar com Google Workspace" ──▶ /auth/google (OAuth) ──▶ Google
```

## Estrutura do repositório

```
.
├── backend/               # API Express + PostgreSQL
│   ├── src/
│   │   ├── app.js               # configuração do Express (sessão, CORS, rotas)
│   │   ├── server.js            # inicialização do servidor
│   │   ├── db.js                # pool de conexão PostgreSQL
│   │   ├── passport-config.js   # estratégia de login Google OAuth
│   │   ├── middleware.js        # requireAuth / requireAdmin
│   │   ├── upload.js            # configuração do multer (anexos)
│   │   ├── notificacoes-helper.js
│   │   └── routes/
│   │       ├── auth.js          # login / logout / perfil atual
│   │       ├── chamados.js      # CRUD de chamados, comentários, anexos
│   │       ├── categorias.js    # CRUD de categorias
│   │       ├── setores.js       # setores
│   │       ├── equipamentos.js  # inventário
│   │       ├── usuarios.js      # usuários
│   │       ├── notificacoes.js  # notificações in-app
│   │       ├── dashboard.js     # painel do administrador
│   │       └── relatorios.js    # exportação de relatórios em PDF
│   ├── db/
│   │   ├── schema.sql                        # schema base
│   │   ├── migration_002_setores.sql
│   │   └── migration_003_remove_setor_legado.sql
│   └── uploads/            # arquivos anexados aos chamados
├── frontend/               # SPA React + TypeScript
│   └── src/
│       ├── api/                  # client axios + tipos espelhando o backend
│       ├── context/AuthContext.tsx
│       ├── components/           # Sidebar, Topbar, Badge, StatCard, NotificationsPanel...
│       └── pages/
│           ├── Login.tsx
│           ├── Dashboard.tsx
│           ├── Chamados/          # lista, novo chamado, detalhe/gestão
│           ├── Categorias.tsx
│           ├── Equipamentos.tsx
│           ├── Setores.tsx
│           └── Relatorios.tsx
└── img/                    # logos e assets do projeto
```

## Modelo de dados

Entidades principais: `Usuario`, `Categoria`, `Chamado`, `HistoricoStatus`, `Comentario`, `Anexo`, `Equipamento`, `Notificacao`.

- Um usuário abre vários chamados e pode ser responsável por vários outros.
- Cada chamado pertence a uma categoria e acumula histórico de status, comentários e anexos.
- Todas as tabelas centrais têm `organizacao_id` (hoje fixo em uma única organização), preparando o terreno para multi-organização sem redesenho de schema.

O DDL completo está em [`backend/db/schema.sql`](./backend/db/schema.sql); o detalhamento de requisitos funcionais/não funcionais e o MER estão em [`documento-requisitos-chamados-ti.md`](./documento-requisitos-chamados-ti.md).

## Como rodar localmente

### Pré-requisitos
- Node.js 18+
- PostgreSQL 14+
- Um projeto no [Google Cloud Console](https://console.cloud.google.com) com credenciais OAuth 2.0

### 1. Banco de dados
```bash
createdb chamados_ti
psql chamados_ti -f backend/db/schema.sql
psql chamados_ti -f backend/db/migration_002_setores.sql
psql chamados_ti -f backend/db/migration_003_remove_setor_legado.sql
```

### 2. Backend
```bash
cd backend
npm install
cp .env.example .env
# edite o .env com as credenciais do banco e do Google OAuth
npm run dev
```
Confirme que subiu: `curl http://localhost:3000/health` → `{"ok":true}`.

### 3. Frontend
```bash
cd frontend
npm install
cp .env.example .env
# ajuste VITE_API_URL se o backend não estiver em localhost:3000
npm run dev
```
Acesse `http://localhost:5173`.

### Build de produção do frontend
```bash
cd frontend
npm run build
```
Gera os arquivos estáticos em `dist/`, prontos para servir via Nginx/IIS ou pelo próprio Express (`express.static`).

## Variáveis de ambiente

**`backend/.env`**
```env
DATABASE_URL=postgres://usuario:senha@localhost:5432/chamados_ti
SESSION_SECRET=troque-este-valor-por-uma-string-aleatoria-longa

GOOGLE_CLIENT_ID=seu-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=seu-client-secret
GOOGLE_CALLBACK_URL=http://localhost:3000/auth/google/callback

# Restringe login a um domínio do Google Workspace (vazio = sem restrição)
DOMINIO_PERMITIDO=camaraitajuba.mg.gov.br

FRONTEND_URL=http://localhost:5173
PORT=3000
```

**`frontend/.env`**
```env
VITE_API_URL=http://localhost:3000
```

### Configurando o Google OAuth
1. Criar um projeto em [console.cloud.google.com](https://console.cloud.google.com).
2. Ativar a "Google People API" (ou o consentimento OAuth básico).
3. Criar credenciais OAuth 2.0 → *Web application*.
4. Definir a *Authorized redirect URI*: `http://localhost:3000/auth/google/callback` (ajustar para o domínio real em produção).
5. Preencher `GOOGLE_CLIENT_ID` e `GOOGLE_CLIENT_SECRET` no `.env` do backend.

> Mesmo com o sistema restrito à rede local (RNF01), o fluxo OAuth exige que o **servidor** consiga fazer chamadas de saída (HTTPS) para os endpoints do Google. Isso não expõe o sistema à internet — apenas viabiliza a validação do login.

## Primeiro administrador

Não há cadastro de administrador pela interface, por segurança. Após o primeiro login (que cria o usuário com perfil `usuario`), promova manualmente no banco:
```sql
UPDATE usuarios SET perfil = 'admin' WHERE email = 'seu-email@dominio';
```

## Perfis de acesso

| Perfil | Pode |
|---|---|
| **Usuário** | Abrir chamados; ver e comentar apenas os próprios; marcar como resolvido |
| **Administrador/Técnico** | Ver todos os chamados; assumir/transferir responsabilidade; alterar status, categoria e prioridade; gerenciar categorias e equipamentos; acessar dashboard e relatórios |

## Roteiro / fora de escopo na V1

Itens conscientemente deixados de fora desta versão, para uma próxima iteração:
- Multi-organização ativa (estrutura de banco já preparada)
- Notificação por e-mail
- Integração com WhatsApp
- Chat interno geral (fora do contexto do chamado)
- Aplicativo móvel
- Socket.IO / atualização em tempo real (V1 usa polling)
- Chamado nascendo associado a um equipamento específico
- Exportação de relatórios em Excel (desejável, não obrigatória)

## Documentação adicional

- [`documento-requisitos-chamados-ti.md`](./documento-requisitos-chamados-ti.md) — requisitos funcionais, não funcionais e MER completos
- [`backend/README.md`](./backend/README.md) — detalhes da API
- [`frontend/README.md`](./frontend/README.md) — detalhes da SPA

---
