# Odisse — Orçamentos

Ferramenta interna para gerar propostas comerciais (orçamentos de honorários)
de forma ágil, seguindo a metodologia CAU/AsBEA já usada pela Odisse na
planilha `Template_Odisse_PO.ods`. Roda inteiramente no navegador — sem
backend, sem servidor — e gera o PDF final também no navegador.

Este é o terceiro repositório da Odisse, ao lado de:
- `portfolio-odisse` — site institucional
- `projetos-odisse` — landing pages de venda

## Lógica de precificação — documentação completa

Todas as decisões sobre a fórmula de cálculo (modificadores por serviço,
critérios de complexidade, unificação de escopo/etapas, etc.) estão registradas
em detalhe no [`PRICING.md`](./PRICING.md) — inclusive o *porquê* de cada
escolha, não só o *como*. A ferramenta também tem uma página própria
(`precificacao.html`, link "Como funciona o cálculo" no menu) com um resumo
dessa mesma lógica, pensado para quem está preenchendo um orçamento e quer
tirar uma dúvida rápida.

## ⚠️ Antes de publicar

**Este repositório está público enquanto está sendo construído.** A senha
de acesso protege só a *página*, não o *código* — qualquer pessoa com o link
do repositório consegue ler o código-fonte, a lógica de precificação e
qualquer dado de cliente que for commitado. Enquanto isso:

- **Não commite dados reais de clientes.** Use só dados fictícios para testar.
- Assim que a ferramenta entrar em uso real, **assine o GitHub (Pro ou Team)
  e torne o repositório privado** em Settings → General → Danger Zone →
  Change visibility. O GitHub Pages continua funcionando normalmente em
  repositórios privados nos planos pagos.
- Dados reais de clientes de propostas geradas ficam no Cloudflare (Workers
  KV), não neste repositório — ver "Numeração automática" abaixo — então a
  numeração pode ser usada com segurança mesmo com o repositório público.

## Como rodar localmente

Como o app usa `fetch()` para carregar os arquivos de `data/*.json`, não dá
para simplesmente abrir o `index.html` direto no navegador (erro de CORS
com `file://`). Suba um servidor simples primeiro:

```bash
# Python (já vem instalado na maioria dos sistemas)
python3 -m http.server 8000

# ou, com Node instalado
npx serve .
```

Depois acesse `http://localhost:8000`.

## Como publicar no GitHub Pages

1. Crie o repositório no GitHub (conta `cidclementino`) e suba todos os arquivos.
2. Em **Settings → Pages**, source: `Deploy from a branch`, branch `main`,
   pasta `/ (root)`.
3. Publica em `https://cidclementino.github.io/nome-do-repositorio/`.
4. **Trocar a senha de acesso** (faça isso antes do primeiro uso real):
   ```bash
   python3 -c "import hashlib; print(hashlib.sha256('SUA_SENHA_AQUI'.encode()).hexdigest())"
   ```
   Copie o resultado e cole em `config.js`, na constante `CONFIG.passwordHash`.
   A senha de fábrica é `odisse2026` — troque assim que possível.

## Acesso (login.html)

A senha agora é pedida numa página própria (`login.html`), separada do
formulário. Depois de entrar uma vez, o navegador lembra (via
`localStorage`) e não pede de novo — até alguém clicar em **Sair**, no
canto superior direito do app.

## Numeração automática de propostas & histórico

O número da proposta (`PC0XX/AAAA`) é gerado automaticamente na etapa de
revisão, e não mais digitado à mão. Isso funciona através de um pequeno
Worker do Cloudflare (pasta `worker/`), que guarda o contador e uma cópia
de cada proposta gerada — de graça, no plano gratuito do Cloudflare (ver
`worker/README.md` para detalhes de custo).

- **Com o Worker configurado** (recomendado): siga `worker/README.md` para
  colocá-lo no ar (leva uns 10 minutos, uma vez só) e cole a URL gerada em
  `config.js` → `CONFIG.workerUrl`. A partir daí, o número é compartilhado
  entre todo mundo que usa a ferramenta, e a página `historico.html` lista
  todas as propostas geradas (número, data, cliente), com um botão para
  baixar o PDF de novo a qualquer momento.
