# Cryptic Faith — protótipo jogável

Jogo de criptograma para aprender o **Catecismo da Igreja Católica** de forma
interativa. Esta primeira fase é baseada no **§1**.

O jogador recebe uma frase escrita em símbolos, descobre qual letra cada
símbolo esconde e, ao vencer, lê o texto integral do parágrafo do Catecismo,
com uma pergunta para reflexão.

Feito apenas com **HTML, CSS e JavaScript puro**. Não há servidor, banco de
dados, build nem dependências externas.

---

## Como abrir

- **No computador:** dê dois cliques em `index.html`. Funciona direto do disco
  (`file://`), sem servidor local.
- **No GitHub Pages:** veja a seção [Publicar](#publicar-no-github-pages).

Testado no Chromium (desktop e tamanhos de celular). Usa apenas recursos
suportados pelas versões recentes de Chrome, Edge, Firefox e Safari.

## Como jogar

1. Toque em **JOGAR** e depois em **COMEÇAR**.
2. Cada símbolo esconde uma letra. O mesmo símbolo é sempre a mesma letra e
   letras diferentes nunca dividem um símbolo.
3. Toque num símbolo e escolha uma letra no teclado. Todas as posições com
   aquele símbolo são preenchidas de uma vez.
4. **Acerto:** a letra é revelada em dourado.
   **Erro:** a letra fica vermelha e conta uma tentativa. Corrija digitando
   outra letra, use **APAGAR** (símbolo selecionado) ou **LIMPAR** (todas as
   letras erradas).
5. São **3 erros** permitidos. No terceiro, a fase termina e você pode tentar
   de novo (com uma cifra nova).
6. **DICA** revela o símbolo selecionado. São 2 por fase e não contam como erro.

### Teclado físico

| Tecla | Ação |
| --- | --- |
| `A`–`Z`, `Ç` | escolher letra (letras acentuadas também funcionam: `ê` vale `E`) |
| `←` `→` `↑` `↓` | mudar de símbolo |
| `Backspace` / `Delete` | apagar a letra errada do símbolo |
| `Esc` | pausar / fechar janelas |
| `Enter` | começar a fase |

## Regras do criptograma (decisões de design)

- **Cifra por substituição completa:** cada uma das 27 letras (A–Z e Ç)
  recebe um símbolo diferente. A cifra é sorteada a cada partida.
- **Acentos:** vogais acentuadas usam o símbolo da letra base. Digitar `E`
  revela `Ê` em "VOCÊ", mantendo o acento original na tela.
- **Ç** é uma letra própria, com símbolo e tecla próprios (C não resolve Ç).
- **Espaços, vírgulas e pontos** são preservados e nunca cifrados.
- **Letras reveladas no início:** `O` e `A` (configurável por fase).
- **Erros justos:** repetir uma letra já tentada no mesmo símbolo, ou digitar
  uma letra já descoberta em outro símbolo, mostra um aviso mas **não** conta
  erro. Letras corretas ficam travadas.
- **Após perder**, nenhuma letra é aceita até reiniciar a fase.
- A fase só termina quando **toda a frase** está correta.

### Cores

| Onde | Cor | Significado |
| --- | --- | --- |
| Frase | disco escuro com símbolo dourado | ainda não decifrado |
| Frase | verde luminoso | símbolo selecionado (os iguais ganham contorno verde) |
| Frase | creme | revelada no início |
| Frase | dourado | descoberta pelo jogador |
| Frase | vermelho | letra errada |
| Teclado | creme | disponível |
| Teclado | verde | letra descoberta |
| Teclado | azul-petróleo escuro | revelada no início |
| Teclado | vermelho com × | já tentada no símbolo selecionado |

## Conteúdo da fase 1

- **Frase do desafio** (síntese pedagógica, não é o texto oficial):
  "VOCÊ FOI CRIADO POR AMOR, PARA VIVER COM DEUS."
- **Texto revelado após a vitória:** Catecismo da Igreja Católica, §1, na
  íntegra (`js/levels.js`). Um teste automatizado confere o texto caractere
  por caractere.
- **Para refletir:** "Se Deus nos criou por amor, como podemos responder a esse
  amor no nosso dia a dia?"

## Estrutura

```
cryptic-faith/
├── index.html            telas e janelas do jogo
├── css/
│   └── style.css         identidade visual, animações e layout responsivo
├── js/
│   ├── cryptogram.js     motor do criptograma (sem DOM, testável)
│   ├── levels.js         conteúdo das fases
│   ├── symbols.js        os 27 símbolos da cifra, em SVG
│   ├── audio.js          efeitos e música sintetizados (Web Audio API)
│   ├── interface.js      desenho da tela, teclado, janelas e partículas
│   └── game.js           regras da partida, tempo, pausa, vitória e salvamento
├── assets/
│   ├── images/icon.svg   ícone do site
│   ├── fonts/            Fredoka, Nunito e Lora (licença SIL OFL)
│   └── sounds/           vazio: os sons são gerados em tempo real
├── tests/
│   ├── index.html        abre os testes do motor no navegador
│   └── cryptogram.test.js
└── README.md
```

Os scripts são clássicos (não módulos ES) e os dados ficam em JavaScript, não
em JSON. Isso permite abrir o jogo direto do disco, onde o navegador bloquearia
`import` e `fetch`.

## Criar novas fases

Adicione um objeto em `js/levels.js`:

```js
{
  id: 2,
  label: 'LEVEL 2',
  teaser: 'Pergunta-tema mostrada antes da fase',
  phrase: 'FRASE DO DESAFIO.',
  revealed: ['A', 'E'],
  maxErrors: 3,
  hints: 2,
  catechism: {
    heading: 'Catecismo da Igreja Católica — Parágrafo 2',
    reference: 'Catecismo da Igreja Católica, §2',
    paragraph: 2,
    text: 'Texto integral do parágrafo…'
  },
  reflection: 'Pergunta para refletir'
}
```

Hoje o jogo abre sempre `CF.LEVELS[0]` (`js/game.js`). Para várias fases, falta
uma tela de seleção de níveis e salvar o avanço por `id`, que o armazenamento
local já suporta.

## Salvamento local

Usa `localStorage` apenas para:

- preferências: música, sons e vibração (`crypticFaith.settings.v1`);
- recorde da fase: concluída, melhor tempo e estrelas (`crypticFaith.progress.v1`).

Se o navegador bloquear o armazenamento (modo privado), o jogo funciona
normalmente, só não lembra as preferências. Em **Configurações** há um botão
para apagar o progresso salvo.

## Testes

- **No navegador:** abra `tests/index.html`. São 30 testes do motor: cifra
  bijetora, mesma letra ⇒ mesmo símbolo, Ê/E, Ç, pontuação, erros, apagar,
  limpar, derrota no 3º erro, bloqueio após perder, vitória, dicas,
  reinício e integridade do texto do Catecismo.
- **No terminal (opcional, se tiver Node):** `node tests/cryptogram.test.js`.

O jogo também foi testado de ponta a ponta num navegador automatizado
(Chromium): partida completa até a vitória e a leitura do §1, derrota,
pausa/retomada com o cronômetro parado, teclado físico, reinício, voltar ao
menu, configurações salvas, e telas de 320×568 até 1920×1080, incluindo
celular deitado.

## Publicar no GitHub Pages

1. No GitHub, abra **Settings → Pages**.
2. Em **Build and deployment**, escolha **Deploy from a branch**, a branch
   desejada e a pasta **/ (root)**.
3. Salve. Em alguns minutos o site fica em
   `https://<usuario>.github.io/<repositorio>/`.

O `index.html` da raiz do repositório redireciona para `cryptic-faith/`.
O arquivo `.nojekyll` evita o processamento do Jekyll.

## Acessibilidade

- Funciona inteiro pelo teclado; as janelas recebem o foco e `Esc` as fecha.
- Leitores de tela recebem rótulos para cada símbolo e tecla, e avisos de
  acerto, erro e vitória.
- Respeita a preferência do sistema por **movimento reduzido**.
- Música, sons e vibração podem ser desligados a qualquer momento.

## Créditos

- Fontes: [Fredoka](https://fonts.google.com/specimen/Fredoka),
  [Nunito](https://fonts.google.com/specimen/Nunito) e
  [Lora](https://fonts.google.com/specimen/Lora), todas sob SIL Open Font
  License 1.1 (licenças em `assets/fonts/`).
- Símbolos da cifra, ícones, ilustração do livro, sons e música: criados para
  este projeto.
- Referência visual: template de jogo de criptograma mobile (imagens em
  `../game/`), adaptado com identidade própria.
