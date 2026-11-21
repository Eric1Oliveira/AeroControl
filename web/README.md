# AeroControl — MICCA digital

Controle de componentes da frota por **horas e por data** (o que ocorrer primeiro), no formato do MICCA da ANAC.

## Abrir

Dois cliques em `index.html` (ou publicar a pasta `web/` em qualquer hospedagem estática).
Precisa de internet: os dados ficam no **Supabase** e só entra quem fez login e está autorizado.

## Supabase — configurar uma vez

1. No painel do projeto, abra **SQL Editor**. No fim de `../supabase/schema.sql`, troque o e-mail de exemplo
   pelos e-mails de quem pode entrar. Cole o arquivo e rode **Run**.
2. Ainda no SQL Editor, cole e rode `../supabase/carga-pr-elf.sql`: sobe o PR-ELF (147 itens do MICCA em papel).
3. Em **Authentication › Users › Add user › Create new user**, crie cada usuário (mesmo e-mail da lista), com
   *Auto Confirm User* marcado.
4. Recomendado: em **Authentication › Sign In / Providers**, desligue *Allow new users to sign up*. Mesmo ligado,
   quem não está na lista `autorizados` não vê nem grava nada.

- **Novo usuário:** criar em Authentication *e* rodar `insert into autorizados (email) values ('fulano@empresa.com');`
- **Tirar acesso:** `delete from autorizados where email = 'fulano@empresa.com';`
- **Senha esquecida:** trocar em Authentication › Users (o "esqueci a senha" por e-mail fica para quando o site tiver endereço publicado).
- Endereço e chave pública do projeto ficam no topo de `js/dados.js`. A chave *publishable* pode ficar no site; a
  segurança está nas regras do banco (RLS), não nela.

## Importar planilha

Na aeronave: menu **⋯ › Importar planilha**. Aceita **Excel (.xlsx)** e CSV; o arquivo de "Exportar" é o modelo completo.

- Colunas com outros nomes são reconhecidas (Descrição, Part Number, Serial, Last Done, TBO…), e títulos acima do
  cabeçalho são pulados. Na conferência dá para corrigir o que cada coluna significa.
- Excel com várias abas (Célula, Motor, Hélice): cada aba vai para o mapa de mesmo nome.
- **Conferência antes de gravar:** cada linha aparece como *Novo*, *Atualiza* (mostra o que muda), *Igual* ou com problema.
  Só **Aplicar** grava, numa operação única; o aviso traz **Desfazer**.
- **Frota inteira:** Painel › **Importar frota**. As linhas vão para a aeronave da coluna *Matrícula* (PR-ELF, prelf e
  PR ELF valem igual). Aeronave que não existe é criada junto, como monomotor (Célula, Motor, Hélice); bimotor,
  cadastre antes. Os dados dela (Modelo, S/N, **TSN da célula** e **data da posição**) vêm de uma aba "Aeronaves"
  na mesma planilha ou são digitados na conferência — sem TSN e data, não aplica. Na conferência dá para filtrar por aeronave.
- Mesmo item = mesmo mapa + P/N + N/S + nome (uma peça pode ter várias linhas de controle, ex. Magneto e Magneto (inspeção)).
  Item que já existe mantém o histórico, e célula vazia na planilha não apaga o que está cadastrado.

## Estrutura

| Arquivo | O que faz |
|---|---|
| `index.html` | Casca da página |
| `css/style.css` | Todo o visual (tema claro e escuro, impressão A4) |
| `js/regras.js` | Cálculos do MICCA: vencimento, disponibilidade, TSN/TSO, previsão |
| `js/dados.js` | **Único arquivo que lê/grava** — Supabase via API REST, login e sessão |
| `js/semente.js` | Transcrição do PR-ELF (fonte de `supabase/carga-pr-elf.sql`). O site não carrega |
| `js/app.js` | Rotas, topo, busca global, diálogos, faixa de cabeçalho |
| `js/graficos.js` | Gráficos do painel em SVG/HTML puro (rosca, colunas, anel, linha do tempo) |
| `js/acoes.js` | Lançar horas, cumprimento, item, aeronave, configurações |
| `js/planilha.js` | Exportar CSV; importar (reconhece colunas, compara com o cadastrado) |
| `js/xlsx.js` | Lê .xlsx do Excel sem biblioteca |
| `../supabase/*.sql` | Estrutura do banco, regras de acesso e carga inicial |
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
