# WI — Water Intake API

API REST + servidor WebSocket em Node.js para o sistema de monitoramento de hidratação **WI (Water Intake)**.

Recebe os registros de ingestão enviados pelo **ESP32-C3** (célula de carga de 5 kg + HX711), persiste tudo em SQLite e empurra as atualizações em tempo real para o app web.

```
ESP32-C3  ──HTTP POST /api/intake──▶  API  ──socket.io 'intake'──▶  Web App
                                       │
                                       └── SQLite (sql.js)
```

---

## Stack

| Item | Versão | Papel |
|------|--------|-------|
| Node.js | 18+ | Runtime |
| Express | ^4.18.2 | Servidor HTTP / rotas REST |
| socket.io | ^4.8.3 | Servidor WebSocket (porta separada) |
| sql.js | ^1.12.0 | SQLite compilado em WebAssembly (sem binário nativo) |
| cors | ^2.8.5 | Libera o acesso a partir do app web |
| dotenv | ^16.4.1 | Variáveis de ambiente |

> O banco roda **em memória** via WebAssembly e é gravado em disco a cada escrita (`db.export()` + `writeFileSync`). Isso evita dependência de compilação nativa (`better-sqlite3`), ao custo de reescrever o arquivo inteiro a cada `INSERT`/`UPDATE`/`DELETE` — aceitável para o volume deste projeto (poucas dezenas de registros por dia).

---

## Estrutura do projeto

```
api/
├── src/
│   ├── index.js                 # Entry point: inicializa o banco e sobe os dois servidores
│   ├── server/
│   │   ├── http.js              # App Express: middlewares, /health e /api
│   │   └── ws.js                # Servidor socket.io standalone (porta 4001)
│   ├── routes/
│   │   └── water.js             # Definição das rotas /api
│   ├── controllers/
│   │   └── waterController.js   # Validação de entrada e formato de resposta
│   ├── services/
│   │   └── waterService.js      # Regras de negócio, queries SQL e lembretes
│   ├── models/
│   │   └── db.js                # sql.js, criação do schema e migrações automáticas
│   └── middleware/
│       └── index.js             # deviceId, requestLogger, errorHandler, notFound
├── data/                        # Banco SQLite gerado automaticamente (git-ignored)
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

# 3. Subir a API (HTTP + WebSocket)
npm start
```

Saída esperada:

```
   Water Intake API rodando em http://localhost:4000
   Water Intake WebSocket Server rodando em ws://localhost:4001
```

### Scripts disponíveis

| Script | Comando | Descrição |
|--------|---------|-----------|
| `npm start` | `node src/index.js` | Sobe a API |
| `npm run fresh` | `rm -f data/water.db && node src/index.js` | Apaga o banco e sobe do zero (útil em demonstrações) |

### Variáveis de ambiente (`.env`)

| Variável | Padrão | Descrição |
|----------|--------|-----------|
| `PORT` | `4000` | Porta do servidor HTTP |
| `WS_PORT` | `4001` | Porta do servidor WebSocket |
| `DAILY_GOAL_ML` | `2000` | Meta diária inicial, gravada no banco na primeira execução |
| `DB_PATH` | `./data/water.db` | Caminho do arquivo SQLite (opcional, não está no `.env.example`) |

### Rodando na rede local

O ESP32 e o navegador do celular precisam alcançar a máquina da API.

---

## Identidade do dispositivo: `X-Device-Id`

Este é o conceito central da API. **Toda** rota sob `/api` exige o header `X-Device-Id` — o middleware `deviceId` é aplicado com `router.use()` antes de qualquer rota.

```http
X-Device-Id: esp32-01
```

Sem o header (ou com valor em branco):

```json
HTTP 400
{ "error": "Header X-Device-Id é obrigatório." }
```

Consequências práticas:

- O `device_id` **nunca** vem do corpo da requisição. O controller lê apenas `req.deviceId`, populado pelo middleware. Mandar `device_id` no body não tem efeito algum.
- Todas as queries são filtradas por `device_id`: um dispositivo nunca vê nem apaga registros de outro.
- O mesmo identificador é usado no handshake do WebSocket (`?device_id=`), o que permite à API entregar a atualização ao cliente certo.

Quem envia o quê:

