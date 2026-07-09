# Backend — Sistema de Chamados de TI (Câmara Municipal de Itajubá)

## Requisitos
- Node.js 18+
- PostgreSQL 14+ (rodar antes o `schema.sql` do documento de requisitos)

## Instalação
```bash
npm install
cp .env.example .env
# edite o .env com as credenciais do banco e do Google OAuth
npm run dev
```

## Autenticação Google OAuth
1. Criar um projeto em https://console.cloud.google.com
2. Ativar "Google People API" (ou OAuth consent básico)
3. Criar credenciais OAuth 2.0 → Web application
4. Authorized redirect URI: `http://localhost:3000/auth/google/callback` (ajustar para o domínio real depois)
5. Preencher `GOOGLE_CLIENT_ID` e `GOOGLE_CLIENT_SECRET` no `.env`
6. `DOMINIO_PERMITIDO` restringe o login a e-mails `@seudominio` do Google Workspace (deixe vazio em ambiente de teste)

> Observação: mesmo com o sistema restrito à rede local, o fluxo do Google OAuth exige que o **servidor** consiga fazer chamadas de saída (outbound HTTPS) para os endpoints do Google. Isso não expõe o sistema à internet — só permite a validação do login.

## Primeiro administrador
Não existe cadastro de admin pela interface por segurança. Após o primeiro login (que cria o usuário com perfil `usuario`), promova manualmente:
```sql
UPDATE usuarios SET perfil = 'admin' WHERE email = 'seu-email@dominio';
```

## Estrutura
```
src/
  app.js               - configuração do Express (sessão, CORS, rotas)
  server.js            - inicialização do servidor
  db.js                - pool de conexão PostgreSQL
  passport-config.js   - estratégia de login Google OAuth
  middleware.js        - requireAuth / requireAdmin
  upload.js            - configuração do multer (anexos, limite 50MB)
  notificacoes-helper.js
  routes/
    auth.js            - login/logout/perfil atual
    chamados.js         - CRUD de chamados, comentários, anexos
    categorias.js       - CRUD de categorias
    equipamentos.js      - inventário (base para evolução futura)
    notificacoes.js      - notificações in-app (sem e-mail na V1)
    dashboard.js         - painel do administrador
    relatorios.js        - exportação de relatórios em PDF
```

## Decisões desta versão (V1)
- **Sem Socket.IO**: o frontend deve fazer polling (ex: a cada 15-30s) em `GET /notificacoes/nao-lidas/contagem` e `GET /dashboard` para simular atualização "quase em tempo real".
- **Sem e-mail**: notificações só aparecem dentro do sistema.
- **Multi-tenant preparado, não ativo**: todas as tabelas já têm `organizacao_id`, mas o backend não filtra por ele ainda — é uma extensão simples quando for necessário.
- **Sessão em memória**: adequado para ~50-60 usuários numa rede local. Se o servidor reiniciar, todos precisam logar de novo. Se isso incomodar, a evolução natural é usar `connect-pg-simple` para persistir sessões no Postgres.

## Testando rapidamente
```bash
curl http://localhost:3000/health
# {"ok":true}
```
Login real requer abrir `http://localhost:3000/auth/google` no navegador (fluxo OAuth não funciona via curl).
