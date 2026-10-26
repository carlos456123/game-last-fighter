# LAST FIGHTER — Documento de Design (v0.2)

## Identidade

- **Conceito:** a Última Arena convoca os guerreiros que restaram após "o céu se partir". Sobreviver é o objetivo.
- **Direção de arte:** 2D estilizado, contornos escuros grossos, cores chapadas, contraste alto, luz quente (Coliseu) ou neon (Doca).
  Cada lutador é reconhecível só pela silhueta (faixa esvoaçante / ombros massivos / capuz + cachecol + lâminas).
- **Paleta da marca:** brasa `#FF4D2E`, ouro `#FFC24A`, turquesa `#3FE0C5`, fundo `#07060C`.
- **Tipografia:** Russo One (títulos — força/competição) e Chakra Petch (texto — técnico e legível). Ambas OFL.

## Lutadores

|                | Kael — _O Último Juramento_                         | Bronn — _A Muralha_                              | Nyx — _Véu Sombrio_                        |
| -------------- | --------------------------------------------------- | ------------------------------------------------ | ------------------------------------------ |
| Arquétipo      | Equilibrado (referência)                            | Tanque / força bruta                             | Assassino / veloz                          |
| Idade aparente | 25                                                  | 40                                               | desconhecida                               |
| Origem         | Vael, cidade das muralhas rubras                    | Forjas Profundas                                 | desconhecida                               |
| Personalidade  | disciplinado, culpa e esperança                     | paciente, bem-humorado, irredutível              | silenciosa, impaciente                     |
| Silhueta       | faixa com pontas, cabelo espetado, gi sem mangas    | ombreiras, manoplas, barba, postura larga        | capuz, cachecol longo, lâminas reversas    |
| Vida / defesa  | 100 / 1.0                                           | 125 / 1.1                                        | 86 / 0.92                                  |
| Mobilidade     | corrida 430, sem pulo duplo                         | corrida 330, esquiva curta                       | corrida 520, **pulo duplo**, esquiva longa |
| Leves          | cadeia de 3                                         | cadeia de 2 (lenta e pesada)                     | cadeia de 4 (a última com 2 hits)          |
| Pesado         | soco que atordoa                                    | golpe duplo com **armadura**                     | lançador para juggle                       |
| Habilidade (L) | Lâmina de Brasa — projétil                          | Tremor — onda baixa pelo chão                    | Leque de Lâminas — 3 kunais em leque       |
| Especial (U)   | Ascensão Rubra — antiaéreo invulnerável             | Investida de Ferro — ombrada com 2 de armadura   | Passo Fantasma — teleporte às costas       |
| Ultimate (I)   | Juramento Final — investida que prende em sequência | Colapso Tectônico — terremoto (pule para evitar) | Eclipse — teleporte + 8 cortes             |
| Fraqueza       | nenhuma vantagem extrema                            | lento, sofre contra mobilidade                   | pouca vida/defesa                          |

### Elenco expandido

| Lutador    | Título               | Arquétipo  | Vida / defesa | Corrida | Mecânica própria                                                                                                                                | Fraqueza                                   |
| ---------- | -------------------- | ---------- | ------------- | ------- | ----------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------ |
| Ayame      | Lâmina do Vento      | Velocidade | 90 / 0.95     | 500     | katana; **iaido** de alto dano; Passo do Vento (deslocamento em trajetória); corte crescente **overhead**; ultimate Pétalas com sequência presa | errar o iaido deixa Ayame exposta          |
| Valquíria  | A Campeã Alada       | Versátil   | 100 / 1.02    | 420     | lança de alcance longo; **dardo** arremessado; Égide (armadura); ultimate Julgamento em mergulho                                                | golpes longos e lentos, sofre de perto     |
| Mestre Han | A Montanha Paciente  | Defesa     | 98 / 1.08     | 380     | **postura de contra-ataque** (Água Parada) que devolve golpes e rebate projéteis; Passo do Tigre; ultimate-contra Céu Invertido                 | pouca pressão; sofre contra quem não ataca |
| R-0N       | Unidade de Contenção | Zoner      | 108 / 1.05    | 340     | canhão de **plasma**; Booster antiaéreo com armadura; ultimate Sobrecarga (feixe de 960 px, 6 acertos)                                          | pesado, recuperações longas                |
| Vesper     | A Tecelã de Órbitas  | Controle   | 92 / 0.95     | 390     | **orbes persistentes** que ocupam espaço (3 acertos cada); Lança de Luz baixa; ultimate Constelação (5 orbes)                                   | frágil quando o oponente encosta           |
| Dante      | A Brasa Insaciável   | Brutal     | 96 / 0.94     | 470     | Investida; **Pacto**: troca 8 de vida por armadura e dano; ultimate Inferno (custa 10 de vida)                                                  | recuperações longas e custo de vida        |

