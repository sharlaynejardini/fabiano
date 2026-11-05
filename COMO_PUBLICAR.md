# Avaliação com dashboard no GitHub Pages

O `index.html` contém a avaliação e o dashboard do professor. As respostas de todos os aparelhos ficam na planilha Google privada. O GitHub Pages hospeda a página; o Google Apps Script recebe e consulta os dados.

## 1. Ativar o serviço de gravação

1. Abra a planilha criada: https://docs.google.com/spreadsheets/d/1AB463OfsoIZuXvZE1B002EMikA5xpjZ9SW3H0xa0Aec/edit
2. Na planilha, abra **Extensões → Apps Script**.
3. Substitua o conteúdo de `Código.gs` pelo conteúdo do arquivo [Codigo.gs](./Codigo.gs) desta pasta. O identificador da planilha já está preenchido. Não é necessário criar um arquivo HTML no Apps Script.
4. Salve. Selecione a função **configurar_** no editor e clique em **Executar**. Autorize o acesso à sua planilha na sua conta Google. Essa função registra a senha solicitada e prepara os formatos. Não a execute novamente se tiver trocado a senha nas propriedades.
5. Abra **Implantar → Nova implantação → Aplicativo da Web**.
6. Em **Executar como**, escolha **Eu**. Em **Quem pode acessar**, escolha **Qualquer pessoa**, para permitir o envio dos alunos. A planilha continua privada; o serviço só libera os dados do painel após validar a senha.
7. Clique em **Implantar** e copie a URL que termina em `/exec`.

Se a conta da escola não oferecer acesso para qualquer pessoa, essa restrição depende do administrador do Google Workspace. A aplicação não estará liberada para os alunos até que a implantação permita o acesso necessário.

## 2. Conectar o HTML

1. Abra o [index.html](../index.html) da pasta Fabiano em um editor de texto.
2. Localize esta linha: `const API_URL = "";`
3. Cole a URL copiada entre as aspas, por exemplo: `const API_URL = "https://script.google.com/macros/s/SEU_IDENTIFICADOR/exec";`
4. Salve o arquivo. A URL é pública e não contém a senha. Sem essa configuração, o início da avaliação fica desativado para evitar entregas sem destino.

## 3. Publicar no GitHub Pages

1. Envie **somente `index.html`** para a pasta publicada do seu repositório. O nome deve estar em letras minúsculas.
2. Ative o GitHub Pages na origem desejada em **Settings → Pages**.
3. Abra o endereço publicado e confira se o aviso de configuração desapareceu.
4. Clique em **Área do professor** e entre com a senha informada na conversa.
5. Faça uma entrega identificada como teste, em uma turma chamada TESTE. Confirme que aparece no painel com a nota e as respostas. Você pode usar o filtro de turma para separar esse teste das turmas reais.

Não envie a pasta `avaliacao-matematica`, o arquivo `Codigo.gs`, exportações CSV, nem dados de estudantes ao repositório público. Os arquivos dentro dessa pasta são materiais de configuração e desenvolvimento.

## Usar o dashboard

- Acesse **Área do professor** na própria página.
- Use **Turma** e **Buscar aluno** para filtrar os indicadores, gráficos e lista de notas.
- Clique em **Questão** para ver o enunciado e as alternativas escolhidas.
- Clique em **Ver respostas** para consultar o desempenho individual.
- Use **Atualizar** para buscar novas entregas e **Exportar CSV** para baixar o recorte atual.
- Clique em **Sair** ao terminar. A sessão dura até 30 minutos, pode expirar antes se o cache do Google for liberado, e não é salva no navegador.

Uma nova tentativa recebe outro protocolo. Reenviar a mesma entrega após falha de conexão preserva o protocolo e não duplica o registro. O rascunho no aparelho ajuda a recuperar respostas ainda não confirmadas; ele não substitui a gravação central.

Cada questão vale um ponto. A nota de 0 a 10 é calculada por `acertos ÷ 30 × 10`. A questão 27 teve as unidades das alternativas corrigidas para m². O gabarito D foi mantido. A nota não é uma conversão para a escala TRI do Avalia+.

## Alterar a senha depois

Em **Configurações do projeto → Propriedades do script**, altere `SENHA_HASH` para o SHA-256 da nova senha. O HTML não guarda a senha e não precisa ser alterado por isso. Execute essa mudança na sua conta; não publique a senha no repositório.

## Situação da entrega

O HTML, o dashboard e o serviço de gravação foram preparados. A implantação do serviço e o teste de uma entrega no endereço publicado precisam ser concluídos na sua conta. A existência do HTML, sozinha, não significa que a gravação central já está ativa.

Referências: https://developers.google.com/apps-script/guides/web e https://docs.github.com/en/pages/getting-started-with-github-pages/creating-a-github-pages-site
