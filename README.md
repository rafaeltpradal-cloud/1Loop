# 1loop creators · MVP

Conteúdo com estratégia. Redes com resultado.

Esta é a primeira versão funcional da plataforma: **plano → cadastro → pagamento com 7 dias de teste → área do usuário → entrevista → estratégia de 30 dias gerada com IA**.

## O que já funciona

| Etapa | Onde | O que faz |
|---|---|---|
| Escolha do plano | `/planos` | Basic, Pro e Multi, com preço Founders |
| Cadastro | `/cadastro?plano=pro` | Nome, e-mail, telefone (WhatsApp), senha e aceite dos termos |
| Pagamento | `/checkout` → Stripe | Página segura do Stripe, cartão obrigatório, 7 dias grátis, cupom Founders aplicado automaticamente |
| Boas-vindas | `/bem-vindo` | Confirma a assinatura e leva direto para a entrevista |
| Área do usuário | `/app` | Menu lateral, próximo passo, dias restantes do teste |
| Entrevista | `/app/entrevista` | 13 perguntas em 6 blocos; salva a cada passo; perfil de voz ao lado |
| Estratégia | `/app/estrategia` | Pilares, série, funil, calendário de 30 dias, plano de ação de 4 semanas e indicadores |
| Conta | `/app/conta` | Plano, status e acesso ao portal do Stripe (trocar cartão, mudar de plano, cancelar) |

Ainda não feito (próximas etapas): geração dos conteúdos (texto, imagem e roteiro), conexão com as redes e publicação automática, painel multi-marcas do plano Multi.

## Tecnologias

- **Next.js 15** (App Router) + TypeScript
- **Supabase**: login e banco de dados (com regras de segurança por usuário)
- **Stripe**: assinatura recorrente, teste de 7 dias, portal do cliente
- **Claude (Anthropic)**: gera a estratégia a partir da entrevista. Sem a chave, o app usa um **modo demonstração** com uma estratégia montada por regras.

---

## Como colocar no ar (passo a passo)

Você vai criar 5 contas. Todas têm plano gratuito para começar.

### 1. GitHub: guardar o código

1. Crie uma conta em <https://github.com>.
2. Crie um repositório **privado** chamado `1loop-creators`.
3. Envie esta pasta para o repositório (pelo GitHub Desktop é o jeito mais fácil: *Add existing repository* → *Publish*).

### 2. Supabase: login e banco de dados

1. Crie uma conta em <https://supabase.com> e um projeto novo (região **São Paulo**).
2. Vá em **SQL Editor → New query**, cole todo o conteúdo de `supabase/schema.sql` e clique em **Run**.
3. Vá em **Project Settings → API** e copie:
   - `Project URL` → `NEXT_PUBLIC_SUPABASE_URL`
   - `anon public` → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `service_role` → `SUPABASE_SERVICE_ROLE_KEY` (secreta, nunca compartilhe)
4. Em **Authentication → Sign In / Providers → Email**:
   - Para o fluxo mais fluido (cadastro → pagamento direto), **desligue "Confirm email"**.
   - Se preferir manter a confirmação, o app mostra o aviso e o link do e-mail leva o usuário ao pagamento.
5. Em **Authentication → URL Configuration**, coloque o endereço do site em *Site URL* e adicione `https://SEU-DOMINIO/auth/callback` em *Redirect URLs*.

### 3. Stripe: cobrança

1. Crie uma conta em <https://stripe.com> (dá para testar tudo no **modo de teste** antes de ativar a conta).
2. **Product catalog → Add product**, crie 3 produtos com preço **recorrente mensal em BRL**:
   - 1loop creators Basic: **R$ 97**
   - 1loop creators Pro: **R$ 197**
   - 1loop creators Multi: **R$ 497**

   Copie o ID de cada preço (`price_...`) para `STRIPE_PRICE_BASIC`, `STRIPE_PRICE_PRO` e `STRIPE_PRICE_MULTI`.