Vida mínima após custo de vida: 1 (Dante nunca se derrota sozinho).

### Desbloqueios (regras centralizadas em `src/data/progression/unlocks.ts`)

| Lutador     | Como desbloquear                           |
| ----------- | ------------------------------------------ |
| Kael, Bronn | disponíveis desde o início                 |
| Nyx         | vencer 2 lutas no Arcade                   |
| Ayame       | 10 esquivas perfeitas                      |
| Mestre Han  | 5 vitórias sem perder rodada               |
| R-0N        | nível de jogador 5                         |
| Vesper      | sequência de 3 vitórias no Arcade          |
| Dante       | derrotar o Reflexo                         |
| Valquíria   | primeiro título do Torneio da Última Arena |

O card mostra requisito e progresso. Não há desbloqueio administrativo; recompensas são concedidas uma única vez
(`claimedMatches` impede contabilizar a mesma luta duas vezes).

Final da escada arcade: **Reflexo** — sombra do próprio lutador (com a especialização do jogador, IA adaptativa que
lê o hábito de atacar baixo e de pular).

## Progressão

- **XP e nível de jogador:** `xpForLevel(n) = 100·(n−1)·n` (nível 5 = 2000 XP), máximo 30. Vitória 100, +30 por fase do
  Arcade, +80 por rodada do Torneio, bônus por perfeito/sem perder rodada/combo/vitória rápida, 20 por derrota (esforço).
  Treino não dá XP.
- **Maestria por lutador (I / II / III):** 300 e 900 XP do lutador. A partir da Maestria II o jogador escolhe 1 de 2
  **especializações** (ex.: Brasa Afiada × Juramento Firme). Bônus de 5–10% (cooldown, custo, frames de armadura/contra,
  invulnerabilidade...), nunca dano infinito nem combos novos. No Torneio os atributos são **padronizados**
  (especializações desligadas).
- **Conquistas:** 13 (primeira vitória, sequência, esquivas perfeitas, combo de 8, 5 perfeitas, caçador do Reflexo,
  campeão da arena, maestria absoluta, colecionador, versátil, guardião, arsenal, viajante). Dão XP e títulos exibidos
  no menu. Notificações aparecem só fora do combate.

## Modos

- **Arcade:** 5 oponentes em rotação + Reflexo na última arena. Derrotar o Reflexo libera Dante.
- **Torneio da Última Arena:** 8 lutadores em chave eliminatória (quartas, semi, final no Santuário das Cinzas),
  salvo a cada luta (pode recarregar no meio). Derrota encerra a edição; abandonar exige confirmação.
- **Narrativa:** o Conselho da Arena apresenta as rodadas; Valquíria é a campeã que defende o título; o Reflexo
  surge no fim do Arcade. Cenas curtas, sempre puláveis.

## Arenas

Coliseu Partido, Doca Neon, **Distrito Vertical** (chuva, letreiros, prédios industriais) e **Santuário das Cinzas**
(templo nas montanhas, braseiros, cinzas no ar, palco da final do Torneio).

## Regras de combate (resumo numérico em `src/config/gameConfig.ts`)

- 60 Hz fixos. Golpes têm startup/active/recovery em frames.
- Níveis: alto/médio (defesa em pé ou agachado), **baixo** (defesa agachada), **overhead**/aéreo (defesa em pé).
- Energia: ganha causando/recebendo dano, bloqueando e com **esquiva perfeita** (+10). Habilidades custam 15–30, ultimate 100.
- Combos: escalonamento de dano a partir do 3º golpe (×0.88 por golpe, mínimo 35%) e redução de hitstun (6%/golpe).
- Stun: medidor por golpe; ao estourar, o lutador fica atordoado (apertar botões reduz o tempo).
- Rodadas: melhor de 3, 99 s. Tempo esgotado → vence quem tem maior % de vida.

## Balanceamento verificado por testes (`tests/unit/fighters.test.ts`)

- Toques de cadeia leve para KO entre os lutadores dentro de uma faixa 1.6×.
- Tempo para KO com normais dentro de ±30% do Kael.
- Nenhum lutador domina outro em todos os atributos.
- IA difícil vence a fácil na maioria das simulações (`tests/unit/ai.test.ts`).

- Os 9 lutadores mantêm toques-para-KO e tempo-para-KO em faixas testadas (`tests/unit/roster.test.ts`).
- Cada novo lutador tem perfil de IA próprio e teste que exercita sua mecânica (contra, custo de vida, orbe persistente...).

## Save

Versão 2 (`SAVE_VERSION`), com migração automática da v1, sanitização de campos e cópia espelho `-last-good` usada se o
save principal corromper.

## Próximos passos

Arte final por spritesheets (ver `PENDING_ASSETS.md`), mais lutadores e arenas seguindo o mesmo formato de dados.
