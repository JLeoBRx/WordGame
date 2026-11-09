/*
 * Cryptic Faith — conteúdo das fases.
 *
 * Para criar uma nova fase, adicione um objeto a esta lista seguindo o
 * mesmo formato. O texto do Catecismo deve ser copiado integralmente.
 *
 * Os dados ficam em JavaScript (e não em um arquivo .json) para que o jogo
 * funcione abrindo o index.html direto do disco, sem servidor.
 */
(function (root) {
  'use strict';
  root.CF = root.CF || {};

  root.CF.LEVELS = [
    {
      id: 1,
      label: 'LEVEL 1',
      // Pergunta-tema mostrada antes da fase (não revela a frase).
      teaser: 'Para que fomos criados?',

      // Frase do desafio: síntese pedagógica do §1 (não é o texto oficial).
      phrase: 'VOCÊ FOI CRIADO POR AMOR, PARA VIVER COM DEUS.',

      // Letras já reveladas no início da fase.
      revealed: ['O', 'A'],
      maxErrors: 3,
      hints: 2,

      catechism: {
        heading: 'Catecismo da Igreja Católica — Parágrafo 1',
        reference: 'Catecismo da Igreja Católica, §1',
        paragraph: 1,
        text:
          'Deus, infinitamente perfeito e bem-aventurado em Si mesmo, num desígnio de pura bondade, ' +
          'criou livremente o homem para o tornar participante da sua vida bem-aventurada. ' +
          'Por isso, sempre e em toda a parte, Ele está próximo do homem. ' +
          'Chama-o e ajuda-o a procurá-Lo, a conhecê-Lo e a amá-Lo com todas as suas forças. ' +
          'Convoca todos os homens, dispersos pelo pecado, para a unidade da sua família que é a Igreja. ' +
          'Para tal, enviou o seu Filho como Redentor e Salvador na plenitude dos tempos. ' +
          "N'Ele e por Ele, chama os homens a tornarem-se, no Espírito Santo, seus filhos adoptivos e, " +
          'portanto, herdeiros da sua vida bem-aventurada.'
      },

      reflection: 'Se Deus nos criou por amor, como podemos responder a esse amor no nosso dia a dia?'
    }
  ];
})(typeof globalThis !== 'undefined' ? globalThis : this);
