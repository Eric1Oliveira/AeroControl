# AeroControl — MICCA digital

Controle de componentes da frota por **horas e por data** (o que ocorrer primeiro), no formato do MICCA da ANAC.

## Abrir

Dois cliques em `index.html`. Não precisa de servidor nem instalação (só as fontes vêm da internet).

## Estrutura

| Arquivo | O que faz |
|---|---|
| `index.html` | Casca da página |
| `css/style.css` | Todo o visual (tema claro e escuro, impressão A4) |
| `js/regras.js` | Cálculos do MICCA: vencimento, disponibilidade, TSN/TSO, previsão |
| `js/dados.js` | **Único arquivo que lê/grava.** Hoje localStorage; trocar por Supabase aqui |
| `js/semente.js` | Demonstração: PR-ELF transcrito dos 3 PDFs + 7 aeronaves fictícias |
| `js/app.js` | Rotas, topo, busca global, diálogos, faixa de cabeçalho |
| `js/graficos.js` | Gráficos do painel em SVG/HTML puro (rosca, colunas, anel, linha do tempo) |
| `js/acoes.js` | Lançar horas, cumprimento, item, aeronave, configurações |
| `js/planilha.js` | Importar/exportar CSV (abre no Excel) |
| `js/telas/*.js` | Painel, Aeronave, Vencimentos, Imprimir |

## Regras de cálculo

- Vencimento por horas = TSN da célula no cumprimento + menor limite em horas (TBO/TLV).
- Vencimento por data = data do cumprimento + menor intervalo (d/m/a), ou validade fixa.
- Disponível = vencimento − TSN atual / vencimento − data de referência.
- Previsão = dias até acabar as horas, na utilização média (lançamentos dos últimos 180 dias ou cadastro).
- Atenção: faltando ≤ 30 dias ou ≤ 25 h (configurável), limitado a 25% do intervalo.

## Conferência com o papel (PR-ELF, 11/10/2023)

75 de 82 itens controlados batem exatamente. As 7 diferenças estão no papel:
itens de 30 e 90 dias contados como 1 e 3 meses (2 dias além do limite) e arredondamentos de 1–2 dias.
