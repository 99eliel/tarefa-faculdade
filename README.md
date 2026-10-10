# CloudBilling Manager

Projeto acadêmico: painel para cadastro de contêineres **simulados**, atribuição de custo mensal fictício e documentação PDF. Não cria contêineres reais nem emite cobranças no Google Cloud.

## Tecnologias
HTML, CSS e JavaScript (sem build), Firebase Authentication, Cloud Firestore, Cloud Storage e Firebase Hosting.

## Configuração inicial
1. No [Firebase Console](https://console.firebase.google.com/project/cloudservicepayment/overview), ative **Authentication > Sign-in method > E-mail/senha**.
2. Crie um usuário em **Authentication > Users**.
3. Ative o Firestore. Na coleção `admins`, crie um documento cujo **ID seja o UID** do usuário criado; adicione o campo `email` (string) com o e-mail desse usuário. É esse documento que libera acesso administrativo.
4. Publique as regras de `firestore.rules` no Firestore.
5. Ative o Cloud Storage (pode exigir faturamento Blaze) e publique `storage.rules`. Uploads e obtenção de links exigem administrador; PDFs são limitados a 10 MB. Os links de download usam tokens compartilháveis: quem receber um link pode acessar o arquivo.
6. Hospede usando Firebase CLI: `npm install -g firebase-tools`, `firebase login`, `firebase use cloudservicepayment` (ou `firebase use --add`), `firebase deploy --only hosting,firestore:rules,storage`.
7. Abra o site e entre com e-mail/senha do administrador.
8. Para login Google, ative também o provedor **Google** e inclua os domínios usados pelo Firebase Hosting e pelo GitHub Pages em **Authentication > Settings > Authorized domains**.

**Importante:** credenciais web do Firebase não substituem regras de segurança. Não utilize regras públicas em produção. O cadastro de administradores é deliberadamente manual para impedir autoelevação de permissões.

## Funcionalidades
- Login com restrição a administradores registrados no Firestore;
- Dashboard de contêineres, valores mensais e estatísticas;
- Criar, editar, pesquisar, filtrar, pausar, ativar e excluir contêineres simulados;
- Dados de CPU, memória RAM, disco, imagem e descrição;
- PDF por contêiner com upload/download seguro;
- Relatório CSV exportável e gráfico mensal ilustrativo (projeção de valor mensal atual).

## Limitações didáticas
- Os valores são definidos pelo administrador; não representam a tabela de preços do Google.
- Não há provisionamento de Docker/Cloud Run ou pagamentos reais.
- O histórico financeiro ainda não é registrado como faturamento efetivamente fechado.

## Salvamento e recuperação de PDFs

Os campos do contêiner são salvos antes do anexo. Se o upload falhar, o formulário mantém o ID confirmado: clicar em **Salvar** novamente atualiza o mesmo cadastro. Também é possível cancelar e manter o cadastro sem o novo PDF.

Se o arquivo foi enviado, mas o vínculo no Firestore falhou, a tentativa mantém o caminho do PDF em memória e bloqueia a troca do arquivo. **Salvar** tenta concluir o vínculo sem repetir o upload. **Cancelar** consulta o documento no servidor antes de remover um arquivo não vinculado; se essa consulta falhar, o formulário preserva a tentativa para recuperação. Um PDF que já esteja vinculado não é apagado por causa de uma resposta incerta.

Essa recuperação vale enquanto a página e a sessão permanecem abertas. Recarregar ou encerrar a página durante uma operação pode deixar um anexo órfão; Firestore e Storage não compartilham uma transação. Falhas na remoção do PDF anterior são informadas ao usuário. Uma rotina persistente de reconciliação de anexos é uma melhoria futura.

## Validação e compatibilidade

A interface valida campos e limites antes de gravar. Na leitura, aceita números armazenados como strings por versões antigas e usa sempre o ID real do documento. Cadastros incompatíveis são omitidos das tabelas, dos totais e do CSV com um aviso visível, preservando os documentos originais. Esses documentos precisam ser revisados no Firestore; não são corrigidos automaticamente.

As regras atuais autorizam administradores, mas ainda não validam o esquema dos documentos. A validação no navegador melhora a confiabilidade e não substitui validação nas regras. O endurecimento das regras deve ser acompanhado de testes em emuladores e revisão da compatibilidade com os documentos existentes.

## Verificações locais

Requer Node.js 22 ou superior, sem instalar dependências:

```sh
node --test tests/app.test.cjs
```

Os testes executam o JavaScript da página com DOM e serviços Firebase simulados, incluindo falha de upload, repetição, falha no vínculo, cancelamento, dados incompatíveis e limites de entrada. Também verificam a sintaxe do módulo e a igualdade entre `index.html` e `public/index.html`. Não acessam o projeto Firebase nem substituem testes de integração em emuladores ou navegador.

`public/index.html` é a fonte da interface. Ao editar, copie seu conteúdo para `index.html` antes de publicar no GitHub Pages; o teste detecta divergências.

## Acesso administrativo e mensagens

Autenticação e autorização são etapas distintas. O login Google confirma a identidade; o acesso ao painel exige um documento `admins/{uid}`. O UID deve ser copiado do usuário correspondente em **Authentication > Users**. Criar esse documento é uma operação administrativa no console do projeto, não um cadastro público no site. Não libere escrita pública em `admins` nem remova essa verificação para contornar um erro de acesso.

O painel consulta a autorização no servidor e permite repetir a verificação após uma falha de conexão, inclusive quando a conta já está autenticada. Enquanto verifica o acesso, os dois botões de login permanecem desabilitados.

A interface usa mensagens orientadas ao usuário para credenciais inválidas, bloqueio de popup, conexão e conta sem acesso. Códigos técnicos ficam no console do navegador; instruções de configuração permanecem nesta documentação. O caráter acadêmico continua indicado pelo selo de ambiente de simulação, sem repetir avisos em todas as seções.

Não confunda acesso ao console Firebase com acesso ao aplicativo: a conta que administra o projeto precisa de permissão no projeto Google Cloud; a conta que usa o CloudBilling precisa estar em `admins`. Uma conta pode ter apenas um desses acessos.