3. **Preço Founders** (opcional): em **Product catalog → Coupons**, crie dois cupons com duração **Forever**:
   - Founders Basic: **R$ 30 de desconto**, aplicado só ao produto Basic → `STRIPE_COUPON_FOUNDERS_BASIC`
   - Founders Pro: **R$ 50 de desconto**, aplicado só ao produto Pro → `STRIPE_COUPON_FOUNDERS_PRO`
   - Para limitar aos 1.000 primeiros, use *Limit the total number of times this coupon can be redeemed* = 1000. Quando acabar, o checkout passa a cobrar o preço cheio sozinho.
4. **Developers → API keys**: copie a *Secret key* → `STRIPE_SECRET_KEY`.
5. **Developers → Webhooks → Add endpoint**:
   - URL: `https://SEU-DOMINIO/api/stripe/webhook`
   - Eventos: `checkout.session.completed`, `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`
   - Copie o *Signing secret* → `STRIPE_WEBHOOK_SECRET`.
6. **Settings → Billing → Customer portal**: ative o portal e permita trocar cartão, mudar de plano (entre os 3 produtos) e cancelar.

### 4. Anthropic: a IA que monta a estratégia

1. Crie uma conta em <https://console.anthropic.com>, adicione créditos e gere uma chave em **API keys** → `ANTHROPIC_API_KEY`.
2. O modelo padrão está em `ANTHROPIC_MODEL`. Sem a chave, o app funciona em modo demonstração.

### 5. Vercel: publicar o site

1. Crie uma conta em <https://vercel.com> entrando com o GitHub.
2. **Add New → Project**, escolha o repositório `1loop-creators`.
3. Em **Environment Variables**, cole todas as variáveis do `.env.example` já preenchidas. Em `NEXT_PUBLIC_SITE_URL`, use o endereço final (ex.: `https://app.1loop.com.br`).
4. Clique em **Deploy**. Depois, aponte seu domínio em **Settings → Domains** e atualize as URLs no Supabase e no webhook do Stripe.

---

## Rodar no computador (para desenvolvimento)

Precisa de Node.js 20 ou mais novo.

```bash
npm install
cp .env.example .env.local   # e preencha os valores
npm run dev                  # abre em http://localhost:3000
```

Para o Stripe avisar o app local sobre as assinaturas, instale a [Stripe CLI](https://docs.stripe.com/stripe-cli) e rode em outro terminal:

```bash
stripe listen --forward-to localhost:3000/api/stripe/webhook
```

Use o `whsec_...` que ele mostrar em `STRIPE_WEBHOOK_SECRET`. Para pagar no modo de teste, use o cartão `4242 4242 4242 4242`, qualquer data futura e qualquer CVC.

## Organização do código

```
app/
  planos/              escolha do plano
  (auth)/cadastro/     cadastro (nome, e-mail, telefone, senha)
  (auth)/entrar/       login
  checkout/            cria a sessão de pagamento do Stripe
  bem-vindo/           retorno do pagamento → entrevista
  app/                 área logada (layout com menu e verificação da assinatura)
    entrevista/        entrevista com salvamento automático
    estrategia/        painel visual da estratégia
    conta/             plano e portal do Stripe
  api/estrategia/      gera a estratégia (Claude ou modo demonstração)
  api/stripe/          webhook e portal do cliente
components/            logo animado, entrevista, painel da estratégia
lib/                   planos, Supabase, Stripe, perguntas, geração da estratégia
supabase/schema.sql    tabelas e regras de segurança
```

## Segurança

- Dados de cartão são digitados só na página do Stripe; nunca passam pelo app.
- Cada usuário só lê e altera os próprios dados (Row Level Security no Supabase).
- O vínculo com o Stripe e o status da assinatura são gravados apenas pelo servidor.
- As chaves secretas (`SUPABASE_SERVICE_ROLE_KEY`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `ANTHROPIC_API_KEY`) ficam só nas variáveis de ambiente do servidor.

## Antes de lançar

- [ ] Escrever termos de uso e política de privacidade (LGPD) em `/termos` e `/privacidade`
- [ ] Testar o fluxo completo no modo de teste do Stripe
- [ ] Ativar a conta do Stripe (dados da empresa e conta bancária)
- [ ] Revisar os e-mails do Supabase (confirmação, redefinição de senha) em português
