# Water Intake - WI

## Introdução

O WI (nome provisório) é um sistema completo de monitoramento de hidratação que combina hardware, backend e frontend para registrar automaticamente a quantidade de água consumida ao longo do dia.

Uma célula de carga posicionada sob a garrafa de água detecta a variação de peso e o ESP32 processa os dados e envia as informações via Wi-Fi para uma API e o usuário acompanha o progresso em tempo real por um aplicativo.

### Motivação

A ideia partiu de uma motivação pessoal de desenvolvimento de algum dispositivo de wellness ou de segurança pessoal para uso próprio. Antes da ideia final, algumas possibilidades foram levantadas:

1. Sensor que envia notificação quando a porta for aberta, gerando alertas urgentes em horários críticos -> descartada por pesquisa de mercado, onde foram encontrados diversos dispositivos semelhantes e com integrações mais completas (como Alexa e Google Home). Foi recomendado pelo professor a realização uma pesquisa sobre a área da domótica, que, em uma validação do mercado, foi possível identificar que não haveria muito espaço para "ideias inovadoras" de baixo custo.
2. Medidor e regulador de stress -> descartada por conta da complexidade de desenvolvimento e calibração do dispositivo wearable dentro do tempo da disciplina. Também foi conferido que alguns smartwatches já possuem funcionalidades parecidas integradas.
3. Botão de emergência para carro que envia localização para contatos de emergências -> descartada em uma conversa com um Uber que já possuia um dispositivo com propósito parecido e bem mais completo em termos de funcionalidade.

### Concepção da ideia

Após o insucesso das ideias anteriores, surgiu a ideia de um dispositivo que acompanha a ingestão de água, também por conta de uma motivação pessoal e insatisfação com os aplicativos existentes para esse fim, onde é necessário cadastrar manualmente a quantidade de água ingerida, gerando dificuldades de aderência ao uso.

O dispositivo desenvolvido ficaria acomplado à base da garrafa para acompanhamento da ingestão através da variação de peso para baixo, com a geração de lembretes para ingestão e envio de estatísticas a um aplicativo.

