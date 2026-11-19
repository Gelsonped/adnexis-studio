# HANDOFF: junção do Impulso ao AdNexis

Data da sessão: 18/11/2026.
Estado em uma frase: **só houve análise e planejamento. Nenhum código foi escrito ou alterado.** Os dois arquivos originais seguem intactos e vão junto no .zip.

Legenda: **[dito]** = o usuário afirmou nesta sessão · **[visto]** = observei no código dos arquivos · **[recomendado]** = sugestão minha, ainda não aprovada · **[incerto]** = não confirmado.

---

## 1. O que é o produto

**Objetivo [dito]:** tomar uma decisão sobre juntar duas plataformas (AdNexis e Impulso) ou criar o recurso novo dentro do AdNexis, e descobrir o que é preciso para o AdNexis ficar funcional e automatizado (ou semi).

**Para quem [dito]:** uso próprio no primeiro momento.

**Situação atual [dito]:**
- AdNexis: já existe, faltando ajustes e conclusão.
- Impulso: também existe, mas está bem no início, com muito a criar e desenvolver.

**Fora de escopo por enquanto [recomendado]:** autopilot (otimização automática de campanhas), pagamentos, venda do produto a terceiros. O usuário não confirmou esse corte.

**[incerto]** Qual AdNexis é a base. O arquivo enviado se chama `AdNexis-v4-preview.html` e seu título interno é **"AdNexis Negócios"** (painel de vendas e atendimento). O usuário chamou de "AdNexis" o que enviou. Se existir outro AdNexis (por exemplo, um focado só em gestão de anúncios), ele **não foi enviado nem analisado**. Confirmar antes de começar.

---

## 2. Regras inegociáveis

Nenhuma regra foi imposta pelo usuário nesta sessão. As abaixo foram propostas por mim no prompt de execução por fases **[recomendado]**:
1. Chaves de API **nunca** dentro do HTML.
2. Fazer backup antes de qualquer alteração.
3. Não mudar o visual nem as telas que já existem no AdNexis.
4. Uma fase por vez, com um teste simples ao final de cada.
5. Avisar sempre o que é demonstração (sem função real).
6. Modo **semi-automático** (a IA propõe, o usuário aprova) até haver resultados reais medidos. Controle do orçamento fica com o usuário.
7. Usar apenas as APIs oficiais do WhatsApp e do Instagram, para evitar risco de banimento.

---

## 3. Arquitetura

**Hoje não existe projeto com pastas.** São dois arquivos HTML independentes, sem servidor e sem banco.

### Impulso, `Impulso__criador_de_anúncios_com_IA__Fase_1.html` [visto]
- 181 linhas, ~16 KB. HTML + CSS + JavaScript puro, em um arquivo.
- Telas: **Início**, **Criar anúncios**, **Meus anúncios**.
- Fluxo: formulário (produto, descrição, público, oferta, objetivo, quantidade, tom, idioma) → a IA escreve 3 a 5 anúncios com ângulos diferentes → o **"Juiz"** (segunda chamada de IA) dá nota de 0 a 10, veredito (aprovado/ajustar/reprovar), motivo e correção → o usuário copia, salva e exporta (.txt e .csv).
- Limites embutidos no prompt: título até 40 caracteres, texto até 125, descrição até 30. Botões permitidos: Saiba mais, Comprar agora, Fale conosco, Enviar mensagem, Cadastre-se. Regras: sem promessa garantida, sem antes e depois, sem referência a características pessoais do leitor, sem MAIÚSCULAS em excesso.
- **IA:** usa `claude.use("sample")`, função que só existe **dentro do claude.ai**. Fora dele a página mostra um erro. Os downloads usam `claude.use("downloads")`, com o mesmo limite.
- **Dados:** `localStorage`, chave `impulso:v1` (anúncios salvos e contadores).
- **Visual:** fontes Bricolage Grotesque e Source Sans 3; acento âmbar `#F2A516`, azul-escuro `#0F2A43`; modo claro e escuro.
- Aparecem como "em breve": *Testar no Meta* e *Autopilot*.

