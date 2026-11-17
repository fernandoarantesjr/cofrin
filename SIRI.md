# Lançar gasto pela Siri (iPhone)

Diga **"E aí Siri, gasto no Cofrin"**, fale o gasto e pronto.
A função `siri` no Supabase (código em `siri-function.ts`) entende a frase e grava.

## Montar o atalho (uma vez em cada iPhone)

1. Abra o app **Atalhos** → toque em **＋**.
2. Toque no nome lá em cima e chame de **Gasto no Cofrin** (é o que você vai falar pra Siri).
3. Adicione a ação **Ditar Texto**
   - Idioma: Português (Brasil) · Parar de ouvir: Após Pausa
4. Adicione a ação **Obter Conteúdo do URL**
   - URL: `https://thsdxhvikpuhfzcohano.supabase.co/functions/v1/siri`
   - Toque em ▸ (mostrar mais): **Método: POST** · **Corpo da Solicitação: JSON**
   - Adicione 3 campos do tipo Texto:
     - `email` → seu e-mail do Cofrin (ex: fernando@cofrin.app)
     - `senha` → sua senha do Cofrin
     - `texto` → toque e escolha a variável **Texto Ditado**
5. Adicione a ação **Falar Texto** com **Conteúdo do URL** (a Siri responde o que anotou).
6. Pronto. Teste: "E aí Siri, gasto no Cofrin" → "85 mil no iFood".

## Atalhos ainda mais rápidos
- **Toque nas costas:** Ajustes → Acessibilidade → Toque → Toque nas Costas → Toque duplo → Gasto no Cofrin.
- **Botão de Ação** (iPhone 15 Pro ou mais novo): Ajustes → Botão de Ação → Atalho → Gasto no Cofrin.
- **Tela de bloqueio:** adicione o widget do app Atalhos.

## Exemplos que ele entende
- "85 mil no iFood"
- "mercado 230 mil e uber 30 mil"
- "tênis 450 mil em 3 vezes"
- "gasolina 200 mil ontem"
- "guardei 500 mil na reserva"
- "recebi 2400 reais Fernando" (usa a última cotação salva no app)
