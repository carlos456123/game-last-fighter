# PENDING_ASSETS

Assets provisórios em uso. Nenhum causa imagem quebrada: todos são gerados pelo próprio jogo e estão listados aqui
para serem substituídos por arte final. A troca não exige mudança na simulação (somente na camada de renderização).

| Asset                                                                       | Status                                                 | Localização                                          | Descrição                                                                                                   | Prioridade |
| --------------------------------------------------------------------------- | ------------------------------------------------------ | ---------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- | ---------- |
| Lutadores (9: Kael, Bronn, Nyx, Ayame, Valquíria, Han, R-0N, Vesper, Dante) | Provisório procedural (rig vetorial com IK)            | `src/animation/FighterRenderer.ts`, `PoseLibrary.ts` | Todas as 18+ animações exigidas existem como poses-chave. Substituir por spritesheets finais por personagem | Alta       |
| Retratos dos lutadores                                                      | Provisório (rig ao vivo nos cards)                     | `src/ui/CharacterCard.ts`                            | Retrato ilustrado 512×512 por personagem                                                                    | Média      |
| Arenas (Coliseu, Doca Neon, Distrito Vertical, Santuário das Cinzas)        | Provisório procedural (camadas vetoriais com parallax) | `src/render/ArenaRenderer.ts`                        | Pintura de fundo em 3–4 camadas de parallax por arena                                                       | Média      |
| Música (menu + 4 temas de batalha + tema do chefe)                          | Provisório sintetizado (WebAudio)                      | `src/systems/audio/MusicTracks.ts`                   | Composições originais finais (OGG/MP3, loop)                                                                | Média      |
| Efeitos sonoros                                                             | Provisório sintetizado (WebAudio)                      | `src/systems/AudioManager.ts`                        | SFX gravados/produzidos por golpe e por personagem                                                          | Baixa      |
| Texturas de partículas                                                      | Final aceitável (geradas)                              | `src/systems/AssetManager.ts` (`TEXTURES`)           | Pode receber versões pintadas                                                                               | Baixa      |
| Emblema / favicon                                                           | Final v1 (SVG original)                                | `public/assets/ui/emblem.svg`                        | Versão vetorial definitiva pelo diretor de arte                                                             | Baixa      |
| Logo horizontal/compacto                                                    | Final v1 (tipografia + vetor)                          | `src/ui/Logo.ts`                                     | Lettering customizado em SVG                                                                                | Baixa      |

## Especificação para spritesheets finais (um por lutador)

```
asset_id:   <fighter>_sheet
tipo:       spritesheet + atlas JSON
dimensão:   frames de 256×256, personagem com ~190 px de altura (Bronn ~214, Nyx ~178)
proporção:  pés no centro inferior do frame (origem 0.5, 1.0)
fundo:      transparente
paleta:     a definida em src/data/characters/<id>.ts (palette)
uso:        BattleScene / CharacterSelect / Menu
animação:   idle, walk, run, jump, fall, crouch, attack_light (x3 encadeados), attack_heavy, block, crouch_block,
            hit, knockback, knockdown, wakeup, dodge, stun, special_1, special_2, ultimate, victory, defeat
```

Silhuetas obrigatórias (o jogo é legível só pelo contorno): Ayame rabo de cavalo + katana; Valquíria elmo alado + capa +
lança; Han coque + barba longa; R-0N cabeça robótica com antena + canhão no braço; Vesper cabelo longo + cajado;
Dante moicano + ombreira com espinhos.

### Prompts de geração (manter consistência de proporção, roupa e iluminação vinda da esquerda-alto)

- **Kael** — "Lutador de artes marciais, 25 anos, faixa vermelha na testa com duas pontas longas, cabelo preto espetado,
  gi vermelho-carmesim sem mangas com faixa clara na cintura, ataduras creme nos antebraços, calça escura, postura de guarda
  equilibrada, estilo 2D estilizado com contorno escuro grosso, cores chapadas com uma sombra, fundo transparente, vista lateral."
