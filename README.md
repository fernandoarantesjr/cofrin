# Cofrin

Organizador financeiro da casa, em guaraní, com mascote que julga.
Login restrito: só entram os e-mails que você criar.

## Como funciona

- **GitHub Pages** mostra o site (o "app").
- **Supabase** (grátis) guarda os dados e confere o login.
  A senha nunca fica no código, por isso é seguro mesmo o site sendo público.

## Passo a passo (uns 10 minutos)

### 1. Criar o cofre (Supabase)
1. Entre em https://supabase.com e crie um projeto (plano Free).
2. Menu **SQL Editor** → *New query* → cole o conteúdo de `supabase.sql` → **Run**.
   - Se for usar outros e-mails, troque os e-mails no arquivo antes de rodar.

### 2. Fechar o cadastro
1. **Authentication → Sign In / Providers** (ou *Settings*).
2. Desligue **Allow new users to sign up**.
   Assim ninguém consegue criar conta sozinho.

### 3. Criar os 2 logins
1. **Authentication → Users → Add user → Create new user**.
2. E-mail: `fernando@cofrin.app`, escolha uma senha forte, marque **Auto Confirm User**.
3. Repita para `luiza@cofrin.app`.

> Os e-mails são fictícios: com *Auto Confirm* nenhum e-mail é enviado.

### 4. Ligar o site ao cofre
1. **Project Settings → API** (ou *Data API*): copie a **Project URL** e a chave **anon public**.
2. No `index.html`, troque:
   ```js
   const SUPABASE_URL='COLE_AQUI_A_PROJECT_URL';
   const SUPABASE_KEY='COLE_AQUI_A_ANON_PUBLIC_KEY';
   ```
   A chave *anon* pode ficar no código: sem login liberado ela não abre nada.
   **Nunca** coloque a chave `service_role`.

### 5. Publicar no GitHub
1. Crie um repositório e suba `index.html` (o resto é opcional).
2. **Settings → Pages** → *Deploy from a branch* → `main` / `root` → Save.
3. Em ~1 minuto o site fica em `https://SEU-USUARIO.github.io/NOME-DO-REPO/`.

## Para trocar senha ou tirar acesso
Supabase → **Authentication → Users** → o usuário → *Reset password* ou *Delete user*.

## Notificações (iPhone: só com o app na Tela de Início, iOS 16.4+)
- Ative em ⚙︎ Ajustes → **Ativar avisos neste aparelho** (em cada celular).
- Avisa quando o outro lança gasto, receita, caixinha ou paga conta (pelo app ou pela Siri).
- Todo dia às 9h: contas que vencem amanhã/hoje/atrasadas, dia de salário, ritmo do mês.
- Domingo às 20h: resumo da semana.
- Peças: `push-function.ts` (função `push`), `push.sql` (tabelas e agendamentos), `sw.js`.

## Widget do porquinho (iPhone, app Scriptable)
1. Instale o **Scriptable** (grátis na App Store).
2. Crie um script novo, cole o conteúdo de `widget/instalar.js` e rode → cria o script **Cofrin**.
3. Abra o **Cofrin** no Scriptable e rode uma vez: ele pede e-mail e senha (ficam nas Chaves do iPhone).
4. Tela inicial → segure → **+** → Scriptable → pequeno ou médio → toque no widget → Script: **Cofrin**.
   Também funciona na tela de bloqueio.
