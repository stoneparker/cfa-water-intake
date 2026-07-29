# WI — Web App

Interface web do sistema de monitoramento de hidratação **WI (Water Intake)**.

Mostra em tempo real quanto de água foi consumido no dia — os registros chegam sozinhos, enviados pelo **ESP32-C3** que pesa a garrafa, mas também é possível registrar manualmente pelo próprio app.

```
ESP32-C3  ──▶  API (4000)  ──socket.io (4001)──▶  Web App (3000)
                    ▲                                   │
                    └──────── fetch / REST ─────────────┘
```

---

## Stack

| Item | Versão | Papel |
|------|--------|-------|
| React | ^18.2.0 | Interface |
| react-scripts (CRA) | 5.0.1 | Build e dev server |
| socket.io-client | ^4.8.1 | Recebe atualizações em tempo real |
| CSS puro | — | `src/index.css`, com variáveis CSS (`--text`, `--sub`, `--radius`…) |

---

## Estrutura do projeto

```
web/
├── public/
│   └── index.html
├── src/
│   ├── index.js                # Bootstrap do React
│   ├── index.css               # Estilos globais
│   ├── App.js                  # Navegação por abas + conexão do socket + lembrete
│   ├── components/
│   │   └── Ring.js             # Anel de progresso em SVG
│   ├── pages/
│   │   ├── Home.js             # Anel, registro rápido e resumo do dia
│   │   ├── Stats.js            # Gráfico por hora e estatísticas de período
│   │   └── Settings.js         # Meta diária
│   └── services/
│       ├── api.js              # Cliente REST (fetch) com X-Device-Id
│       └── socket.js           # Cliente socket.io e registro de listeners
├── .env.example
└── package.json
```

---

## Instalação e execução

```bash
# 1. Dependências
npm install

# 2. Variáveis de ambiente
cp .env.example .env

# 3. Subir o app
npm start
```

Abra no navegador — **com o `device_id` na URL**:

```
http://localhost:3000/?device_id=esp32-01
```

### Scripts disponíveis

| Script | Descrição |
|--------|-----------|
| `npm start` | Dev server do CRA em `http://localhost:3000` |
| `npm run build` | Build de produção em `build/` |

### Variáveis de ambiente (`.env`)

| Variável | Padrão no `.env.example` | Descrição |
|----------|--------------------------|-----------|
| `REACT_APP_API_URL` | `http://localhost:4000/api` | Base das chamadas REST (inclui o `/api`) |
| `REACT_APP_SOCKET_URL` | `http://localhost:4001` | Servidor WebSocket (porta **diferente** da API HTTP) |

### Acessando pelo celular na mesma rede

Troque `localhost` pelo IP da máquina que roda a API:

```
REACT_APP_API_URL=http://192.168.0.10:4000/api
REACT_APP_SOCKET_URL=http://192.168.0.10:4001
```

E acesse `http://192.168.0.10:3000/?device_id=esp32-01` no celular.

---

## O parâmetro `?device_id=` é obrigatório

O app **não** tem tela de login nem campo para escolher o dispositivo: a identidade vem da própria URL.

```
http://localhost:3000/?device_id=esp32-01
                       ▲
                       └── mesmo valor que o firmware envia no header X-Device-Id
```

Esse valor é usado em dois lugares:

1. **Em toda chamada REST** — `src/services/api.js` lê `window.location.search` a cada requisição e envia o resultado no header `X-Device-Id`.
2. **No handshake do WebSocket** — `App.js` lê o parâmetro no `useEffect` de montagem e chama `connectDevice(deviceId)`, que abre `io(SOCKET_URL, { query: { device_id } })`.

Sem o parâmetro, a API responde `400 { "error": "Header X-Device-Id é obrigatório." }` e a tela mostra a mensagem de erro; o socket simplesmente não conecta (`connectDevice` ignora valores vazios).

> O `device_id` precisa ser **o mesmo** configurado na constante `DEVICE_ID` do firmware (`esp32-01`). É ele que faz o dado da balança chegar nesta tela e não em outra.

