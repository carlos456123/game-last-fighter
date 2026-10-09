# LAST FIGHTER

Jogo de luta 2D original (luta + sobrevivência + progressão) para navegador, feito com **Phaser 4 + TypeScript + Vite**.
Single-player offline: modo arcade "A Última Arena" contra IA, modo treino interativo, 3 lutadores, 2 arenas.

> O mundo é dominado pela **Última Arena**. Guerreiros que restaram são convocados. Não basta vencer — é preciso sobreviver.

## Requisitos

- Node.js 20.19+ ou 22.12+ (testado com Node 24)
- Navegador com WebGL (Chrome, Edge, Firefox, Safari recentes)

## Instalação e execução

```bash
npm install
npm run dev          # http://localhost:5173
npm run build        # typecheck + build estático em dist/
npm run preview      # serve dist/ em http://localhost:4173
```

## Qualidade e testes

```bash
npm run lint         # ESLint
npm run format       # Prettier
npm run typecheck    # tsc (código do jogo + configs/e2e)
npm run test         # Vitest — lógica pura (combate, IA, save, progressão, dados)
npm run test:e2e     # Playwright — fluxo real no navegador (desktop + mobile)
```

Na primeira execução dos E2E: `npx playwright install chromium`.
Os E2E usam um build especial (`vite build --mode e2e`) que expõe `window.__LF__` apenas para **observar** o estado;
os testes interagem por cliques, toques e teclas reais. O build de produção não contém esse gancho.

## Controles

| Ação                         | Teclado (padrão) | Touch               |
| ---------------------------- | ---------------- | ------------------- |
| Mover / correr (toque duplo) | A / D (ou ← →)   | Joystick            |
| Pular / pulo duplo (Nyx)     | W (ou ↑)         | Joystick para cima  |
| Agachar                      | S (ou ↓)         | Joystick para baixo |
| Ataque leve / pesado         | J / K            | J / K               |
| Habilidade / Especial        | L / U            | L / U               |
| Ultimate (barra cheia)       | I                | I                   |
| Defesa (segurar)             | ESPAÇO           | DEF                 |
| Esquiva                      | ESPAÇO + direção | ESQ                 |
| Pausa                        | ESC / P          | botão ⏸             |

Todos os comandos são remapeáveis em **Configurações → Controles** (conflitos são resolvidos trocando as teclas).
Em desenvolvimento, **F1** mostra o overlay de debug (FPS, estados, IA, hitboxes/hurtboxes/pushboxes, cooldowns).

## Arquitetura

```
src/
├── core/        Match (rodadas, timer, KO, hitstop, super freeze) + EventBus tipado — lógica pura
├── characters/  Character (máquina de estados + frame data + física própria), estados, stats, factory
├── combat/      CombatSystem, HitboxSystem, DamageSystem, ComboSystem, SkillSystem, PushSystem, Projectile
├── ai/          EnemyAI (máquina de estados), DecisionSystem (utilidade), BehaviorProfile (dificuldade), TrainingDummy
├── input/       InputBuffer, InputFrame, KeyboardController, TouchController, InputManager, ControlMapping
├── animation/   PoseLibrary (poses-chave), Skeleton (IK), AnimationRegistry (estado → animação), FighterRenderer
├── render/      ArenaRenderer (parallax/iluminação/partículas), VfxManager (efeitos por eventos)
├── ui/          design system (theme), Button, Widgets, HUD, barras, slots, VirtualControls, ícones...
├── systems/     Save (versionado + migração), Settings, Localization, Audio (WebAudio sintetizado), Progression, Assets
├── scenes/      Boot, Preload, Menu, CharacterSelect, Tutorial, Battle, Pause, Victory, Defeat, Settings, Credits
├── data/        lutadores, arenas, locales/pt-BR.json
└── config/      gameConfig (todas as constantes centrais), phaserConfig
```

Princípios:

- **Simulação separada da apresentação.** `Match`/`Character`/`CombatSystem`/`EnemyAI` não importam Phaser; rodam a 60 Hz fixos
  (acumulador em `BattleScene`) e são testados em Node. Isso também deixa a porta aberta para multiplayer (lockstep/rollback).