| Origem | Como envia |
|--------|------------|
| ESP32 (firmware) | Header `X-Device-Id: esp32-01` no `POST /api/intake` |
| App web | Header `X-Device-Id` lido da query string da URL (`?device_id=esp32-01`) |
| App web (socket) | `io(url, { query: { device_id } })` no handshake |

---

## Endpoints

Formato de resposta padrão em caso de sucesso:

```json
{ "success": true, "data": { ... } }
```

Em caso de erro:

```json
{ "error": "mensagem legível", "detail": "opcional" }
```

### `GET /health`

Única rota **sem** `X-Device-Id`. Serve para checar se a API está no ar.

```json
{ "status": "ok", "timestamp": "2026-07-15T10:30:00.000Z" }
```

---

### `POST /api/intake`

**Usado pelo ESP32** para registrar uma ingestão. É o endpoint que fecha o ciclo do dispositivo.

**Headers:** `Content-Type: application/json`, `X-Device-Id: esp32-01`

**Body:**
```json
{ "amount_ml": 250.0 }
```

**Resposta `201`:**
```json
{
  "success": true,
  "data": {
    "id": 1,
    "amount_ml": 250,
    "recorded_at": "2026-07-15T10:30:00Z",
    "device_id": "esp32-01"
  }
}
```

**Erros:**

| Situação | Status | Corpo |
|----------|--------|-------|
| `amount_ml` ausente | 400 | `{ "error": "O campo amount_ml é obrigatório." }` |
| `amount_ml` ≤ 0 ou não numérico | 400 | `{ "error": "amount_ml deve ser um número positivo." }` |
| Header ausente | 400 | `{ "error": "Header X-Device-Id é obrigatório." }` |

