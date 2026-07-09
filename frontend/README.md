# Frontend — Sistema de Chamados de TI (Câmara Municipal de Itajubá)

React + TypeScript + Vite. Visual inspirado no protótipo de alta fidelidade fornecido (sidebar navy, cards de estatísticas, gráficos e painel de notificações).

## Requisitos
- Node.js 18+
- Backend rodando (ver `backend/README.md`)

## Instalação
```bash
npm install
cp .env.example .env
# ajuste VITE_API_URL se o backend não estiver em localhost:3000
npm run dev
```
Acesse `http://localhost:5173`.

## Fluxo de login
O botão "Entrar com Google Workspace" redireciona para `GET {API}/auth/google` no backend. Após o consentimento do Google, o backend redireciona de volta para o frontend já com o cookie de sessão definido.

## Estrutura
```
src/
  api/client.ts        - instância axios (credentials habilitado para cookie de sessão)
  api/types.ts         - tipos espelhando o schema do backend
  context/AuthContext.tsx
  components/
    Layout/             - Sidebar, Topbar, AppLayout
    Badge.tsx           - badges de status e prioridade
    StatCard.tsx
    NotificationsPanel.tsx
    QuickActions.tsx
    RequireAuth.tsx     - bloqueia rotas sem sessão ativa
  pages/
    Login.tsx
    Dashboard.tsx        - stats, gráfico de linha (30 dias), donut por categoria, tabela recente
    Chamados/
      ChamadosList.tsx    - abas Abertos/Em andamento/Resolvidos/Todos
      NovoChamado.tsx      - formulário de abertura (com upload de anexo)
      ChamadoDetail.tsx    - histórico, comentários, e painel de gestão (admin)
    Categorias.tsx
    Equipamentos.tsx
    Relatorios.tsx        - download dos PDFs gerados pelo backend
```

## Decisões desta versão (V1)
- **Sem tempo real (Socket.IO)**: o sino de notificações faz polling a cada 20s. Ajustável em `Topbar.tsx` (`INTERVALO_POLLING_MS`).
- **Perfis**: usuários comuns veem só seus próprios chamados; o painel de gestão do chamado (mudar status/categoria/responsável/prioridade) só aparece para `perfil === 'admin'`.
- Itens do protótipo original fora do escopo combinado (Chat Interno geral, gestão avançada de usuários, Configurações) não foram incluídos no menu — podem ser adicionados depois seguindo o mesmo padrão visual.

## Build de produção
```bash
npm run build
```
Gera os arquivos estáticos em `dist/`, prontos para servir via Nginx/IIS ou o próprio Express (`express.static`).
