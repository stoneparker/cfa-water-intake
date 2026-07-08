#include <HX711.h>

const int PIN_DOUT = 4;
const int PIN_SCK  = 5;

float CALIBRATION_FACTOR = 30;

HX711 scale;

void setup() {
  Serial.begin(115200);
  delay(1000);

  scale.begin(PIN_DOUT, PIN_SCK);
  scale.set_scale(CALIBRATION_FACTOR);

  Serial.println("Zerando... nao encoste na celula (3s)");
  delay(3000);
  scale.tare();
  Serial.println("Pronto! Peso em gramas:");
}

void loop() {
  float gramas = scale.get_units(10);
  Serial.print(gramas, 1);
  Serial.println(" g");
  delay(500);
}

/*#include <HX711.h>

const int PIN_DOUT = 4;
const int PIN_SCK  = 5;

HX711 scale;

void setup() {
  Serial.begin(115200);
  delay(1000);

  scale.begin(PIN_DOUT, PIN_SCK);

  Serial.println("=== CALIBRACAO HX711 ===");
  Serial.println("1. Deixe a celula VAZIA e nao encoste nela");
  Serial.println("   Zerando em 5 segundos...");
  delay(5000);

  scale.tare();
  Serial.println("   Zerado!");
  Serial.println();
  Serial.println("2. Coloque um peso CONHECIDO sobre a celula");
  Serial.println("   (ex: garrafa com 500ml = 500g)");
  Serial.println("   Aguardando 10 segundos...");
  delay(10000);

  long leitura = scale.get_units(20); // media de 20 leituras
  Serial.print("   Leitura com peso: ");
  Serial.println(leitura);
  Serial.println();
  Serial.println("=== CALCULO ===");
  Serial.println("CALIBRATION_FACTOR = leitura / peso_real_em_gramas");
  Serial.print("Exemplo: se voce usou 500g -> fator = ");
  Serial.println(leitura / 500.0, 2);
  Serial.println();
  Serial.println("Anote esse valor!");
}

void loop() {
  // vazio
}*/