Além de gravar o registro, este endpoint dispara dois efeitos colaterais: emite o evento `intake` no WebSocket do device e agenda um lembrete (ver [Tempo real](#tempo-real-websocket)).

---

### `GET /api/intake`

Lista os registros do dispositivo, do mais recente para o mais antigo.

| Query param | Tipo | Padrão | Descrição |
|-------------|------|--------|-----------|
| `date` | `YYYY-MM-DD` | — | Filtra por dia |
| `limit` | number | `100` | Máximo de registros |
| `offset` | number | `0` | Paginação |

```json
{
  "success": true,
  "count": 3,
  "data": [
    { "id": 3, "amount_ml": 250, "recorded_at": "2026-07-15T14:02:11Z", "device_id": "esp32-01" }
  ]
}
```

> Não existe filtro `device_id` na query string — ele é sempre o do header.

---

### `DELETE /api/intake/:id`

Remove um registro **do próprio dispositivo**. Retorna o registro apagado.

| Situação | Status | Corpo |
|----------|--------|-------|
| ID não numérico | 400 | `{ "error": "ID inválido." }` |
| ID de outro device ou inexistente | 404 | `{ "error": "Registro não encontrado para este device." }` |

---

### `GET /api/goal`

Retorna a meta diária vigente para o dispositivo.

```json
{
  "success": true,
  "data": {
    "device_id": "esp32-01",
    "daily_goal_ml": 2000,
    "updated_at": "2026-07-15T08:00:00Z",
    "source": "device"
  }
}
```

O campo `source` explica **de onde** a meta veio:

| `source` | Significado |
|----------|-------------|
| `device` | Existe uma meta gravada especificamente para este `device_id` |
| `default` | Nenhuma meta própria; usando a linha `device_id = 'default'` da tabela `config` |
| `fallback` | Nem meta própria nem `default` no banco; usando `DAILY_GOAL_ML` do `.env` |

A resolução acontece em uma única query, com `ORDER BY CASE device_id WHEN ? THEN 0 ELSE 1 END` — a linha do device ganha da linha `default` quando ambas existem.

---

### `PUT /api/goal`

Define a meta diária **deste** dispositivo (`INSERT ... ON CONFLICT(key, device_id) DO UPDATE`). Não altera a meta dos demais.

**Body:**
```json
{ "daily_goal_ml": 2500 }
```

**Erros:** `O campo daily_goal_ml é obrigatório.` / `daily_goal_ml deve ser um número positivo.` (ambos 400).

---

### `GET /api/stats/daily`

Estatísticas de um dia (padrão: hoje). **É este payload que é enviado pelo WebSocket** a cada nova ingestão.

**Query:** `?date=2026-07-15`

```json
{
  "success": true,
  "data": {
    "date": "2026-07-15",
    "total_records": 8,
    "total_ml": 1750,
    "avg_ml_per_record": 218.75,
    "max_single_ml": 350,
    "min_single_ml": 100,
    "first_intake": "2026-07-15T07:00:00Z",
    "last_intake": "2026-07-15T20:30:00Z",
    "goal_ml": 2000,
    "goal_percent": 87,
    "goal_reached": false,
    "remaining_ml": 250
  }
}
```

Se não houver registros no dia, todos os agregados voltam zerados e `remaining_ml` é igual à meta. `goal_percent` é limitado a 100.

---

### `GET /api/stats/period`

Agregados por período. Sem parâmetros, considera os **últimos 7 dias** (hoje menos 6).

**Query:** `?start_date=2026-07-08&end_date=2026-07-15`

```json
{
  "success": true,
  "data": {
    "period": { "start_date": "2026-07-08", "end_date": "2026-07-15" },
    "days_with_data": 6,
    "overall_total_ml": 12400,
    "overall_avg_daily_ml": 2066,
    "overall_total_records": 48,
    "daily": [
      {
        "date": "2026-07-08",
        "total_records": 7,
        "total_ml": 1900,
        "avg_ml_per_record": 271.4,
        "goal_ml": 2000,
        "goal_percent": 95,
        "goal_reached": false
      }
    ]
  }
}
```

> `overall_avg_daily_ml` divide pelo número de dias **com registro**, não pelo tamanho do período. Dias sem consumo não aparecem no array `daily`.

---

### `GET /api/stats/hourly`

Distribuição do consumo por hora, com **todas as 24 horas preenchidas** (as vazias vêm zeradas) — é o que permite ao front desenhar o gráfico de barras sem lacunas.

**Query:** `?date=2026-07-15`

```json
{
  "success": true,
  "data": {
    "date": "2026-07-15",
    "hourly": [
      { "hour": 0, "records": 0, "total_ml": 0 },
      { "hour": 8, "records": 2, "total_ml": 450 }
    ]
  }
}
```

---

## Tempo real (WebSocket)

O servidor socket.io roda **separado** do Express, na porta `WS_PORT` (4001). O cliente se identifica no handshake:

```js
io('http://localhost:4001', { query: { device_id: 'esp32-01' } });
```

A conexão é guardada em `global.users[device_id]`, e removida no `disconnect`. É esse mapa que permite emitir para o dono do dado.

### Eventos emitidos pela API

| Evento | Quando | Payload |
|--------|--------|---------|
| `intake` | Logo após um `POST /api/intake` bem-sucedido | O mesmo objeto de `GET /api/stats/daily` (já com total, percentual e meta recalculados) |
| `reminder` | 2 minutos depois de uma ingestão, **se** nenhuma outra tiver acontecido nesse intervalo | `{ "diffMinutes": 2 }` |

Fluxo do lembrete (`createReminder` em `waterService.js`): a cada ingestão é agendado um `setTimeout` de 2 minutos (para fins de teste); ao disparar, a função compara o horário atual com a última ingestão registrada e só emite `reminder` se a diferença for `>= 2` minutos. Se a pessoa bebeu água nesse meio-tempo, o lembrete é descartado.

---

## Banco de dados

Criado automaticamente em `./data/water.db` na primeira execução.

```sql
CREATE TABLE IF NOT EXISTS water_intake (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  amount_ml   REAL NOT NULL CHECK (amount_ml > 0),
  recorded_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')),
  device_id   TEXT NOT NULL DEFAULT 'arduino-01'
);

CREATE INDEX IF NOT EXISTS idx_recorded_at ON water_intake (recorded_at);
CREATE INDEX IF NOT EXISTS idx_device_id   ON water_intake (device_id);

CREATE TABLE IF NOT EXISTS config (
  key        TEXT NOT NULL,
  device_id  TEXT NOT NULL DEFAULT 'default',
  value      TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')),
  PRIMARY KEY (key, device_id)
);
```