- **Sem o Worker**: a numeração cai para um contador local, salvo só no
  navegador de quem está usando — funciona, mas cada pessoa/computador tem
  sua própria contagem, e a página de histórico fica vazia.

Nenhum token ou senha extra precisa ser digitado em lugar nenhum — a
autorização fica só no Worker, configurada uma única vez por quem publica
a ferramenta.

## Histórico de propostas (historico.html)

Lista simples, não editável: número, data e cliente de cada proposta já
gerada, com um botão "Baixar PDF" que reconstrói o documento na hora a
partir dos dados salvos (não é o PDF em si que fica guardado, só os dados
— o documento é remontado de forma idêntica ao original). Só funciona com
o Worker do Cloudflare configurado (ver seção acima).

## Endereço com busca automática por CEP

O campo de CEP (na etapa "Cliente & projeto") busca o endereço
automaticamente via [ViaCEP](https://viacep.com.br) (serviço público,
gratuito, sem necessidade de chave de API) assim que os 8 dígitos são
preenchidos. Logradouro, bairro e cidade/UF vêm preenchidos e continuam
editáveis, e há campos separados para número e complemento (apartamento,
bloco, etc.).

## Estrutura

```
login.html            → página de senha (separada do app)
index.html          → shell do app (formulário)
historico.html         → lista de propostas já geradas, com botão de baixar de novo
config.js             → senha (hash) e URL do Worker do Cloudflare
auth.js                → autenticação (mantém a sessão entre visitas)
store.js                 → numeração automática + histórico, via o Worker do Cloudflare
styles.css           → estilos (tema escuro, identidade Odisse)
data-loader.js        → carrega os data/*.json
calc.js                → motor de cálculo (ver "Como o cálculo funciona" abaixo)
steps.js                → renderização e lógica de cada etapa do formulário
pdf.js                    → gera o PDF final (jsPDF + autotable)
app.js                     → orquestração geral (navegação, ficha de valores)
worker/                     → Worker do Cloudflare (numeração + histórico) — ver worker/README.md
data/
  tipologias.json          → tabela de tipologias × CUB × fator de adequação × BH
  cub.json                  → valores de CUB vigentes (atualizado mensalmente)
  fator-percentual.json      → tabela de fator percentual por faixa de área/categoria
  ic-criterios.json           → os 10 critérios do Índice de Complexidade
  redutor-repeticao.json       → redutor por quantidade de repetições
  reducao-escopo.json           → percentuais para contratação parcial
  juros-parcelamento.json        → juros do parcelamento no cartão (2x–12x)
  etapas-pagamento.json           → divisão de pagamento por fase (não usada no
                                     cálculo atual — ver nota abaixo)
  modificadores-intervencao.json   → multiplicador por tipo de intervenção
                                       (nova edificação, reforma, interiores...)
  etapas.json                       → as 9 etapas de desenvolvimento de projeto,
                                       com descrição padrão e duração-base
  escopo-master.json                 → banco de itens de escopo (compreende /
                                        não compreende), editável na própria página
  servicos-odisse.json                → os 9 serviços do grid da Odisse, cada um
                                         com predefinições de IC, escopo, etapas e
                                         quais macro categorias da tabela CAU ele
                                         engloba (ver "Classificação" abaixo)
scripts/update_cub.py                  → busca o PDF do CUB no Sinduscon-JP e
                                          atualiza data/cub.json
.github/workflows/update-cub.yml         → roda o script acima todo dia 8 do mês
```

## Classificação: serviço Odisse × macro categoria CAU

O formulário não pede mais a macro categoria da tabela CAU como um campo
separado — isso duplicava o que o "Serviço Odisse" já define. Em vez
disso, cada serviço do grid da Odisse já sabe quais macro categorias CAU
ele engloba (campo `macro_categorias` em `servicos-odisse.json`), e a
lista de tipologias específicas é filtrada automaticamente:

