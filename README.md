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

## Aplicativo de software
As medições de peso realizadas na garrafa são enviadas para um aplicativo, com o objetivo de apresentar ao usuário estatísticas de ingestão de água, diárias e por período selecionado, e permitir a configuração do tamanho da garrafa utilizada e da meta diária de ingestão.

### API
Backend em Node.js responsável por armazenar e processar os dados de consumo.

**Stack:**
* Node.js
* Express
* SQLite

**Endpoints disponíveis:**

| Método | Rota | Descrição |
|--------|------|-----------|
| `POST` | `/api/intake` | Registra consumo (usado pelo ESP32) |
| `GET` | `/api/intake` | Lista registros com filtros |
| `DELETE` | `/api/intake/:id` | Remove um registro |
| `GET` | `/api/goal` | Retorna a meta diária |
| `PUT` | `/api/goal` | Atualiza a meta diária |
| `GET` | `/api/stats/daily` | Estatísticas do dia |
| `GET` | `/api/stats/period` | Histórico por período |

### Aplicação Web
Frontend em React para acompanhamento do consumo e configuração pelo usuário.

**Stack:** React 18 + CSS puro (sem dependências de UI)

> Inicialmente foi montado um projeto básico utilizando React Native Expo, porém, por limitações inicialização (VPNs), foi realizada a substituição para ReactJS na Web.

## Próximos passos
- [ ] Criar endpoints na API para definição e retorno do tamanho da garrafa
- [x] Desenvolvimento da interface do front-end
- [ ] Consertar erros de integração entre o ESP32 e HX711
- [x] Desenvolver algoritmos de medição da variação de peso da garrafa e envio de lembretes para API
- [x] Soldar componentes
- [ ] Acoplar dispositivo à base de silicone da garrafa
- [ ] Adicionar maior detalhamento da integração dispositivo-API-frontend na documentação
- [ ] Definir formato de "alimentação móvel" (baterias ou powerbanks)
- [x] Criar servidor de socket.io na API para envio de lembretes ao front-end
- [x] Imprimir id do dispositivo no display para associação no front-end

> Possivelmente existem passos intermediários que serão melhor elaborados conforme o avanço do desenvolvimento