Em pesquisa de mercado foram encontradas garrafas inteiras com esse mecanismo à preço bastante elevado, e o [Ulla](https://www.ulla.io), um gadget simples que detecta o movimento da garrafa para criar alertas e não se conecta com nenhum sistema. A proposta do dispositivo a ser desenvolvido, então, se diferencia ao possibilitar o acoplamento a qualquer garrafa através de uma base removível, além da integração com o aplicativo.

<img width="1012" height="927" alt="photo_2026-07-08_08-43-26" src="https://github.com/user-attachments/assets/83020b5a-d50e-44c6-866c-25c9050d9312" />


## Componentes utilizados

<img width="1280" height="721" alt="photo_2026-07-08_08-43-05" src="https://github.com/user-attachments/assets/caa22635-5c42-435e-922f-93c0be681b8c" />

### Dispositivo

* Placa microcontroladora ESP32-C3 Super Mini OLED Display de 0.42''
* 4 Jumpers Macho-Macho
* Célula de carga com capacidade para até 50kg
* Placa HX-711

**Conexões:**

| HX711 | ESP32-C3 |
|-------|----------|
| VCC   | 3V       |
| GND   | GD       |
| DT    | GPIO 0   |
| SCK   | GPIO 1   |

| Célula de carga | HX711 |
|-----------------|-------|
| Vermelho        | E+    |
| Preto           | E−    |
| Branco          | A+    |

<img width="2560" height="1441" alt="photo_2026-07-08_08-42-58" src="https://github.com/user-attachments/assets/227b0e9d-c2b0-43bd-90a1-b880e04233d8" />

### Materiais complementares

* Protoboard (para testes iniciais)
* Kit de Ferro de Solda 60W com Estanho
* Base de silicone de garrafa para acoplamento final


## Arquitetura e fluxo de dados

O sistema é dividido em três módulos que se comunicam por HTTP e WebSocket, sempre identificados por um `device_id` (ex.: `esp32-01`) que amarra o dispositivo físico ao painel web do usuário.

```
┌────────────────────┐   HTTP POST /api/intake    ┌──────────────────────┐
│  ESP32-C3 + HX711  │  (X-Device-Id, amount_ml)  │        API           │
│  + célula de carga │ ─────────────────────────▶ │  Express + SQLite    │
│  (esp32/wi.ino)    │                            │  (sql.js)            │
└────────────────────┘                            └──────────┬───────────┘
                                                             │
                                            Socket.io        │  eventos
                                          (intake/reminder)  │  em tempo real
                                                             ▼
                                                  ┌──────────────────────┐
                                                  │     Aplicação Web     │
                                                  │  React (web/)         │
                                                  │  ?device_id=esp32-01  │
                                                  └──────────────────────┘
```

Fluxo completo de uma ingestão:

1. A cada 10 segundos o ESP32 lê o peso da garrafa via HX711 e calcula o **delta** (queda de peso) desde a última leitura.
2. Se houve redução de peso, o valor em `ml` é enviado por `POST /api/intake`, com o cabeçalho `X-Device-Id` identificando o dispositivo.
3. A API grava o registro no SQLite, recalcula as estatísticas do dia e **emite o evento `intake`** (via Socket.io) para o cliente web associado àquele `device_id`.
4. Em seguida a API agenda uma verificação de lembrete: se passar muito tempo sem nova ingestão, emite o evento `reminder`.
5. A aplicação web, conectada ao socket com o mesmo `device_id`, atualiza o anel de progresso e os gráficos em tempo real — sem precisar recarregar a página.

O `device_id` é a peça central da associação: o ESP32 o imprime no display OLED, e o usuário abre a web passando esse mesmo id na URL (`?device_id=esp32-01`).


## Dispositivo — ESP32 (`esp32/wi.ino`)

Firmware em C++ (Arduino framework) para a placa **ESP32-C3 Super Mini** com display OLED integrado de 0.42''.

**Bibliotecas utilizadas:**

* `HX711` — leitura da célula de carga através do amplificador HX711
* `U8g2lib` + `Wire` — controle do display OLED SSD1306 via I2C
* `WiFi` + `HTTPClient` — conexão à rede e envio das requisições HTTP

**Pinagem no código:**

| Função            | Pino ESP32-C3 |
|-------------------|---------------|
| HX711 `DT` (DOUT) | GPIO 0        |
| HX711 `SCK`       | GPIO 1        |
| OLED `SDA`        | GPIO 5        |
| OLED `SCL`        | GPIO 6        |

> O display de 72x40 fica posicionado dentro de um buffer de 128x64 (offsets `xOffset = 30`, `yOffset = 12`).

**Parâmetros de configuração (constantes no topo do sketch):**

| Constante             | Valor atual                         | Descrição                                          |
|-----------------------|-------------------------------------|----------------------------------------------------|
| `WIFI_SSID` / `WIFI_PASSWORD` | credenciais da rede         | Rede Wi-Fi à qual o ESP32 se conecta               |
| `API_URL`             | `http://192.168.15.193:4000/api/intake` | Endpoint da API na rede local                  |
| `DEVICE_ID`           | `esp32-01`                          | Identificador do dispositivo (usado no `X-Device-Id`) |
| `CALIBRATION_FACTOR`  | `61.92`                             | Fator de calibração da célula de carga             |
| `CHECK_INTERVAL`      | `10000` (ms)                        | Intervalo entre verificações de peso               |
| `MIN_INTAKE_ML`       | `0`                                 | Variação mínima para considerar uma ingestão       |

**Lógica de funcionamento:**

* No `setup()`, o firmware inicializa o display, faz o **tare** (zera a balança) após 3 s, conecta ao Wi-Fi e captura o peso de referência inicial (`referenceWeight`).
* No `loop()`, o peso ao vivo é exibido continuamente no OLED junto do `DEVICE_ID`. A cada `CHECK_INTERVAL`, calcula `delta = referenceWeight - current`; se o delta indicar consumo, chama `sendIntake()` e atualiza a referência.
* `sendIntake()` monta o corpo JSON `{"amount_ml": <valor>}`, adiciona os cabeçalhos `Content-Type: application/json` e `X-Device-Id`, e faz o `POST`. Em caso de perda de Wi-Fi, tenta reconectar antes de enviar. O status da operação (enviado / erro) é refletido no display.

> ⚠️ As credenciais de Wi-Fi e a URL da API estão fixas no código (hardcoded). Para reproduzir em outro ambiente, ajuste `WIFI_SSID`, `WIFI_PASSWORD` e `API_URL` (usando o IP da máquina que roda a API na rede local), e refaça a calibração da célula (`CALIBRATION_FACTOR`).


## API (`api/`)

Backend em Node.js responsável por armazenar os registros de consumo, calcular estatísticas e distribuir eventos em tempo real para a web.

**Stack:**

* Node.js + Express (servidor HTTP/REST)
* [`sql.js`](https://sql.js.org) — SQLite compilado para WebAssembly, persistido em arquivo (`data/water.db`), sem dependências nativas
* Socket.io (canal de tempo real)
* dotenv, cors

**Estrutura de pastas:**

```
api/
├── src/
│   ├── index.js                    # Entry point: initDb + sobe HTTP e WebSocket
│   ├── server/
│   │   ├── http.js                 # App Express (CORS, JSON, /health, /api)
│   │   └── ws.js                   # Servidor Socket.io (mapa device_id → socket)
│   ├── routes/water.js             # Definição das rotas /api
│   ├── controllers/waterController.js  # Validação de request/response
│   ├── services/waterService.js    # Regras de negócio, queries e lembretes
│   ├── models/db.js                # Inicialização, schema e migrações do SQLite
│   └── middleware/index.js         # X-Device-Id, logger, erros, 404
├── data/water.db                   # Banco gerado automaticamente
├── .env.example
└── package.json
```

### Identificação por dispositivo

Todas as rotas sob `/api` passam pelo middleware `deviceId`, que **exige o cabeçalho `X-Device-Id`**. O valor vira `req.deviceId` e escopa todas as operações — cada dispositivo tem seus próprios registros, sua própria meta e suas próprias estatísticas. Requisições sem esse cabeçalho recebem `400`.

### Endpoints

| Método   | Rota                  | Descrição                                                  |
|----------|-----------------------|------------------------------------------------------------|
| `GET`    | `/health`             | Healthcheck da API                                         |
| `GET`    | `/api/goal`           | Retorna a meta diária do dispositivo                       |
| `PUT`    | `/api/goal`           | Atualiza a meta diária (`{ "daily_goal_ml": 2500 }`)       |
| `POST`   | `/api/intake`         | Registra uma ingestão (**usado pelo ESP32**)              |
| `GET`    | `/api/intake`         | Lista registros (filtros: `date`, `limit`, `offset`)       |
| `DELETE` | `/api/intake/:id`     | Remove um registro do dispositivo                          |
| `GET`    | `/api/stats/daily`    | Resumo do dia (total, meta, % atingido, restante)          |
| `GET`    | `/api/stats/period`   | Histórico por período (padrão: últimos 7 dias)             |
| `GET`    | `/api/stats/hourly`   | Distribuição de consumo pelas 24 horas do dia              |

Exemplo de envio do ESP32:

```http
POST /api/intake
X-Device-Id: esp32-01
Content-Type: application/json

{ "amount_ml": 250 }
```

Exemplo de resposta de `/api/stats/daily`:

```json
{
  "success": true,
  "data": {
    "date": "2026-07-15",
    "total_records": 8,
    "total_ml": 1750,
    "goal_ml": 2000,
    "goal_percent": 87,
    "goal_reached": false,
    "remaining_ml": 250,
    "first_intake": "2026-07-15T07:00:00Z",
    "last_intake": "2026-07-15T20:30:00Z"
  }
}
```
### Tempo real e lembretes (`services/waterService.js` + `server/ws.js`)

* Ao registrar uma ingestão, o serviço emite o evento **`intake`** com as estatísticas atualizadas do dia para o socket daquele dispositivo (`global.users[device_id]`).
* Em seguida agenda um **lembrete**: se ao final do intervalo tiver passado ≥ 30 min desde a última ingestão, emite o evento **`reminder`** com quantos minutos se passaram.
* O servidor Socket.io registra cada cliente pelo `device_id` recebido em `handshake.query.device_id`, mantendo o mapa `device_id → socket`.


## Aplicação Web (`web/`)

Frontend em **React 18** para acompanhamento do consumo e configuração pelo usuário, servido pelo `react-scripts` (Create React App).

**Stack:** React 18 + CSS puro (sem bibliotecas de UI) + `socket.io-client`

> Inicialmente foi montado um projeto básico utilizando React Native Expo, porém, por limitações de inicialização (VPNs), foi realizada a substituição para ReactJS na Web.

**Estrutura de pastas:**

```
web/
├── public/index.html
└── src/
    ├── App.js                  # Navegação por abas (Início / Estatísticas)
    ├── index.js / index.css    # Bootstrap e estilos
    ├── pages/
    │   ├── Home.js             # Anel de progresso + registro manual
    │   └── Stats.js            # Gráfico por hora + histórico por período
    ├── components/Ring.js      # Anel de progresso em SVG
    └── services/
        ├── api.js              # Cliente REST (injeta X-Device-Id)
        └── socket.js           # Cliente Socket.io (eventos intake/reminder)
```

### Associação com o dispositivo

A web recebe o dispositivo pela query string da URL: `http://localhost:3000/?device_id=esp32-01`. Esse `device_id` (o mesmo exibido no display do ESP32) é:

* injetado no cabeçalho `X-Device-Id` de toda requisição REST (`services/api.js`);
* usado como `query.device_id` ao abrir a conexão Socket.io (`services/socket.js`), para receber os eventos daquele dispositivo.

### Telas

* **Início (`Home.js`):** anel de progresso (componente `Ring`, SVG que vai de azul a verde ao atingir 100%) mostrando ml bebidos, meta, quanto falta e número de registros do dia. Inclui botões de registro rápido (150/200/250/350/500 ml) e um campo para quantidade personalizada. Um banner de lembrete aparece quando o evento `reminder` chega.
* **Estatísticas (`Stats.js`):** gráfico de barras de consumo por hora do dia, seletor de período (7/14/30 dias), totais agregados (total no período, média diária, metas atingidas) e detalhamento dia a dia com barras de progresso.

Ambas as telas escutam os eventos `intake` (atualiza os números em tempo real quando o ESP32 registra água) e `reminder` (exibe o aviso de hidratação).

## Próximos passos

- [ ] Criar endpoints na API para definição e retorno do tamanho da garrafa
- [x] Desenvolvimento da interface do front-end
- [ ] Consertar erros de integração entre o ESP32 e HX711
- [x] Desenvolver algoritmos de medição da variação de peso da garrafa e envio de lembretes para API
- [x] Soldar componentes
- [ ] Acoplar dispositivo à base de silicone da garrafa
- [x] Adicionar maior detalhamento da integração dispositivo-API-frontend na documentação
- [ ] Definir formato de "alimentação móvel" (baterias ou powerbanks)
- [x] Criar servidor de socket.io na API para envio de lembretes ao front-end
- [x] Imprimir id do dispositivo no display para associação no front-end

> Possivelmente existem passos intermediários que serão melhor elaborados conforme o avanço do desenvolvimento
