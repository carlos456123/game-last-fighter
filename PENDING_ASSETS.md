# PENDING_ASSETS

Assets provisórios em uso. Nenhum causa imagem quebrada: todos são gerados pelo próprio jogo e estão listados aqui
para serem substituídos por arte final. A troca não exige mudança na simulação (somente na camada de renderização).

| Asset                               | Status                                                 | Localização                                          | Descrição                                                                                                   | Prioridade |
| ----------------------------------- | ------------------------------------------------------ | ---------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- | ---------- |
| Lutadores (Kael, Bronn, Nyx)        | Provisório procedural (rig vetorial com IK)            | `src/animation/FighterRenderer.ts`, `PoseLibrary.ts` | Todas as 18+ animações exigidas existem como poses-chave. Substituir por spritesheets finais por personagem | Alta       |
| Retratos dos lutadores              | Provisório (rig ao vivo nos cards)                     | `src/ui/CharacterCard.ts`                            | Retrato ilustrado 512×512 por personagem                                                                    | Média      |
| Arenas (Coliseu Partido, Doca Neon) | Provisório procedural (camadas vetoriais com parallax) | `src/render/ArenaRenderer.ts`                        | Pintura de fundo em 3–4 camadas de parallax por arena                                                       | Média      |
| Música (menu + 2 temas de batalha)  | Provisório sintetizado (WebAudio)                      | `src/systems/audio/MusicTracks.ts`                   | Composições originais finais (OGG/MP3, loop)                                                                | Média      |
| Efeitos sonoros                     | Provisório sintetizado (WebAudio)                      | `src/systems/AudioManager.ts`                        | SFX gravados/produzidos por golpe e por personagem                                                          | Baixa      |
| Texturas de partículas              | Final aceitável (geradas)                              | `src/systems/AssetManager.ts` (`TEXTURES`)           | Pode receber versões pintadas                                                                               | Baixa      |
| Emblema / favicon                   | Final v1 (SVG original)                                | `public/assets/ui/emblem.svg`                        | Versão vetorial definitiva pelo diretor de arte                                                             | Baixa      |
| Logo horizontal/compacto            | Final v1 (tipografia + vetor)                          | `src/ui/Logo.ts`                                     | Lettering customizado em SVG                                                                                | Baixa      |

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

### Prompts de geração (manter consistência de proporção, roupa e iluminação vinda da esquerda-alto)

- **Kael** — "Lutador de artes marciais, 25 anos, faixa vermelha na testa com duas pontas longas, cabelo preto espetado,
  gi vermelho-carmesim sem mangas com faixa clara na cintura, ataduras creme nos antebraços, calça escura, postura de guarda
  equilibrada, estilo 2D estilizado com contorno escuro grosso, cores chapadas com uma sombra, fundo transparente, vista lateral."
- **Bronn** — "Ex-mineiro gigante, 40 anos, barba castanha, ombreiras de metal âmbar, manoplas âmbar enormes, colete azul-aço,
  cinto âmbar, postura larga e inclinada para frente, mesmo estilo e contorno, vista lateral."
- **Nyx** — "Assassina mascarada, capuz violeta, cachecol longo violeta com ponta turquesa, máscara cobrindo a boca, olhos
  turquesa brilhantes, duas lâminas curtas turquesa em pegada reversa, roupa justa escura, postura baixa e inclinada, mesmo estilo."