| Serviço Odisse | Macro categorias CAU |
|---|---|
| Residencial | HabitacionalUnifamiliar |
| Edifícios Mistos e Multifamiliares | HabitacionalMultifamiliar, HabitaçõesEspeciais |
| Projetos Comerciais | Hospedagem, Comércio, Serviços, Diversos |
| Projetos Institucionais | Educação, Saúde, Esportes, Lazer, Cultura |
| Reforma, Estudo de Viabilidade, Laudos e Regularização, Consultoria Remota, Design de Interiores | (todas — são serviços transversais, que podem se aplicar a qualquer tipologia) |

## Como o cálculo funciona

A lógica replica a planilha original, documentada linha a linha nos
comentários de `calc.js`. Resumo:

```
BH    = CUB vigente (código da tipologia) × fator de adequação
CEO   = BH × área construída
fp    = Fator Percentual (tabela por faixa de área × categoria 1–4)
IC    = média dos 10 critérios de complexidade (0.7 / 1.0 / 1.3 cada)
R     = razão entre área projetada e construída (externa entra a 25%)
redutor = redutor por repetição de áreas

valor de tabela (CAU) = CEO × fp × IC
valor ajustado         = valor de tabela × redutor × R
valor com modificador    = valor ajustado × modificador de intervenção
valor de mercado          = valor com modificador ÷ fator de ajuste
valor final                = valor de mercado × % do escopo de contratação
```

**Duas diferenças deliberadas em relação à planilha original**, para que
o cálculo generalize bem quando as etapas são escolhidas granularmente
(e não sempre como um "projeto completo" fixo):

1. **BH é recalculado a partir do CUB vigente**, nunca de um valor
   congelado — assim a atualização mensal do CUB entra automaticamente
   no cálculo.
2. **A planilha original**, no exemplo que usamos para validar (`PC050`),
   calculava o redutor de repetição e a razão R mas não os aplicava de
   fato no valor final — aqui eles **são aplicados de forma consistente**.
   Isso muda o resultado quando há repetições (`contagem de repetições > 0`).
   Se preferir o comportamento antigo, é só fixar o redutor em `1` na
   etapa de Classificação.
3. **A distribuição do honorário entre etapas** (para a tabela de
   honorários do PDF) é proporcional à duração (semanas) de cada etapa
   selecionada, em vez da divisão fixa "Entrada 30% / Estudo Preliminar
   20% / Projeto Legal 20% / Executivo 30%" da planilha — que só fazia
   sentido quando as 4 fases eram sempre contratadas por inteiro.

## Atualização automática do CUB

O workflow `.github/workflows/update-cub.yml` roda todo dia 8 do mês,
busca o PDF mais recente em sindusconjp.com.br/pesquisas-e-indices/,
tenta extrair a tabela de valores e atualiza `data/cub.json`. Se a
extração falhar (o layout do PDF mudou, por exemplo), o script **não
sobrescreve nada** — ele grava um aviso em `data/cub-status.json` para
revisão manual. Você pode rodar manualmente a qualquer momento pela aba
**Actions** do GitHub, botão "Run workflow".

## Registro de acesso (limitação atual)

A ferramenta registra localmente (`localStorage`, só neste navegador)
quem entrou e quando, mas **isso não é compartilhado entre pessoas ou
dispositivos** — é só um histórico pessoal do computador que acessou.
Um registro de verdade, compartilhado entre toda a equipe, precisaria de
algum backend (por exemplo, um Google Form/Apps Script gratuito recebendo
um webhook a cada acesso). Posso ajudar a montar isso depois, se quiser.

## Editando os dados de referência

Todos os textos e tabelas ficam em `data/*.json` — não é necessário mexer
no código para:
- Adicionar/editar itens de escopo (`escopo-master.json`)
- Ajustar a predefinição de complexidade de um serviço (`servicos-odisse.json`)
- Mudar a descrição padrão ou duração-base de uma etapa (`etapas.json`)
- Corrigir manualmente um valor de CUB (`cub.json`), se a automação falhar
