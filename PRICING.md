# Lógica de Precificação — Odisse Orçamentos

Este documento registra as decisões tomadas sobre a lógica de cálculo de honorários,
para que qualquer pessoa (inclusive uma versão futura desta conversa) entenda o
*porquê* por trás de cada peça, não só o *como*. Complementa os comentários em
`calc.js`, que descrevem a fórmula linha a linha.

## Visão geral da fórmula

```
BH    = CUB vigente (código da tipologia) × Fator de Adequação da tipologia
CEO   = BH × Área Edificada Prevista
fp    = Fator Percentual (tabela por faixa de área × categoria da edificação)
IC    = média aritmética de 11 critérios de complexidade (0,7 / 1,0 / 1,3 cada)
redutor = redutor por repetição de unidades/áreas
R     = (Área Edificada + Área Externa de Intervenção × 0,25) ÷ Área Edificada

valor_CAU       = CEO × fp × IC
valor_ajustado  = valor_CAU × redutor × R
valor_modificado = valor_ajustado × Modificador do Serviço Odisse
valor_mercado   = valor_modificado ÷ Fator de Ajuste de Mercado
Honorário Final = valor_mercado × % do Escopo de Contratação
```

A Área do Imóvel/Terreno, o Teto Orçamentário do cliente e o Prazo Esperado do
cliente **não entram nesta fórmula** — são informativos/comparativos (geram os
alertas da barra lateral), não fatores de cálculo.

---

## 1. Modificador de Intervenção → consolidado nos Serviços Odisse

**Decisão:** o modificador deixou de vir de uma tabela genérica ligada à
metodologia CAU (Tipo de Intervenção, com Nova Edificação/Reforma/Interiores/
Decoração/Adequação de Acessibilidade/Levantamento Arquitetônico) e passou a
ser uma propriedade direta de cada um dos 9 Serviços Odisse.

**Origem dos valores:** conferidos contra `Template_Odisse_PO.ods`, aba "Base de
Dados", linhas 116-122 (seção "Modificador de Fator Percentual") — batem exatos,
não foram inventados.

| Serviço Odisse | Modificador(es) | Origem do valor |
|---|---|---|
| Projeto de Nova Edificação Residencial | 1,00 | Nova Edificação (CAU) |
| Projeto de Nova Edificação Multifamiliar e/ou Mista | 1,00 | Nova Edificação (CAU) |
| Projeto de Nova Edificação Comercial | 1,00 | Nova Edificação (CAU) |
| Projeto de Nova Edificação Institucional | 1,00 | Nova Edificação (CAU) |
| Projeto de Reforma | 1,25 | Reforma (CAU) |
| Projeto de Interiores e Ambientação | 1,50 (Projeto de Interiores) ou 0,75 (Ambientação) — escolha do usuário | Interiores / Decoração (CAU) |
| Consultoria Remota | 0,15 | Levantamento Arquitetônico (CAU), por analogia |
| Estudo de Viabilidade | 0,20 | Match exato: "Estudo de Viabilidade Econômico-Financeira de Projeto de Edificações" (linha 167 da planilha) — mais preciso que a analogia inicial com Levantamento Arquitetônico |
| Laudos e Regularização Técnica | 0,15 | Levantamento Arquitetônico (CAU), por analogia — nenhum item da seção "Relatórios Técnicos" bateu melhor |

**Eliminado:** "Adequação de Acessibilidade" (0,20) saiu do modelo por completo —
não é mais opção de nenhum serviço.

**Lógica por trás dos valores:** Nova Edificação = 1,0 é o referencial neutro.
Os demais deslocam esse valor conforme a intensidade de trabalho por m² relativa
a um projeto do zero — reforma e interiores exigem mais esforço por m² (mais
incerteza, mais detalhamento), consultoria/viabilidade/laudos exigem menos
(escopo mais estreito, menos técnico).

---

## 2. Índice de Complexidade — 11 critérios

**Adicionado:** Demanda de material para mídias (critério novo, não vem da
tabela CAU original — específico da Odisse, dado que a marca de conteúdo é um
ativo real do escritório).

- Baixo: sem necessidade de material fotográfico/audiovisual voltado à divulgação
- Médio: registro fotográfico padrão das etapas e do resultado final, para portfólio
- Alto: produção de conteúdo dedicado (vídeo, ensaio fotográfico, making-of) para mídias e redes sociais

**Considerado e descartado:** um critério de "Grau de Inovação em materiais/técnicas"
— decisão foi não adicionar, por já estar implicitamente capturado em "Quantidade
de especialistas", "Grau de detalhamento" e "Expectativa plástica".

**Dois critérios deixaram de ser preenchidos manualmente e viraram indicadores
calculados**, por serem os mais vagos/subjetivos dos dez originais:

