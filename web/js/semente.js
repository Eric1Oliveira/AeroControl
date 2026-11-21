/* AeroControl — semente.js
   Dados iniciais da demonstração.
   PR-ELF: transcrição fiel dos três MICCAs em papel (Célula, Motor e Hélice,
   posição de 11/10/2023). As demais aeronaves são fictícias, geradas a partir
   da mesma estrutura, só para mostrar a frota funcionando. */
(function (raiz) {
  'use strict';
  const AC = raiz.AC = raiz.AC || {};

  /* ---------- referências de cumprimento que se repetem no papel ---------- */
  const AS75 = 'AMÉRICA DO SUL, COM 199903-03/ANAC (Cad. Cel. # 02, pág. 075/076)';
  const AS68 = 'AMÉRICA DO SUL, COM 9903-03/ANAC (Cad. Cel. # 02, pág. 068/071)';
  const AS52 = 'AMÉRICA DO SUL, COM 9903-03/ANAC (Cad. Cel. # 02, pág. 052/053)';
  const AS57 = 'AMÉRICA DO SUL, COM 9903-03/ANAC (Cad. Cel. # 02, pág. 057/058)';
  const MANAL = 'MANAL - Manutenção Alagoana de Aeronaves Ltda (Cad. Cel. nº 02, pág. 65)';
  const M53 = 'AMÉRICA DO SUL, COM 9903-03/ANAC (Cad. Mot. #02, pág. 053)';
  const M58 = 'AMÉRICA DO SUL, COM 9903-03/ANAC (Cad. Mot. #02, pág. 0058/059)';
  const M62 = 'AMÉRICA DO SUL, COM 199903-03/ANAC (Cad. Mot. #02, pág. 062/063)';
  const H47 = 'AMÉRICA DO SUL, COM 9903-03/ANAC (Cad. Hel. #02, pág. 047)';
  const OXI = 'SISTEMA DESATIVADO conforme CST#2022S06-13 da November Aviation';
  const HELICE_TXT = '2000 ou 2400 horas ou 5 ou 6 anos (Hélice)';
  const SB1204 = 'Rever a histórico operacional da aeronave comparado ao critério de utilização definido no Piper "SB1204". Para aeronaves que cairem na categoria de "Utilização Única", recalcular os limites de vida da asa, estabilizador horizontal e deriva vertical';
  const BATERIA_G243 = 'Bateria (Se equipado c/ G-243 ou G-250S) - Teste de capacidade (Inicial c/ 800hs ou 12 meses; A cada 400hs ou 12 meses daí em diante)';
  const FILTRO_VACUO = 'Elemento do filtro de entrada do sistema de vácuo (filtro de ar central, filtro do giro, etc.) (500hs/12m ou na substituição da bomba de vácuo) (se instalado)';
  const MANG_MOTOR = 'Mangueiras flexíveis do compartimento do motor (Combustível, óleo, etc) (1000hs ou 8 anos)';
  const MANG_NARIZ = 'Mangueiras hidráulicas do trem do nariz (atuador do trem/atuador da porta/válvula sequência)';
  const G1000 = 'Inspecionar o sistema G1000 conforme o cap. 34-20-00 (Se equipado)';

  /* ---------- mini-linguagem da transcrição ---------- */
  const S = t => ({ S: t });                                   // seção (INSPEÇÕES PERIÓDICAS…)
  const G = t => ({ G: t });                                   // grupo (50 horas, 30 dias…)
  const I = (n, o) => Object.assign({ n }, o);                 // item controlado
  const NA = (n, o, obs) => Object.assign({ n, st: 'na', obs }, o);
  const OUT = (n, ref, o, obs) => Object.assign({ n, st: 'outro', ref, obs }, o);
  const OC = (n, o, obs) => Object.assign({ n, st: 'oc', obs }, o);
  const PEND = (n, o, obs) => Object.assign({ n, st: 'pend', obs }, o);
  const NOTA = t => ({ n: t, st: 'nota' });

  const CELULA = [
    S('INSPEÇÕES PERIÓDICAS'),
    I('50 horas', { tboH: 50, ed: '11/10/2023', et: 1574.9, obs: AS75 }),
    I('100 horas', { tboD: '12m', tboH: 100, ed: '11/10/2023', et: 1574.9, obs: AS75 }),

    S('INSPEÇÕES ESPECIAIS'),
    G('50 horas'),
    NA('Checar segurança dos bicos injetores', { tboH: 50 }, '(Item a ser executado somente na primeira inspeção de 50 horas)'),
    G('250 horas'),
    OUT('Substituição do probe de TIT ("AD2011-06-10")', null, { pn: '686-216', tlvH: 250 }, 'Controlado pela "AD2011-06-10". Vide Mapa de DA\'s de Célula'),
    I('Cumprir "SB521" e "SB531" (Lycoming)', { tboD: '12m', tboH: 250, ed: '11/10/2023', et: 1574.9, obs: AS75 }),
    OUT(SB1204, null, { tboD: '12m', tboH: 250 }, 'VIDE MAPA DE BOLETINS'),
    G('400 horas'),
    NA('Válvula de controle de pressão (Airborne) (pneumatic deice system) (Inspeção)', { tboH: 400 }, 'N/A, NÃO APLICÁVEL'),
    NA(BATERIA_G243, {}, 'NÃO EQUIPADA COM G-243 ou G-250S'),
    OUT('Remover as tampas da caixa de balancins e verifique quanto à liberdade dos balancins de válvula, quando as válvulas estão fechadas', 'motor', { tboH: 400 }, 'Item controlado pela MICCA de motor'),
    G('500 horas'),
    NA(FILTRO_VACUO, { tlvH: 500 }, 'N/A, NÃO APLICÁVEL'),
    OUT('Substituição do filtro de ar do motor', 'motor', { tboH: 500 }, 'Controlado MICCA Motor'),
    I('Drenar os tanques de combustível das asas', { tboH: 500, ed: '22/09/2022', et: 1489.8, obs: AS68 }),
    I('Checar material de selagem do tanque de combustível', { tboH: 500, ed: '22/09/2022', et: 1489.8, obs: AS68 }),
    I('Checar os transmissores de combustível e conectores elétricos', { tboH: 500, ed: '22/09/2022', et: 1489.8, obs: AS68 }),
    I('Bóias do transmissor combustível', { tboD: '2a', tboH: 500, ed: '11/10/2023', et: 1574.9, obs: AS75 }),
    I('Remover borra da hélice e do eixo', { tboH: 500, ed: '03/08/2021', et: 1391.6, obs: MANAL }),
    OUT('Inspeção e limpeza dos magnetos (se equipado c/ Slick)', 'motor', { tboH: 500 }, 'Controlado MICCA Motor'),
    I('Inspeção das pás de hélice ("composite") (teste de moeda - erosão da blindagem) (Manual Hartzell # 135)', { tboH: 500, ed: '24/09/2020', et: 1300.5, obs: 'AMÉRICA DO SUL, COM 9903-03/ANAC (Cad. Hel. #02, pág. 047)' }),
    NA(G1000, { tboH: 500 }, 'N/A, NÃO EQUIPADO C/ G1000'),
    NA('Inspecionar operação do sistema de pressurização de cabine (21-30-00)', { tboH: 500 }, 'N/A, aplicável somente p/ modelo PA-46-350P'),
    G('600 horas'),
    OUT('Bombas de vácuo Aero Accessories', 'motor', { tlvH: 600 }, 'Controlado MICCA motor'),
    G('1000 horas'),
    NA('Garmin GFC 700 (realizar uma inspeção visual, limpar e aplicar graxa na engrenagem de saída da GSA 8X Servo Actuator)', { tlvD: '3a', tlvH: 1000 }, 'N/A, NÃO EQUIPADO C/ G1000'),
    OUT(MANG_MOTOR, 'motor', { tlvD: '8a', tlvH: 1000 }, 'Vide item mangueiras hidráuilicas e mangueiras do motor, controlados em separado'),
    I(MANG_NARIZ, { tlvD: '8a', tlvH: 1000, ed: '06/10/2023', et: 1574.9, obs: 'GOLDEN FLEX PARTS & SERVICES (COM 0708-41/ANAC) Segvoo nº GDF-260/23' }),
    I('Inspeção completa nas pás de hélice ("composite") (teste da moeda) (Manual Hartzell # 135F)', { tboH: 1000, ed: '24/11/2017', et: 1015.1, obs: AS52 }),
    I('Inspecionar a condição dos parafusos utilizados c/ os roletes dos flapes e dobradiças dos ailerons (Substituir conforme requerido)', { tboH: 1000, ed: '24/11/2017', et: 1015.1, obs: AS52 }),
    I('Inspecionar os trilhos dos flapes quanto a segurança de fixação, danos, condição e corrosão', { tboH: 1000, ed: '24/11/2017', et: 1015.1, obs: AS52 }),
    I('(Se instalado) Remover os cartuchos do "Speedbrake" e retornar p/ a "Precise Flight" p/ lubrificação da embreagem e substituição da mola', { tboH: 1000, ed: '22/07/2021', et: 1391.6, novo: true, obs: 'Precise Flight (Form 8130-3 nº 05129)' }),
    NA(G1000, { tboH: 1000 }, 'N/A, NÃO EQUIPADO C/ G1000'),
    G('2000 horas'),
    I('Inspeção detalhada da estrutura da aeronave', { tboD: '7a', tboH: 2000, ed: '22/09/2022', et: 1489.8, obs: AS68 }),
    OUT('Revisão geral do motor', 'motor', { tboD: '12a', tboH: 2000 }, 'Controlado MICCA motor'),
    OUT(HELICE_TXT, 'helice', { tboD: '5a', tboH: 2400 }, 'Controlado MICCA hélice'),
    OUT('Revisão geral ou substituição do alternador', 'motor', { tboD: '12a', tboH: 2000 }, 'Controlado MICCA motor'),
    G('2200 horas'),
    NA('Substituir bateria back-up do Aspen Avionics EBD (se equipado)', { tboD: '3a', tboH: 2200 }, 'N/A, NÃO EQUIPADO'),
    G('2400 horas'),
    OUT('2400 horas ou TBO motor (Governador de hélice) (SL61)', 'motor', { tboD: '12a', tboH: 2000 }, 'Controlado MICCA motor'),
    OUT(HELICE_TXT, 'helice', { tboD: '5a', tboH: 2400 }, 'Controlado MICCA hélice'),
    G('2700 horas'),
    OUT('Motor de partida (Sky Tec) (2700hs ou TBO do motor)', 'motor', { tboD: '12a', tboH: 2000 }, 'Controlado MICCA motor'),
    G('4000 horas'),
    NA('PA-46-350P S/N\'S 4636375 ao 4636462 (menos 4636460) - Inspecionar a antena COMM 1 (inferior) (23-10-00)', { tboH: 4000 }, 'N/A ao modelo e S/N da aeronave'),
    G('5000 horas'),
    I('(Se instalado) Remover os cartuchos do "Speedbrake" e retornar p/ a "Precise Flight" p/ substituição do conjunto de comando', { tlvH: 5000, et: 0, tb: 0, novo: true, obs: 'ORIGINAL DE FÁBRICA' }),
    G('7500 horas'),
    I('Parafusos do berço do motor localizados na parede de fogo (F.S. 95.00)', { tlvH: 7500, et: 0, tb: 0, novo: true, obs: 'ORIGINAL DE FÁBRICA' }),
    G('9400 horas'),
    NA('PA-46-350P S/N\'S 4636375 ao 4636462 (menos 4636460) - Inspecionar a antena COMM 2 (superior) (23-10-00)', { tboH: 9400 }, 'N/A ao modelo e S/N da aeronave'),
    G('30 dias'),
    NA('Checar a fonte de emergência do indicador de attitude standby (no compartimento traseiro da cápsula do radar) (Aeronaves PA-46-350P S/N 4636375 e acima com Avidyne)', { tboD: '30d' }, 'N/A, AFETA SOMENTE PA-46-350P'),
    I('Extintor de incêndio de cabine (Halon) (2007)', { pn: 'A344T', ns: 'E-93777598', tboD: '30d', tb: null, obs: AS75 }),
    I('Checar visualmente a instalação adequada do cilindro de oxigênio quanto a vazamento, corrosão, amassados, distorção, e segurança de montagem, e data corrente do teste hidrostático (Somente PA-46R-350T) (se instalado)', { tboD: '30d', ed: '10/10/2023', tb: null, obs: OXI + ' de 27/06/2022' }),
    G('90 dias'),
    I('Bateria e compartimento da bateria', { tboD: '90d', ed: '11/10/2023', tb: null, obs: AS75 }),
    I('Filtro de combustível', { tboD: '90d', ed: '11/10/2023', tb: null, obs: AS75 }),
    I('Teste do ELT (Self-test) (Cap. 25-60-00)', { tboD: '90d', ed: '11/10/2023', tb: null, obs: AS75 }),
    OC('Se o indicador de Atitude Standby (Horizonte Elétrico) não operou nos últimos 90 dias, carregar a bateria (somente para PA-46R-350T)', { tboD: '90d' }, 'O Horizonte elétrico não ficou sem operar nos últimos 90 dias'),
    G('4 meses'),
    OUT('Substituição do óleo e filtro de óleo', 'motor', { tboD: '4m', tboH: 50 }, 'Controlado MICCA motor'),
    G('6 meses'),
    NA('6 meses (Lubrificação hélice, caso aeronave voe muito menos que 100 horas em 1 ano) (Afeta somente hélices Hartzell)', { tboD: '6m' }, 'N/A, anv. tem voado mais que 100 horas em 1 ano'),
    G('11 meses (+ ou menos 1 mês)'),
    OUT(BATERIA_G243, 'celula', {}, 'Item controlado em 400hs (ou 12 meses)'),
    G('1 ano'),
    OUT('100 horas ou 1 ano (Lubrificação hélice caso aeronave voe mais que 100 horas em 1 ano)', 'celula', { tboD: '1a', tboH: 100 }, 'Controlado por lubrificação de 100hs ou 12 meses'),
    I('(Se instalado) Inspeção anual do speedbrake (27-60-00)', { tboD: '1a', ed: '11/10/2023', et: 1574.9, tb: null, obs: AS75 }),
    OUT(FILTRO_VACUO, 'celula', { tlvD: '12m', tlvH: 500 }, 'Item controlado em 500hs (ou 12 meses)'),
    NA('"Manifold check valve" do sistema de vácuo (Inspeção Inicial com 5 anos; A cada 1 ano daí em diante) (Airborne SL39A) (Se equipado)', { tboD: '5a' }, 'N/A NÃO EQUIPADO'),
    OUT('Cumprir última revisão do "SB521" e "SB531" (Lycoming)', 'celula', { tboD: '12m', tboH: 250 }, 'Item controlado em 250hs (ou 12 meses)'),
    I('Teste de capacidade da bateria do Indicador de Atitude Standby (Horizonte Elétrico) (34-20-00)', { tboD: '1a', ed: '11/10/2023', tb: null, obs: AS75 }),
    NA(SB1204, { tboD: '12m', tboH: 250 }, 'N/A, aeronave não incluída na categoria de utilização única'),
    NA('Inspeção anual do display backup do Aspen Avionics EBD (se equipado)', { tboD: '1a' }, 'N/A, NÃO EQUIPADO'),
    I('Inspeção anual do Extintor de incêndio de cabine (Halon) (2007)', { pn: 'A344T', ns: 'E-93777598', tboD: '1a', ed: '11/10/2023', tb: null, obs: AS75 }),
    I('Extintor de incêndio de cabine (Halon) - teste hidrostático', { pn: 'A344T', ns: 'E-93777598', tlvD: '6a', ed: '01/10/2018', tb: null, obs: AS57 }),
    I('Extintor de incêndio de cabine (Halon)', { pn: 'A344T', ns: 'E-93777598', tlvD: '12a', ed: '01/10/2018', tb: null, obs: AS57 }),
    I('Teste de capacidade da bateria Concorde (após 1 ano de uso) Cap 24-30-00', { pn: '601-919 (RG24-17)', ns: '41183397', tboD: '1a', ed: '11/10/2023', tb: null, obs: AS75 }),
    G('2 anos'),
    OUT('Bóias do transmissor combustível', 'celula', { tboD: '2a', tboH: 500 }, 'Item controlado em 500hs (ou 2 anos)'),
    I('PFD (Avidyne)', { pn: '700-00006-003', ns: '20116128', tboD: '2a', ed: '11/10/2023', tb: null, obs: AS75 }),
    I('Altímetro Standby (United)', { pn: '5934PAD-1', ns: '469279', tboD: '2a', ed: '11/10/2023', tb: null, obs: AS75 }),
    I('Transponder (Garmin)', { pn: '011-00455-00 (GTX-330)', ns: '8431051', tboD: '2a', ed: '11/10/2023', tb: null, obs: AS75 }),
    NA('Modo "C"', { tboD: '2a' }, 'N/A, NÃO EQUIPADO'),
    I('Bússola magnética', { tboD: '2a', ed: '11/10/2023', tb: null, obs: AS75 }),
    I('Calibragem do magnetometro', { tboD: '2a', ed: '11/10/2023', tb: null, obs: AS75 }),
    I('Check do sistema pitot/estático', { tboD: '2a', ed: '11/10/2023', tb: null, obs: AS75 }),
    NA('Aspen Avionics EBD', { tboD: '2a' }, 'N/A, NÃO EQUIPADO'),
    NA('GAE 43', { tboD: '2a' }, 'N/A, NÃO EQUIPADO'),
    G('3 anos'),
    I('Substituição da bateria do Indicador de Atitude Standby (Horizonte Elétrico)', { pn: '9015607', ns: 'L21-12275', tlvD: '3a', ed: '22/09/2022', tb: null, obs: AS68 }),
    NA('Substituição da bateria interna do backup do Aspen Avionics EBD (se equipado)', { tlvD: '3a', tlvH: 2200 }, 'N/A, NÃO EQUIPADO'),
    NA('Substituição ou revisão das máscaras do sistema fixo de oxigênio 35-20-00', { tboD: '3a' }, OXI),
    G('5 anos'),
    NA('Cilindro oxigênio (Teste Hidrostático)', { pn: '1273826', ns: '898-646', tboD: '5a' }, OXI),
    NA('Revisão do regulador. (a substituição da válvula de enchimento é recomendada, mas não é necessária)', { tboD: '5a' }, OXI + ' de 27/06/2022'),
    NA('(Somente PA-46-350P S/N 4636633, 4636652 e demais) O oxímetro / detector de pulso de CO deve retornar ao guardião de CO no final da vida útil (5 anos) para substituição e calibração do sensor de CO para manter a uniformidade da unidade', { tboD: '5a' }, 'N/A AO MODELO E S/N DA AERONAVE'),
    NA('Atualização do campo magnético Terra GRS', { tboD: '5a' }, 'N/A NÃO EQUIPADO'),
    NOTA('Inspeção das uniões de fixação e hastes listadas abaixo (Reparo ou substituição conforme necessário); após finalizado, aplicar componente inibidor de corrosão (P/N 89500-800)'),
    I('>> Uniões de fixação da longarina dianteira e trazeira da asa à fuselagem (57-40-00)', { tboD: '5a', ed: '11/10/2023', tb: null, obs: AS75 }),
    I('>> Uniões de fixação da deriva vertical dianteira (55-30-00)', { tboD: '5a', ed: '11/10/2023', tb: null, obs: AS75 }),
    I('>> Hastes do compensador do profundor (55-20-00)', { tboD: '5a', ed: '11/10/2023', tb: null, obs: AS75 }),
    I('>> Uniões de fixação do estabilizador horizontal dianteiro e traseiro (55-10-00)', { tboD: '5a', ed: '11/10/2023', tb: null, obs: AS75 }),
    OUT(HELICE_TXT, 'helice', { tboD: '5a', tboH: 2400 }, 'Controlado pela MICCA de hélice'),
    G('6 anos'),
    OUT(HELICE_TXT, 'helice', { tboD: '5a', tboH: 2400 }, 'Controlado pela MICCA de hélice'),
    OUT('(Se equipado c/ bombas de vácuo AAI) Substituir o acoplamento de comando da bomba de vácuo', 'motor', { tboD: '6a' }, 'Controlado pela MICCA Motor'),
    G('7 anos'),
    OUT('Inspeção detalhada da estrutura da aeronave', 'celula', { tboD: '7a', tboH: 2000 }, 'Item controlado em 2000hs (ou 7 anos)'),
    G('8 anos'),
    OUT(MANG_MOTOR, 'motor', { tlvD: '8a', tlvH: 1000 }, 'Controlado pela MICCA de Motor'),
    OUT(MANG_NARIZ, 'celula', { tlvD: '8a', tlvH: 1000 }, 'Item controlado em 1000hs (ou 8 anos)'),
    G('10 anos'),
    I('Check de pressão das mangueiras de fluído da fuselagem e asas (Inicial c/ 10 anos; A cada 5 anos daí em diante; TLV c/ 20 anos)', { tboD: '5a', ed: '11/10/2023', tb: null, obs: AS75 }),
    I('Substituição da bateria CMOS do MFD (Se equipado c/ Avidyne EFIS)', { tlvD: '10a', ed: '24/09/2019', tb: null, obs: 'ARISTEK Segvôo 003 nº ARI-9142/19 de 24/09/2019 (Cad. Cel. # 02, pág. 057/058)' }),
    NA('"Manifold check valve" do sistema de vácuo (Airborne SL39A) (Se equipado)', { tlvD: '10a' }, 'N/A NÃO EQUIPADO'),
    G('12 anos'),
    NA('Geradores fixos de oxigênio', { tboD: '12a' }, 'Item aplicável somente para o modelo PA-46-350P'),
    G('15 anos'),
    NA('Cilindro de oxigênio (somente para PA-46R-350T)', { pn: 'DOT-SP-10945', tboD: '15a' }, OXI),
    G('20 anos'),
    I('Nenhuma mangueira de fluído pode exceder 20 anos de tempo total em serviço', { tboD: '20a', ed: '05/2008', tb: null, obs: 'ORIGINAL DE FÁBRICA' }),

    S('COMPONENTES'),
    I('Asa e estrutura associada', { tlvH: 15580, et: 0, tb: 0, novo: true, obs: 'ORIGINAL DE FÁBRICA' }),
    I('Estabilizador horizontal', { tlvH: 15580, et: 0, tb: 0, novo: true, obs: 'ORIGINAL DE FÁBRICA' }),
    I('Estabilizador vertical', { tlvH: 15580, et: 0, tb: 0, novo: true, obs: 'ORIGINAL DE FÁBRICA' }),
    I('ELT (Artex) Hexa: D8CC4 09E38 00261', { pn: '453-6603 (ME406)', ns: '10126', tboD: '1a', ed: '11/10/2023', tb: null, obs: AS75 }),
    I('Bateria do ELT', { pn: '455-0012', ns: '385790-035', vd: '05/2027', tb: null, obs: 'AMÉRICA DO SUL, COM 9903-03/ANAC (Cad. Cel. # 02, pág. 060)' }),
    NA('Estojo de primeiros socorros', { tboD: '1a' }, 'N/A, NÃO EQUIPADO'),
    NA('Bolsa de sobrevivência na selva', { tboD: '1a' }, 'N/A, NÃO EQUIPADO'),

    S('ITENS DE LUBRIFICAÇÃO'),
    I('50 horas', { tboH: 50, ed: '11/10/2023', et: 1574.9, obs: AS75 }),
    I('100 horas', { tboH: 100, ed: '11/10/2023', et: 1574.9, obs: AS75 }),
    I('100HS/12M', { tboD: '12m', tboH: 100, ed: '11/10/2023', et: 1574.9, obs: AS75 }),
    NOTA('DESATIVAÇÃO DO SISTEMA DE OXIGÊNIO, conforme CST#2022S06-13 da November Aviation de 27/06/2022, desativação conforme Manual de Desativação nº NVB-24-106 da November Aviation, revisão "0" de 31/05/2022. Instruções de Aeronavegabilidade Continuada (ICA) conforme documento nº NVB-24-107 da November Aviation, revisão "0" de 31/05/2022'),
    I('Verificação da desativação do sistema de oxigênio', { tboD: '12m', tboH: 100, ed: '10/10/2023', et: 1574.9, obs: AS75 }),
    I('Inspeção do placar de limitação', { tboD: '12m', tboH: 100, ed: '10/10/2023', et: 1574.9, obs: AS75 }),

    S('DIVERSOS'),
    I('Seguro Reta "B"', { pn: '1009715013317', tlvD: '1a', ed: '28/09/2023', tb: null, obs: 'ESSOR SEGUROS S.A.' }),
    PEND('Licença de estação da aeronave', { pn: 'regularizando', tlvD: '10a' }, 'ANATEL'),
    PEND('Taxa fistel', { pn: 'regularizando', tlvD: '1a' }, 'ANATEL'),
    OC('Peso e balanceamento (TPP)', { ed: '01/07/2008' }, 'PIPER AIRCRAFT'),
    NA('Certificado de aeronavegabilidade', { pn: '17771', tlvD: '6a' }, 'RBAC 91'),
    I('Check do VOR', { tboD: '30d', ed: '19/09/2023', tb: null, obs: 'DIÁRIO DE BORDO' }),
    I('CVA', { tlvD: '1a', ed: '11/10/2023', tb: null, obs: AS75 })
  ];

  const MOTOR = [
    I('Motor', { pn: 'TIO-540-AE2A', ns: 'L-13100-61A', tboD: '12a', tboH: 2000, ed: '03/08/2021', et: 1391.6, obs: MANAL, p: true }),
    S('COMPONENTES'),
    I('Governador de hélice (Hartzell)', { pn: 'V-11-1', ns: 'G1314J', tboD: '12a', tboH: 2000, ed: '24/09/2020', et: 1300.5, obs: M53 }),
    I('Magneto LH (Slick) (overhaul)', { pn: '6363', ns: 'J-11055', tboD: '12a', tboH: 2000, ed: '04/11/2021', et: 1489.8, tb: 'IGN', obs: M58 }),
    I('Magneto RH (Slick) (overhaul)', { pn: '6360', ns: 'I-09094', tboD: '12a', tboH: 2000, ed: '17/09/2020', et: 1489.8, tb: 'IGN', obs: M58 }),
    I('Magneto LH (Slick) (inspeção)', { pn: '6363', ns: 'J-11055', tboH: 500, ed: '04/11/2021', et: 1489.8, obs: M58 }),
    I('Magneto RH (Slick) (inspeção)', { pn: '6360', ns: 'I-09094', tboH: 500, ed: '17/09/2020', et: 1489.8, obs: M58 }),
    I('Válvula distribuidora de combustível (Bendix / Precision)', { pn: '2524232-2', ns: '63B19948', tboD: '10a', tboH: 2000, ed: '02/05/2008', et: 0, tb: 0, novo: true, obs: 'Acompanha o motor de fábrica' }),
    I('Bomba mecânica de combustível (Kelly Aerospace)', { pn: '200F-5002', ns: 'H-TDN067FP', tboD: '12a', tboH: 2000, ed: '13/10/2020', et: 1300.5, tb: 0, novo: true, obs: M53 }),
    I('Injetora (Bendix / Precision)', { pn: '2549038-4', ns: '730H8F02', tboD: '10a', tboH: 2000, ed: '22/09/2022', et: 1489.8, novo: true, obs: M58 }),
    I('Bicos injetores (em conjunto c/ sistema de combustível)', { tboD: '10a', tboH: 2000, ed: '18/09/2020', et: 1300.5, obs: M53 }),
    I('Motor de partida (Sky Tec)', { pn: '149-NL/EC', ns: 'FNE-360909', tboD: '12a', tboH: 2000, ed: '04/12/2009', et: 248.5, tb: 0, novo: true, obs: 'JP MARTINS CHE 6612-02/ANAC (Cad. Cel. #02, pág. 024)' }),
    I('Alternador LH (Kelly Aerospace)', { pn: 'ALU-8521', ns: 'H-O020954', tboD: '12a', tboH: 2000, ed: '30/11/2018', et: 1116.2, tb: 0, novo: true, obs: 'AMÉRICA DO SUL, COM 9903-03/ANAC (Cad. Mot. #02, pág. 050)' }),
    I('Alternador RH (Kelly Aerospace)', { pn: 'ALU-8539LS', ns: 'IO30580', tboD: '12a', tboH: 2000, ed: '02/05/2008', et: 0, tb: 0, novo: true, obs: 'Acompanha o motor de fábrica' }),
    NA('Bomba de vácuo (AAI)', {}, 'N/A, NÃO EQUIPADO'),
    NA('Acoplamento de comando da bomba de vácuo (Se equipado com bombas Aero Accessories - AAI)', {}, 'N/A, NÃO EQUIPADO'),
    I('Inspeção de válvulas - remover as tampas da caixa de balancins e verifique quanto à liberdade dos balancins de válvula, quando as válvulas estão fechadas', { tboH: 1000, ed: '06/08/2021', et: 1391.6, obs: MANAL }),
    I('Filtro de ar', { pn: 'P15-1936', tlvH: 500, ed: '11/10/2023', et: 1574.9, tb: 0, novo: true, obs: M62 }),
    I('Turbo compressor (Kelly Aerospace) LH', { pn: '46C19839M', ns: 'LBL00290', tboD: '12a', tboH: 2000, ed: '17/09/2020', et: 1300.5, obs: M53 }),
    I('Turbo compressor (Kelly Aerospace) RH', { pn: '46C19839M', ns: 'LCL00043', tboD: '12a', tboH: 2000, ed: '17/09/2020', et: 1300.5, obs: M53 }),
    I('Valvula "wastegate" do turbo (Kelly Aerospace)', { pn: '470954-9007 (47E21296)', ns: 'H-RHN00008', tboD: '12a', tboH: 2000, ed: '24/11/2021', et: 1489.8, tb: 'IGN', obs: M58 }),
    I('Valvula controladora do turbo (Kelly Aerospace)', { pn: '481008-9033 (48E21297E)', ns: 'MBN00245', tboD: '12a', tboH: 2000, ed: '18/01/2022', et: 1489.8, tb: 'IGN', obs: M58 }),
    I('Valvula "overboost" do turbo (Kelly Aerospace)', { pn: '470944-0007', ns: 'H-ZBO00150', tboD: '12a', tboH: 2000, ed: '22/09/2022', et: 1489.8, obs: M58 }),
    OC('Mangueiras do motor (1000hs/8 anos e na TBO do motor)', {}, 'TYPE D'),
    I('Óleo do motor', { pn: '15W50', tlvD: '4m', tlvH: 50, ed: '11/10/2023', et: 1574.9, tb: 0, novo: true, obs: M62 }),
    I('Filtro de óleo', { pn: 'CH48103-1', tlvD: '4m', tlvH: 50, ed: '11/10/2023', et: 1574.9, tb: 0, novo: true, obs: M62 })
  ];

  const HELICE = [
    I('Hélice', { pn: 'HC-I3YR-1E/7890B', ns: 'HK1411B', tboD: '6a', tboH: 2400, ed: '24/09/2020', et: 1300.5, obs: H47, p: true }),
    S('COMPONENTES'),
    I('Cubo', { pn: 'HC-I3YR-1E/7890B', ns: 'HK1411B', tboD: '6a', tboH: 2400, ed: '24/09/2020', et: 1300.5, obs: H47 }),
    I('Pá # 1', { pn: '7890B', ns: '1356', tboD: '6a', tboH: 2400, ed: '24/09/2020', et: 1300.5, obs: H47 }),
    I('Pá # 2', { pn: '7890B', ns: '1355', tboD: '6a', tboH: 2400, ed: '24/09/2020', et: 1300.5, obs: H47 }),
    I('Pá # 3', { pn: '7890B', ns: '1357', tboD: '6a', tboH: 2400, ed: '24/09/2020', et: 1300.5, obs: H47 })
  ];

  /* ---------- conversão para o formato do banco ---------- */
  function dataPapel(txt) {
    if (!txt) return { iso: null, mes: false };
    const p = txt.split('/');
    if (p.length === 2) return { iso: `${p[1]}-${p[0]}-01`, mes: true };
    return { iso: `${p[2]}-${p[1]}-${p[0]}`, mes: false };
  }
  const ST = { na: 'na', outro: 'outro', oc: 'oc', pend: 'pendente', nota: 'nota' };

  function montarItens(defs, aeronaveId, mapa, novoId) {
    let secao = '', grupo = '', ordem = 0;
    const out = [];
    for (const d of defs) {
      if (d.S !== undefined) { secao = d.S; grupo = ''; continue; }
      if (d.G !== undefined) { grupo = d.G; continue; }
      const ed = dataPapel(d.ed), vd = dataPapel(d.vd);
      const et = d.et ?? null;
      out.push({
        id: novoId(), aeronaveId, mapa, secao, grupo, ordem: ordem += 10,
        nome: d.n, pn: d.pn || '', ns: d.ns || '',
        tlvData: d.tlvD || '', tlvHoras: d.tlvH ?? null, tboData: d.tboD || '', tboHoras: d.tboH ?? null,
        validade: vd.iso, validadeMes: vd.mes,
        efetuadoData: ed.iso, efetuadoMes: ed.mes, efetuadoTsn: et,
        tsnBase: d.tb !== undefined ? d.tb : (et !== null ? et : null),
        tsoNovo: !!d.novo,
        situacao: d.st ? ST[d.st] : 'controlado',
        refMapa: d.ref || null,
        obs: d.obs || '', principal: !!d.p
      });
    }
    return out;
  }

  function mapasMono(motor, helice) {
    return [
      { id: 'celula', tipo: 'celula', nome: 'Célula' },
      Object.assign({ id: 'motor', tipo: 'motor', nome: 'Motor' }, motor),
      Object.assign({ id: 'helice', tipo: 'helice', nome: 'Hélice' }, helice)
    ];
  }

  /* ---------- frota fictícia para a demonstração ---------- */
  function prng(semente) {
    let a = semente >>> 0;
    return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  }
  const FROTA_DEMO = [
    { m: 'PR-MCA', sn: '4692118', ano: 2010, tsn: 2418.6, util: 31, mot: 'L-14522-61A', hel: 'HK1702B', perfil: 'atencao', pos: 1 },
    { m: 'PS-DTH', sn: '4692163', ano: 2012, tsn: 862.3, util: 24, mot: 'L-15106-61A', hel: 'HK1958B', perfil: 'limpo', pos: 0 },
    { m: 'PR-JVK', sn: '4692071', ano: 2009, tsn: 3105.2, util: 42, mot: 'L-13877-61A', hel: 'HK1520B', perfil: 'vencido', pos: 2 },
    { m: 'PT-ROS', sn: '4692140', ano: 2011, tsn: 1987.4, util: 18, mot: 'L-14830-61A', hel: 'HK1811B', perfil: 'limpo', pos: 3 },
    { m: 'PP-AVN', sn: '4692096', ano: 2010, tsn: 1240.0, util: 27, mot: 'L-14201-61A', hel: 'HK1633B', perfil: 'atencao', pos: 26 },
    { m: 'PR-LGZ', sn: '4692201', ano: 2014, tsn: 455.8, util: 35, mot: 'L-16044-61A', hel: 'HK2210B', perfil: 'limpo', pos: 1 },
    { m: 'PS-KTR', sn: '4692087', ano: 2009, tsn: 2761.9, util: 22, mot: 'L-13990-61A', hel: 'HK1588B', perfil: 'vencido', pos: 5 }
  ];
  const PERFIS = { limpo: [0, 0.05], atencao: [0, 0.22], vencido: [0.2, 0.15] };

  function trocarDigitos(txt, rnd) {
    if (!txt || /regulariz/i.test(txt)) return txt;
    let n = 0;
    return txt.replace(/\d/g, d => (n++ >= 2 ? String(Math.floor(rnd() * 10)) : d));
  }

  function gerarDemo(base, ref, novoId) {
    const R = AC.regras;
    const aeronaves = [], itens = [], lancamentos = [];
    FROTA_DEMO.forEach((f, idx) => {
      const rnd = prng(1000 + idx * 7919);
      const id = f.m.toLowerCase();
      const posicao = R.somaDias(ref, -f.pos);
      const utilDia = f.util / 30.4375;
      const fabricacao = `${f.ano}-03-15`;
      const [pVenc, pPerto] = PERFIS[f.perfil];
      aeronaves.push({
        id, matricula: f.m, fabricante: 'PIPER AIRCRAFT', modelo: 'PA-46R-350T', sn: f.sn, ano: f.ano,
        tsn: f.tsn, tso: null, posicaoData: posicao, utilMensal: f.util, ciclos: null,
        manualRef: 'SM P/N 761-876', manualRev: '2021-05-03', demo: true,
        mapas: mapasMono({ fabricante: 'Lycoming', modelo: 'TIO-540-AE2A', sn: f.mot }, { fabricante: 'Hartzell', modelo: 'HC-I3YR-1E/7890B', sn: f.hel })
      });

      /* cada evento de manutenção do papel (mesma data + mesmo TSN) vira um evento da aeronave fictícia */
      const eventos = new Map();
      const modelo = base.filter(b => b.aeronaveId === 'pr-elf');
      for (const b of modelo) {
        if (b.situacao !== 'controlado' || b.validade) continue;
        if (b.efetuadoData === null && b.efetuadoTsn === null) continue;
        if (b.efetuadoTsn === 0 && !b.efetuadoData) continue; // estrutura original de fábrica
        const chave = `${b.efetuadoData}|${b.efetuadoTsn}`;
        const ivD = Math.min(...[R.lerIntervalo(b.tboData), R.lerIntervalo(b.tlvData)].filter(Boolean).map(R.intervaloEmDias), Infinity);
        const ivH = Math.min(...[b.tboHoras, b.tlvHoras].filter(v => v !== null), Infinity);
        const span = Math.min(ivD, ivH / utilDia);
        const ev = eventos.get(chave) || { span: Infinity };
        ev.span = Math.min(ev.span, span);
        eventos.set(chave, ev);
      }
      for (const ev of eventos.values()) {
        const r = rnd();
        const fr = r < pVenc ? 1.01 + rnd() * 0.1 : r < pVenc + pPerto ? 0.8 + rnd() * 0.18 : 0.06 + rnd() * 0.68;
        ev.dias = Math.max(1, Math.round(fr * ev.span));
        ev.horas = Math.round(ev.dias * utilDia * 10) / 10;
      }

      for (const b of modelo) {
        const it = Object.assign({}, b, { id: novoId(), aeronaveId: id, ns: trocarDigitos(b.ns, rnd) });
        if (it.principal && it.mapa === 'motor') it.ns = f.mot;
        if (it.mapa === 'helice' && (it.principal || it.nome === 'Cubo')) it.ns = f.hel;
        if (b.validade) {
          const d = rnd() < 0.15 ? 12 + Math.round(rnd() * 20) : 120 + Math.round(rnd() * 1100);
          it.validade = R.somaDias(ref, d).slice(0, 8) + '01';
        } else if (b.situacao === 'controlado' && (b.efetuadoData || b.efetuadoTsn)) {
          const ev = eventos.get(`${b.efetuadoData}|${b.efetuadoTsn}`);
          if (ev) {
            let ed = R.somaDias(ref, -ev.dias);
            let et = Math.round((f.tsn - ev.horas) * 10) / 10;
            if (et < 0) { et = 0; }
            if (ed < fabricacao) ed = fabricacao;
            it.efetuadoData = b.efetuadoData ? ed : null;
            it.efetuadoMes = false;
            it.efetuadoTsn = b.efetuadoTsn !== null ? et : null;
            if (b.tsnBase !== null && b.tsnBase !== 'IGN') it.tsnBase = b.tsnBase === 0 ? 0 : it.efetuadoTsn;
          }
        } else if (b.situacao === 'oc' && b.efetuadoData) {
          it.efetuadoData = fabricacao;
        }
        itens.push(it);
      }

      /* voos dos últimos dois meses até a posição atual */
      let tsn = f.tsn, dia = posicao;
      const voos = [];
      while (R.diffDias(dia, posicao) < 60) {
        const h = Math.round((0.8 + rnd() * 2.6) * 10) / 10;
        voos.push({ id: novoId(), aeronaveId: id, data: dia, horas: h, tsnApos: Math.round(tsn * 10) / 10, pousos: 1 + Math.floor(rnd() * 3), obs: '' });
        tsn -= h;
        dia = R.somaDias(dia, -Math.max(1, Math.round(h / utilDia * (0.6 + rnd() * 0.8))));
      }
      lancamentos.push(...voos.reverse());
    });
    return { aeronaves, itens, lancamentos };
  }

  /* ---------- pacote completo ---------- */
  function gerar(novoId) {
    const REF = '2023-10-11';
    const prelf = {
      id: 'pr-elf', matricula: 'PR-ELF', fabricante: 'PIPER AIRCRAFT', modelo: 'PA-46R-350T', sn: '4692049', ano: 2008,
      tsn: 1574.9, tso: null, posicaoData: REF, utilMensal: 7.5, ciclos: null,
      manualRef: 'SM P/N 761-876', manualRev: '2021-05-03', demo: false, origem: 'MICCA em papel, posição de 11/10/2023',
      mapas: mapasMono({ fabricante: 'Lycoming', modelo: 'TIO-540-AE2A', sn: 'L-13100-61A' }, { fabricante: 'Hartzell', modelo: 'HC-I3YR-1E/7890B', sn: 'HK1411B' })
    };
    const itens = [
      ...montarItens(CELULA, 'pr-elf', 'celula', novoId),
      ...montarItens(MOTOR, 'pr-elf', 'motor', novoId),
      ...montarItens(HELICE, 'pr-elf', 'helice', novoId)
    ];
    const demo = gerarDemo(itens, REF, novoId);
    return {
      versao: 1,
      config: { dataRef: REF, alertaDias: 30, alertaHoras: 25, demo: true, avisoDemo: true },
      aeronaves: [prelf, ...demo.aeronaves],
      itens: [...itens, ...demo.itens],
      lancamentos: demo.lancamentos,
      cumprimentos: []
    };
  }

  AC.semente = { gerar, mapasMono };
})(typeof window !== 'undefined' ? window : globalThis);
