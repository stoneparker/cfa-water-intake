# 💧 WI — Web App

Interface web para o sistema de monitoramento de hidratação.

## Instalação

```bash
npm install
```

## Configuração

```bash
cp .env.example .env
```

Edite o `.env` com o IP da máquina onde a API está rodando:

```
REACT_APP_API_URL=http://SEU_IP_LOCAL:3000/api
```

## Execução

```bash
npm start
```

Acesse `http://localhost:3000` no navegador.

## Telas

| Aba | Descrição |
|-----|-----------|
| **Início** | Anel de progresso, botões de registro rápido, quantidade personalizada |
| **Estatísticas** | Gráfico por hora, resumo de período (7/14/30 dias), breakdown diário |
| **Histórico** | Lista de registros agrupados por dia, com opção de deletar |
| **Configurações** | Definir meta diária, ver URL da API |