### Grau de Detalhamento (calculado, exibido em "Etapas & Cronograma")
```
Alto:  etapa "Detalhamento Executivo Complementar" selecionada
Médio: alguma etapa da fase "Projeto Executivo" selecionada, mas sem Detalhamento Executivo Complementar
Baixo: nenhuma etapa de "Projeto Executivo" selecionada
```

### Empenho ao Projeto vs Porte (calculado, exibido em "Etapas & Cronograma")
```
Baixo:  até 3 subitens de escopo marcados (soma de todas as etapas + Assessoramento)
Médio:  de 4 a 6 subitens marcados
Alto:   7 ou mais subitens marcados
```

Pendente de recalibração: os cortes 3 / 4-6 / 7+ foram definidos ainda
com a lista antiga de escopo (~14 itens possíveis). Depois da unificação do
escopo com os subitens das etapas (item 3 abaixo), a base de contagem mudou —
agora soma subitens de todas as etapas selecionadas, tipicamente um número bem
maior. Os cortes continuam com esses valores por acordo explícito, mas devem
ser revisados assim que houver uso real da ferramenta para calibrar.

**Onde cada critério mora agora:**

| Critério | Onde é preenchido |
|---|---|
| Empenho ao Projeto vs Porte | Calculado — badge em "Etapas & Cronograma" |
| Quantidade de especialistas | Manual — "Índice de Complexidade" |
| Quantidade de aprovações | Manual — "Índice de Complexidade" |
| Grau de detalhamento | Calculado — badge em "Etapas & Cronograma" |
| Grau de responsabilidade civil | Manual — "Índice de Complexidade" |
| Grau de intervenção do cliente | Manual — "Índice de Complexidade" |
| Expectativa plástica | Manual — "Índice de Complexidade" (padrão "Médio" em todos os serviços) |
| Grau de controle de custo | Manual — "Índice de Complexidade" |
| Indefinição do escopo | Manual — "Classificação do Serviço" (junto das áreas) |
| Indefinição do prazo | Manual — "Índice de Complexidade" |
| Demanda de material para mídias | Manual — "Índice de Complexidade" |

---

## 3. Unificação de Escopo + Etapas

**Decisão:** as duas listas separadas de escopo ("Compreende o serviço" /
"Não compreende") deixaram de existir como página própria. Os itens de escopo
agora são os subitens (entregáveis) de cada etapa — ao marcar uma etapa
("Programação Projetual", por exemplo), seus subitens ficam disponíveis para
refinar o que está incluso.

- Cada etapa que entra no `etapas_default` de um serviço já vem com todos os
  seus subitens pré-marcados — ajustável livremente depois.
- No PDF: subitem marcado -> "Compreende o serviço". Subitem não marcado ->
  "Não compreende esta proposta" — mesmo que pertença a uma etapa que nem foi
  selecionada. Isso pode gerar uma lista de exclusão longa para serviços
  enxutos (ex: Consultoria Remota listando dezenas de itens não inclusos que
  nem fariam sentido cogitar). Aceito assim por ora — ver pendência abaixo.

### Bloco "Assessoramento" (independente)

Existem itens que não pertencem a nenhuma etapa específica de projeto — hoje
eram um switch único ("incluir acompanhamento mensal de obra"). Viraram um
bloco à parte, fora do conjunto de etapas e do cronograma (sem duração em
semanas, sem entrar na soma de prazo total):

- Acompanhamento mensal da execução da obra
- Suporte técnico ao cliente/construtora para esclarecimento do projeto
- Suporte técnico em tratativas com fornecedores

No PDF, o texto é montado dinamicamente: só entram a abertura fixa + as frases
dos subitens efetivamente marcados. Se nenhum subitem for marcado, o bloco
inteiro some do documento.

---

## Pendências para revisão futura

1. Recalibrar os cortes de "Empenho ao Projeto vs Porte" (3 / 4-6 / 7+)
   agora que a base de contagem mudou (subitens de etapas em vez da lista
   plana antiga).
2. Formulário Tipo X vs Tipo Y — no futuro, separar dois fluxos de
   preenchimento: um para serviços com documentação técnica extensiva
   (Nova Edificação em suas variações, Reforma, Interiores) e outro mais
   enxuto para serviços de consulta/reunião, sem tanto desenho (Consultoria
   Remota, Estudo de Viabilidade, possivelmente Laudos). Motivo: esses
   serviços "enxutos" não têm etapas de projeto reais para ancorar seu
   escopo, e hoje ficam com listas de exclusão desproporcionalmente longas
   no PDF.
3. Lista de escopo por serviço, ao invés de tudo-ou-nada — hoje, se um
   item não pertence a uma sub-lista "relevante" de um serviço, ele ainda
   aparece como exclusão explícita no PDF. Uma opção futura seria cada
   serviço ter sua própria lista de itens relevantes, e itens fora dela
   simplesmente não aparecerem no documento (nem como inclusão, nem como
   exclusão).
