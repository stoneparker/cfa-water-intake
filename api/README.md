# 💧 Water Intake API

API REST em Node.js para monitoramento de ingestão de água, integrada com Arduino via sensor de fluxo.

---

## Estrutura do projeto

```
water-api/
├── arduino/
│   └── water_sensor.ino       # Sketch para Arduino + sensor YF-S201
├── src/
│   ├── controllers/
│   │   └── waterController.js # Lógica de request/response
│   ├── middleware/
│   │   └── index.js           # Logger, erros, 404
│   ├── models/
│   │   └── db.js              # Conexão e criação do banco SQLite
│   ├── routes/
│   │   └── water.js           # Definição das rotas
│   ├── services/
│   │   └── waterService.js    # Regras de negócio e queries
│   └── server.js              # Entry point
├── data/                      # Banco SQLite gerado automaticamente
├── .env.example
└── package.json
```

---

## Instalação

```bash
# 1. Instalar dependências
npm install

# 2. Configurar variáveis de ambiente
cp .env.example .env
# Edite o .env conforme necessário

# 3. Iniciar em produção
npm start

# Ou em desenvolvimento (com hot-reload)
npm run dev
```

### Variáveis de ambiente (`.env`)

| Variável        | Padrão            | Descrição                                                  |
|-----------------|-------------------|------------------------------------------------------------|
| `PORT`          | `3000`            | Porta do servidor HTTP                                     |
| `DB_PATH`       | `./data/water.db` | Caminho do banco SQLite                                    |
| `DAILY_GOAL_ML` | `2000`            | Meta inicial (usada apenas na primeira execução do banco)  |

> A meta diária é armazenada no banco após a primeira execução. Alterações posteriores devem ser feitas via `PUT /api/goal`.

---

## Endpoints

### `GET /health`
Verifica se a API está no ar.

```json
{ "status": "ok", "timestamp": "2024-01-15T10:30:00.000Z" }
```

---

### `GET /api/goal`
Retorna a meta diária atual de consumo de água.

**Resposta:**
```json
{
  "success": true,
  "data": {
    "daily_goal_ml": 2000,
    "updated_at": "2024-01-15T08:00:00Z"
  }
}
```

---

### `PUT /api/goal`
Atualiza a meta diária de consumo de água.

**Body (JSON):**
```json
{
  "daily_goal_ml": 2500
}
```

**Resposta:**
```json
{
  "success": true,
  "data": {
    "daily_goal_ml": 2500,
    "updated_at": "2024-01-15T09:00:00Z"
  }
}
```

---

### `POST /api/intake`
**Usado pelo Arduino** para registrar uma ingestão de água.

**Body (JSON):**
```json
{
  "amount_ml": 250,
  "device_id": "arduino-01",
  "notes": "opcional"
}
```

**Resposta 201:**
```json
{
  "success": true,
  "data": {
    "id": 1,
    "amount_ml": 250,
    "recorded_at": "2024-01-15T10:30:00Z",
    "device_id": "arduino-01",
    "notes": null
  }
}
```

---

### `GET /api/intake`
Lista registros com filtros opcionais.

**Query params:**
| Param       | Tipo   | Exemplo        | Descrição                    |
|-------------|--------|----------------|------------------------------|
| `date`      | string | `2024-01-15`   | Filtrar por data             |
| `device_id` | string | `arduino-01`   | Filtrar por dispositivo      |
| `limit`     | number | `50`           | Máximo de registros (100)    |
| `offset`    | number | `0`            | Paginação                    |

---

### `DELETE /api/intake/:id`
Remove um registro pelo ID.

---

### `GET /api/stats/daily`
Estatísticas do dia atual (ou de uma data específica). O campo `goal_ml` reflete a meta definida via `PUT /api/goal`.

**Query:** `?date=2024-01-15`

**Resposta:**
```json
{
  "success": true,
  "data": {
    "date": "2024-01-15",
    "total_records": 8,
    "total_ml": 1750,
    "avg_ml_per_record": 218.75,
    "max_single_ml": 350,
    "min_single_ml": 100,
    "first_intake": "2024-01-15T07:00:00Z",
    "last_intake": "2024-01-15T20:30:00Z",
    "goal_ml": 2000,
    "goal_percent": 87,
    "goal_reached": false,
    "remaining_ml": 250
  }
}
```

---

### `GET /api/stats/period`
Estatísticas por período (padrão: últimos 7 dias). A meta usada nos cálculos é sempre a meta atual.

**Query:** `?start_date=2024-01-08&end_date=2024-01-15`

**Resposta:**
```json
{
  "success": true,
  "data": {
    "period": { "start_date": "2024-01-08", "end_date": "2024-01-15" },
    "days_with_data": 6,
    "overall_total_ml": 12400,
    "overall_avg_daily_ml": 2066,
    "overall_total_records": 48,
    "daily": [
      {
        "date": "2024-01-08",
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

---

### `GET /api/stats/hourly`
Distribuição de consumo por hora do dia (todas as 24 horas).

**Query:** `?date=2024-01-15`

---

## Hardware (Arduino)

O sketch em `arduino/water_sensor.ino` é compatível com:
- **Arduino Uno / Nano / Mega** + Shield Ethernet W5100
- **Sensor de fluxo YF-S201** (fator: 7,5 pulsos/s por L/min)

Altere a constante `SERVER` no sketch para o IP da máquina onde a API está rodando.

---

## Banco de dados

O banco SQLite é criado automaticamente em `./data/water.db` na primeira execução.

```sql
CREATE TABLE water_intake (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  amount_ml   REAL    NOT NULL,
  recorded_at TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  device_id   TEXT    DEFAULT 'arduino-01',
  notes       TEXT
);

CREATE TABLE config (
  key        TEXT PRIMARY KEY,
  value      TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);
```