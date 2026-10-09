# CloudBilling Manager

Projeto acadêmico: painel para cadastro de contêineres **simulados**, atribuição de custo mensal fictício e documentação PDF. Não cria contêineres reais nem emite cobranças no Google Cloud.

## Tecnologias
HTML, CSS e JavaScript (sem build), Firebase Authentication, Cloud Firestore, Cloud Storage e Firebase Hosting.

## Configuração inicial
1. No [Firebase Console](https://console.firebase.google.com/project/cloudservicepayment/overview), ative **Authentication > Sign-in method > E-mail/senha**.
2. Crie um usuário em **Authentication > Users**.
3. Ative o Firestore. Na coleção `admins`, crie um documento cujo **ID seja o UID** do usuário criado; adicione o campo `email` (string) com o e-mail desse usuário. É esse documento que libera acesso administrativo.
4. Publique as regras de `firestore.rules` no Firestore.
5. Ative o Cloud Storage (pode exigir faturamento Blaze) e publique `storage.rules`. PDFs são privados e limitados a 10 MB.
6. Hospede usando Firebase CLI: `npm install -g firebase-tools`, `firebase login`, `firebase use cloudservicepayment` (ou `firebase use --add`), `firebase deploy --only hosting,firestore:rules,storage`.
7. Abra o site e entre com e-mail/senha do administrador.

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
