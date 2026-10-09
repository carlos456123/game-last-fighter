# LAST FIGHTER — Documento de Design (v0.1)

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

Final da escada arcade: **Reflexo** — sombra do próprio lutador (mesmos golpes, IA mais agressiva/defensiva, paleta sombria).
Nyx começa bloqueada: **vença 2 batalhas** (o motivo e o progresso aparecem no card).

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

## Expansão planejada (fase 13)

Meta de 12–15 lutadores cobrindo os demais arquétipos (zoner, técnico, controle, combo, defensivo...). Cada novo lutador é
um arquivo de dados + textos (ver README). Novas arenas idem. A arquitetura de XP/níveis já existe; skins, moedas,
desafios e conquistas podem ser acrescentados ao `SaveData` via migração de versão.
