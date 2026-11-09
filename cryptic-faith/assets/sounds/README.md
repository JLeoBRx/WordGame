# Sons

O jogo não usa arquivos de áudio: todos os efeitos sonoros e a música
ambiente são sintetizados em tempo real com a Web Audio API
(veja `js/audio.js`). Assim o jogo fica leve, funciona offline e abre
direto do disco, sem servidor.

Se no futuro quiser usar gravações próprias (`.mp3`/`.ogg`), coloque-as
nesta pasta e toque-as a partir de `js/audio.js`.
