#include <HX711.h>
#include <U8g2lib.h>
#include <Wire.h>
#include <WiFi.h>
#include <HTTPClient.h>

// ─── HX711 pins ───
const int PIN_DOUT = 0;  // DT
const int PIN_SCK  = 1;  // SCK

// ─── Integrated OLED display (I2C on GPIO 5/6) ───
#define OLED_SDA 5
#define OLED_SCL 6

// Offset of the 72x40 display within the 128x64 buffer
const int xOffset = 30;
const int yOffset = 12;

// ─── Wi-Fi / API config ───

const char* WIFI_SSID = "mojo dojo casa house";
const char* WIFI_PASSWORD = "123456789a";
const char* API_URL = "http://192.168.15.193:4000/api/intake";
const char* DEVICE_ID = "esp32-01";

// ─── Calibration ───
float CALIBRATION_FACTOR = 61.92;

// ─── Detection parameters ───
const float MIN_INTAKE_ML = 0;
const int   CHECK_INTERVAL = 10000;

HX711 scale;
U8G2_SSD1306_128X64_NONAME_F_HW_I2C u8g2(U8G2_R0, U8X8_PIN_NONE, OLED_SCL, OLED_SDA);

// ─── State ───
float referenceWeight = 0.0;   // Weight from the last check
unsigned long lastCheckTime = 0;

void setup() {
  Serial.begin(115200);
  delay(1000);

  u8g2.begin();

  scale.begin(PIN_DOUT, PIN_SCK);
  scale.set_scale(CALIBRATION_FACTOR);

  Serial.println("[SETUP] Initializing scale...");
  showDisplay("Zerando...", "", "");
  delay(3000);
  scale.tare();
  Serial.println("[SETUP] Scale tared.");

  connectWifi();

  referenceWeight = scale.get_units(10);
  if (referenceWeight < 0) referenceWeight = 0;
  Serial.print("[SETUP] Initial reference: ");
  Serial.print(referenceWeight, 1);
  Serial.println(" g");

  showDisplay("Pronto!", "", "");
  delay(1000);

  lastCheckTime = millis();
}

void loop() {
  float liveWeight = scale.get_units(3);
  if (liveWeight < 0) liveWeight = 0;

  char weightLine[16];
  snprintf(weightLine, sizeof(weightLine), "%.1f g", liveWeight);
  showDisplay(weightLine, "WI!", DEVICE_ID);

  if (millis() - lastCheckTime >= CHECK_INTERVAL) {
    lastCheckTime = millis();

    float current = scale.get_units(10);
    if (current < 0) current = 0;

    float delta = referenceWeight - current;

    Serial.print("[CHECK] Current: ");
    Serial.print(current, 1);
    Serial.print(" g | Ref: ");
    Serial.print(referenceWeight, 1);
    Serial.print(" g | Diff: ");
    Serial.print(delta, 1);
    Serial.println(" g");

    if (delta > MIN_INTAKE_ML) {
      Serial.print("[INTAKE] ");
      Serial.print(delta, 1);
      Serial.println(" ml consumed");
      showDisplay("Registrado", weightLine, "enviando...");
      sendIntake(delta);
    } else {
      Serial.println("[CHECK] No significant intake.");
    }

    referenceWeight = current;
  }

  delay(300);
}

// ─── Wi-Fi connection ───
void connectWifi() {
  Serial.print("[WIFI] Connecting to ");
  Serial.print(WIFI_SSID);
  showDisplay("WiFi...", "", "");

  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  int attempts = 0;
  while (WiFi.status() != WL_CONNECTED && attempts < 30) {
    delay(500);
    Serial.print(".");
    attempts++;
  }

  if (WiFi.status() == WL_CONNECTED) {
    Serial.print("\n[WIFI] Connected. IP: ");
    Serial.println(WiFi.localIP());
    showDisplay("WiFi OK", "", "");
    delay(800);
  } else {
    Serial.println("\n[WIFI] Connection failed.");
    showDisplay("WiFi", "FALHOU", "");
    delay(1500);
  }
}

// ─── Send intake to API ───
void sendIntake(float ml) {
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("[HTTP] No Wi-Fi, reconnecting...");
    connectWifi();
  }

  HTTPClient http;
  http.begin(API_URL);
  http.addHeader("Content-Type", "application/json");
  http.addHeader("X-Device-Id", DEVICE_ID);

  char body[32];
  snprintf(body, sizeof(body), "{\"amount_ml\":%.1f}", ml);

  Serial.print("[HTTP] POST body: ");
  Serial.println(body);

  int statusCode = http.POST(body);

  if (statusCode > 0) {
    Serial.print("[HTTP] Status: ");
    Serial.println(statusCode);
    if (statusCode == 201) {
      Serial.println("[HTTP] Intake registered!");
      showDisplay("Enviado!", "", "");
    } else {
      Serial.print("[HTTP] Response: ");
      Serial.println(http.getString());
      showDisplay("Erro API", "", "");
    }
  } else {
    Serial.print("[HTTP] Error: ");
    Serial.println(http.errorToString(statusCode));
    showDisplay("Erro HTTP", "", "");
  }

  http.end();
  delay(1000);
}

void showDisplay(const char* line1, const char* line2, const char* line3) {
  u8g2.clearBuffer();
  u8g2.setFont(u8g2_font_5x8_tr);
  u8g2.drawStr(xOffset, yOffset + 20, line1);
  u8g2.drawStr(xOffset, yOffset + 32, line2);
  u8g2.drawStr(xOffset, yOffset + 44, line3);
  u8g2.sendBuffer();
}