### AdNexis Negócios, `AdNexis-v4-preview.html` [visto]
- 1.965 linhas, ~256 KB. HTML + CSS + JavaScript puro, um arquivo, tudo dentro de uma função única.
- Telas identificadas pelos cabeçalhos: Painel de vendas, Produtos, Pedidos, Funil, Financeiro, Prospectar, WhatsApp, Funil Instagram (Direct), Central da IA, Disparos, Agenda, Criar negócio, Recebimentos, Aprovações, API empresarial, Configurações, Ajuda, Chamados, Número de suporte.
- **Dados:** `localStorage`, chave `adnexis-negocios-v1`. Há botão de apagar tudo.
- **Selos de estado encontrados:** 5 "exemplo", 1 "Demonstração" (a tela de API, com endereço fictício `api.adnexis.example/v1`) e 2 "em breve".
- **Integrações reais:** não encontrei nenhuma chamada a servidor, WhatsApp, Instagram ou Meta. A busca por `fetch(` não retornou nada.
- **IA:** há **uma** ocorrência de `claude.use("sample")`. **[incerto]** Não abri esse trecho. Não sei qual tela usa nem o que gera.
- **Visual:** fontes Bricolage Grotesque e DM Sans; logo "adnexis" com marca vermelha.

### Tecnologias previstas, todas [recomendado] e ainda não escolhidas
| Necessidade | Sugestão |
|---|---|
| Hospedagem e servidor | Vercel (funções serverless) |
| IA | API da Anthropic (Claude) |
| Banco e login | Supabase |
| Publicar e ler resultados | Meta Marketing API |
| Atendimento | WhatsApp Cloud API e Instagram Messaging API |
| Tarefas agendadas | Cron da Vercel ou Supabase |
| Imagens dos anúncios | Gerador de imagem por API (a definir) |

**Variáveis de ambiente:** ainda não existem. Prováveis: chave da API da Claude, URL e chave do Supabase, credenciais do app Meta. **[incerto]** Os nomes não foram definidos.

---

## 4. O que está pronto

- Impulso: fluxo completo de criar, julgar, salvar e exportar, **mas só funciona dentro do claude.ai**.
- AdNexis Negócios: interface ampla e navegável, com os dados salvos no navegador. **[incerto]** Quais telas têm lógica real e quais são só visuais. Só vi os selos de "exemplo/demonstração".
- Regras de negócio: apenas as do Juiz do Impulso (políticas do Meta no prompt).
- **Testes: não existem.**

---

## 5. Decisões tomadas

Nenhuma decisão foi **confirmada** pelo usuário. Só há recomendações minhas:

| Recomendação | Motivo | Descartado |
|---|---|---|
| Aproveitar o Impulso como módulo "Anúncios" dentro do AdNexis | O Impulso tem os prompts de criação e do Juiz e o fluxo Criar → Juiz → Exportar, que o AdNexis não tinha (até onde vi). O AdNexis traz menu, funil e atendimento. Dá o encadeamento anúncio → conversa → funil → pedido | Recriar tudo do zero: jogaria fora o que já funciona |
| Primeiro o servidor mínimo (Vercel + Supabase + API da Claude) | Sem servidor nada vira automático e as chaves ficam expostas | Ligar Meta e WhatsApp antes: dependem de aprovações externas demoradas |
| Começar semi-automático | Sem resultados medidos, uma regra errada pode gastar orçamento | Autopilot desde o início |

**Visto no AdNexis, mas não aprofundado:** o estado interno tem `creatives` (criativos) e uma aba de mídia. Eu afirmei na análise que o AdNexis "não tem funções de criar anúncio". **Isso foi uma conclusão forte demais.** O que posso afirmar é que não encontrei menção a Meta Ads nem a campanhas. A área de criativos **não foi inspecionada**.

---

## 6. Backlog (ordem de prioridade)

| # | Item | Critério de "pronto" | Dificuldade (estimativa minha) |
|---|---|---|---|
| 0 | Confirmar qual AdNexis é a base e fazer backup | Usuário confirma por escrito; cópias guardadas | 1/5 |
| 1 | Módulo "Anúncios" dentro do AdNexis (copiar o Impulso no mesmo padrão visual) | Criar, julgar e salvar um anúncio de energia solar dentro do AdNexis | 2/5 |
| 2 | Função na Vercel chamando a API da Claude | O anúncio é gerado no link próprio, fora do claude.ai, sem chave no HTML | 3/5 |
| 3 | Supabase (login e dados) no lugar do `localStorage` | Os mesmos anúncios aparecem em outro aparelho | 3/5 |
| 4 | Meta: publicar e ler resultados; WhatsApp e Direct reais | App aprovado no Meta; um anúncio publicado e seu resultado lido | 4/5 |
| 5 | Autopilot com limite de orçamento | Só após resultados reais medidos; regras testadas em valor baixo | 5/5 |