- **Bronn** — "Ex-mineiro gigante, 40 anos, barba castanha, ombreiras de metal âmbar, manoplas âmbar enormes, colete azul-aço,
  cinto âmbar, postura larga e inclinada para frente, mesmo estilo e contorno, vista lateral."
- **Nyx** — "Assassina mascarada, capuz violeta, cachecol longo violeta com ponta turquesa, máscara cobrindo a boca, olhos
  turquesa brilhantes, duas lâminas curtas turquesa em pegada reversa, roupa justa escura, postura baixa e inclinada, mesmo estilo."
- **Ayame** — "Espadachim jovem, rabo de cavalo preto longo, faixa branca, kimono curto verde-jade com hakama escura,
  katana fina, postura baixa pronta para sacar, mesmo estilo e contorno, vista lateral."
- **Valquíria** — "Campeã alada, 30 anos, elmo prateado com asas laterais, armadura leve branca e dourada, capa azul-real,
  lança longa com ponta dourada, postura ereta e confiante, mesmo estilo, vista lateral."
- **Mestre Han** — "Mestre de artes marciais idoso, careca com coque branco no topo, barba branca longa, túnica laranja e
  marrom, palmas abertas em postura de guarda serena, mesmo estilo, vista lateral."
- **R-0N** — "Robô de contenção humanoide, cabeça com visor azul e antena, carcaça cinza-chumbo com detalhes laranja,
  braço direito em canhão de plasma ciano, corpo pesado e quadrado, mesmo estilo, vista lateral."
- **Vesper** — "Maga de órbitas, cabelo longo lilás claro, manto branco e lavanda com estrelas, cajado com orbe luminoso
  na ponta, postura elegante, mesmo estilo, vista lateral."
- **Dante** — "Lutador de rua temperamental, moicano vermelho-fogo, ombreira de couro com espinhos, regata preta,
  ataduras laranja nas mãos, chamas saindo dos punhos, postura agressiva inclinada, mesmo estilo, vista lateral."

### Arenas

- **Distrito Vertical** — "Rua entre arranha-céus industriais à noite, chuva, letreiros neon rosa e ciano, passarelas
  metálicas, chão molhado refletindo luzes, 3–4 camadas de parallax, 2560×720."
- **Santuário das Cinzas** — "Templo no topo de montanhas ao pôr do sol vermelho, braseiros acesos, cinzas flutuando,
  telhados curvos em silhueta, piso de pedra gasta, 3–4 camadas de parallax, 2560×720."

## Pipeline de arte (como trocar o placeholder pela arte final)

1. **Gerar/desenhar** cada animação da lista acima no frame de 256×256, pés no centro inferior, fundo transparente.
   Nenhuma arte gerada foi incluída no repositório: tudo que existe hoje é desenhado pelo rig procedural.
2. **Revisar** proporção (altura do personagem coerente com a hurtbox em `src/data/characters/<id>.ts`), paleta e
   silhueta lado a lado com o rig atual (`npm run dev` → Arcade → seleção de lutador).
3. **Empacotar** em atlas (`<id>_sheet.png` + `<id>_sheet.json`, formato JSON Hash do TexturePacker/free-tex-packer) em
   `public/assets/fighters/<id>/`.
4. **Registrar** em `ASSET_CATALOG` (`src/systems/AssetManager.ts`). Se o arquivo faltar, o jogo continua com o rig.
5. **Ligar** no `FighterRenderer`: quando o atlas existir, desenhar o frame da animação atual em vez das formas do rig. As
   chaves de animação (`AnimationRegistry`) são as mesmas, então a simulação, hitboxes e testes não mudam.
6. **Validar** com `npm run test`, `npm run test:e2e` e capturas de tela de cada golpe (hitbox visível no modo treino).
7. Atualizar esta tabela (status → Final) e os créditos/licença do artista.