---

## Telas

| Aba | Conteúdo |
|-----|----------|
| **Início** | Anel de progresso, resumo da meta e registro manual |
| **Estatísticas** | Gráfico por hora do dia e agregados de 7/14/30 dias |
| **Configurações** | Definição da meta diária |

### Início (`Home.js`)

- **Anel de progresso** (`Ring.js`): donut SVG; fica **azul** (`#2563eb`) enquanto a meta não é atingida e **verde** (`#16a34a`) a partir de 100 %. No centro aparecem os ml bebidos e o percentual.
- **Três caixas de resumo:** meta do dia, quanto falta (ou "Atingida!") e número de registros.
- **Registro manual:** botões rápidos de `150`, `200`, `250`, `350` e `500` ml, mais um campo para quantidade personalizada. Serve para lançar a água bebida fora da garrafa monitorada — ou para demonstrar o app sem o dispositivo.
- **Atualização em tempo real:** a tela se inscreve em `onIntake` e substitui o estado pelo payload recebido. Quando o ESP32 registra um gole, o anel se atualiza **sem recarregar a página** — o mesmo payload de `GET /api/stats/daily` chega pelo socket já com total, percentual e meta recalculados.

### Estatísticas (`Stats.js`)

- **Gráfico por hora:** 24 barras, uma por hora do dia, com a altura normalizada pela maior hora. Como a API devolve todas as 24 horas (as vazias zeradas), não há lacunas no eixo. Passar o mouse mostra `hora: ml`.
- **Primeiro e último registro** do dia, formatados em `pt-BR`.
- **Seletor de período:** 7, 14 ou 30 dias. A data inicial é calculada no cliente (`dateNDaysAgo`) e enviada como `start_date`; a final fica a cargo da API (hoje).
- **Três indicadores:** total em litros, média diária e metas atingidas no formato `x/y` — onde `y` é o número de dias **com registro**, não o tamanho do período.
- **Lista por dia**, do mais recente para o mais antigo, com barra de progresso e percentual, em verde quando a meta foi batida.
- Também escuta `onIntake`: uma ingestão nova atualiza o dia e recarrega os agregados.

### Configurações (`Settings.js`)

- Mostra a meta atual e quando ela foi definida.
- Atalhos de `1500`, `2000`, `2500` e `3000` ml, mais campo livre.
- Salvar dispara `PUT /api/goal`, que grava a meta **para este `device_id`** (não afeta outros dispositivos), e exibe a confirmação.

---

## Serviços

### `services/api.js`

Wrapper fino sobre `fetch`. Em toda requisição:

- lê o `device_id` da query string e envia como header `X-Device-Id`;
- em `POST`/`PUT`/`PATCH`, também injeta `device_id` no corpo (redundante — a API ignora o body e usa apenas o header);
- desembrulha a resposta com `json.data ?? json`, de modo que as páginas recebem direto o objeto útil, sem o envelope `{ success, data }`;
- em erro, lança `Error(json.error)` — é essa mensagem que aparece na faixa vermelha das telas.

Funções exportadas: `getGoal`, `updateGoal`, `registerIntake`, `getIntakes`, `deleteIntake`, `getDailyStats`, `getPeriodStats`, `getHourlyStats`.

### `services/socket.js`

- `connectDevice(id)` abre a conexão com `query: { device_id: id }` e reconexão infinita (`reconnectionDelay: 1000`). Chamar de novo com o mesmo id reaproveita o socket; com id diferente, desconecta antes.
- `onIntake(cb)` e `onReminder(cb)` registram listeners e **retornam a função de cancelamento**, usada no cleanup dos `useEffect`.
- `disconnect()` e `getSocket()` completam a API do módulo.

Eventos recebidos:

| Evento | Efeito na interface |
|--------|---------------------|
| `intake` | Início e Estatísticas atualizam os números na hora |
| `reminder` | `alert()` do navegador: "Atenção! Já faz N minutos desde sua última ingestão de água. Hora de se hidratar!" |