Colocar o pedido de aprovação do app Meta **em paralelo** com os itens 1 a 3.

---

## 7. Depende de mim (usuário)

- Dizer qual AdNexis é a base (item 0).
- Contas e chaves: Vercel, Supabase, API da Anthropic. **[incerto]** Não sei quais já existem.
- Criar o app no Meta for Developers e passar pela revisão.
- Número de WhatsApp verificado e modelos de mensagem aprovados.
- Testes reais (anúncios de verdade e dinheiro de verdade).
- Decidir o limite de orçamento antes de qualquer automação.

---

## 8. Riscos e o que NÃO foi validado

- **Nada foi executado nem testado.** A análise foi leitura estática do código. Não abri os arquivos no navegador.
- Do Impulso li o arquivo inteiro, **mas uma linha do prompt do Juiz apareceu truncada** na leitura. A regra exata de aprovado/ajustar/reprovar não foi confirmada.
- Do AdNexis li apenas o início do script e fiz buscas por palavras-chave. **Não li as 1.965 linhas.** A lista de telas veio dos cabeçalhos, e pode haver telas que escaparam.
- As **notas de dificuldade (1/5 a 5/5) são estimativas minhas**, não medidas.
- "Revisão do app pelo Meta pode levar semanas" é uma estimativa geral. Não pesquisei prazos atuais.
- Nomes e regras atuais das APIs (Meta, WhatsApp, Supabase, Vercel) vêm do meu conhecimento e **não foram checados na web** nesta sessão. Conferir antes de contar com eles.
- Risco técnico: a IA dos dois arquivos depende do claude.ai. O módulo copiado não funcionará fora dele até a fase 2.
- Risco de dados: duas chaves de `localStorage` diferentes. Unir exige migração.

---

## 9. Como rodar e testar

**Não há comandos nem projeto instalado.** Hoje:
- Abrir cada .html no navegador para ver a interface.
- A geração de anúncios do Impulso só funciona se a página estiver aberta pelo claude.ai.

Comandos de build, deploy e testes serão definidos a partir da fase 2.

---

## 10. Como eu prefiro trabalhar

- Português do Brasil.
- Pedidos estruturados com **Contexto, Objetivo, Público, Situação atual e Restrições**; quer análise, soluções e apoio à decisão.
- Gosta de visão por fases, com organograma e prompts prontos.
- **[incerto]** Nível de programação: iniciante, quer passos simples (não dito nesta sessão, confirmar).
- Ficou em aberto: usuário não respondeu se quer que eu execute a **Fase 1** agora.

---

## Anexo: prompt de execução por fases (proposto nesta sessão)

```
Você vai me ajudar a juntar o "Impulso" (criador de anúncios com IA)
ao "AdNexis Negócios", criando um módulo novo chamado "Anúncios".

Contexto:
- Sou iniciante em programação. Explique cada passo de forma simples,
  com o que fazer, onde clicar e o que esperar ver.
- Uso próprio no primeiro momento.
- Sou representante de energia solar (público: casas e pequenos
  comércios). O tom dos anúncios deve ser simples, direto e confiável,
  sem exageros.
- Arquivos: AdNexis-v4-preview.html (base) e
  Impulso__criador_de_anúncios_com_IA__Fase_1.html (módulo a migrar).

Regras:
1. Trabalhe UMA fase por vez e só avance quando eu disser "ok".
2. Antes de qualquer alteração, me lembre de fazer backup.
3. Não mude o visual nem as telas que já existem no AdNexis.
4. Nunca coloque chaves de API dentro do HTML.
5. Ao final de cada fase, me dê um teste simples para confirmar que
   funcionou.
6. Se algo for demonstração (sem função real), avise.

Fases:
FASE 1: Copiar o fluxo do Impulso (Criar anúncios, Juiz, Meus
  anúncios, exportar) para uma nova tela "Anúncios" no AdNexis, no
  mesmo padrão visual. Manter os prompts e as regras de política do
  Meta. A IA pode continuar simulada ou presa ao claude.ai por enquanto.
FASE 2: Criar uma função na Vercel que chama a API da Claude, e
  trocar a chamada do módulo para usar essa função.
FASE 3: Trocar o localStorage por Supabase (login e dados dos anúncios).
FASE 4: (só depois) Conexão com Meta Marketing API e WhatsApp Cloud API.
FASE 5: (só depois) Regras do autopilot com limite de orçamento.

Comece pela FASE 1: liste os passos que vai executar e me mostre o
plano antes de mexer no código.
```