- **Orientado a dados.** Personagens, golpes (startup/active/recovery, dano, stun, knockback, custo, cooldown, armadura,
  invulnerabilidade, projéteis, teleporte, sequência de ultimate) e arenas são dados. Não existe `if (personagem === 'x')`.
- **Eventos desacoplam efeitos.** `hit`, `block`, `ko`, `ultimateStart`... alimentam HUD, áudio e partículas independentemente.
- **IA justa.** A IA só produz `InputFrame`s, como um jogador: obedece energia, cooldowns e frame data. A dificuldade muda tempo de
  reação, precisão, frequência de defesa/esquiva/antiaéreo e erros de combo — nunca o dano.
- **Hitbox ≠ hurtbox ≠ pushbox**, com hurtbox estendida no membro durante o golpe (dá para punir golpes errados).
- **Input buffer** de 8 frames que continua recebendo comandos durante o hitstop; detecção de toque duplo para corrida.
- **Combos** por cancelamento (leve → leve → ... → pesado → habilidade → ultimate) com escalonamento de dano e de hitstun,
  limite de juggle — teste automatizado garante que não há combo infinito.

## Como adicionar um personagem

1. Crie `src/data/characters/<id>.ts` exportando um `FighterData` (use `move()`/`hit()` de `moveFactory.ts`).
2. Defina corpo/paleta/acessórios (`body.features`) — o rig procedural desenha a silhueta a partir disso.
3. Registre em `src/data/characters/index.ts` (`FIGHTERS`).
4. Adicione os textos em `src/data/locales/pt-BR.json` (`fighters.<id>.*` e `moves.<moveId>.*`).
5. Ajuste o `ai` (perfil 0–100). Os papéis dos golpes (zoning, antiaéreo, aproximação) são inferidos dos dados.
6. `npm run test` valida dados, chaves de texto e faixas de balanceamento automaticamente.

## Como adicionar uma arena

1. Adicione um `ArenaData` em `src/data/arenas/index.ts` (camadas `sky`, `sun`, `silhouette`, `props`, `floor`, limites, spawn, música, ambiente).
2. Registre em `ARENAS` e adicione `arenas.<id>.*` no locale. A escada arcade passa a usá-la automaticamente.

## Como adicionar uma habilidade

Adicione um `MoveData` ao lutador e aponte um slot (`skill`, `special`, `ultimate`...) para ele. Campos disponíveis:
`startup/active/recovery`, `hitbox`, `hits`, `hit` (dano, chip, stun, hitstun, blockstun, knockback, launch, knockdown, nível
alto/médio/baixo/overhead, hitstop, tremor, VFX, SFX), `energyCost`, `cooldown`, `movement`, `projectile`, `teleport`,
`invulnerable`, `armor`, `cinematicFreeze`, `lock` (sequência de ultimate), `groundedTargetsOnly`, `cancels`, `chain`, `startSfx`.
Se precisar de uma nova pose, adicione-a em `animation/PoseLibrary.ts` e referencie pelo campo `animation`.

## Como adicionar um asset

Registre em `ASSET_CATALOG` (`src/systems/AssetManager.ts`) com caminho em `public/assets/...`. Se o arquivo faltar, o jogo
gera um placeholder identificado e registra o aviso — nada quebra. Liste pendências em `PENDING_ASSETS.md`.

## Deploy

`npm run build` gera `dist/` estático com caminhos relativos (`base: './'`), compatível com GitHub Pages, Netlify, Vercel e
Cloudflare Pages sem configuração específica. Existe um `manifest.webmanifest` preparando um futuro PWA (sem service worker).

## Licenças

Código e conteúdo originais. Phaser (MIT). Fontes Russo One e Chakra Petch via `@fontsource` (SIL Open Font License 1.1).
Música e efeitos sonoros são sintetizados em tempo real pelo próprio jogo. Ver `PENDING_ASSETS.md` e `docs/GAME_DESIGN.md`.
