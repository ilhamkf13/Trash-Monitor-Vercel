#include <Arduino.h>
#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <HTTPClient.h>
#include <TinyGPSPlus.h>

// ---------- WIFI & API ----------
const char* WIFI_SSID = "NAMA_WIFI";
const char* WIFI_PASSWORD = "PASSWORD_WIFI";

// Ganti dengan URL deployment Vercel milikmu.
const char* API_URL = "https://NAMA-PROJECT.vercel.app/api/telemetry";

// Harus sama dengan DEVICE_TOKEN di Environment Variables Vercel.
const char* DEVICE_TOKEN = "GANTI_DENGAN_TOKEN_RAHASIA";

// ---------- PIN ----------
#define TRIG_PIN 5
#define ECHO_PIN 6
#define GPS_RX_PIN 20
#define GPS_TX_PIN 21

// ---------- CONFIG ----------
const float TINGGI_TEMPAT_SAMPAH = 57.0;
const unsigned long INTERVAL_KIRIM = 5000;
const unsigned long INTERVAL_WIFI_RETRY = 10000;

TinyGPSPlus gps;
HardwareSerial GPS_Serial(1);

unsigned long lastSend = 0;
unsigned long lastWifiRetry = 0;

float jarak = -1;
float tinggiSampah = 0;
float kapasitas = 0;
String statusSampah = "SENSOR ERROR";
bool sensorValid = false;

float bacaJarak() {
  digitalWrite(TRIG_PIN, LOW);
  delayMicroseconds(3);
  digitalWrite(TRIG_PIN, HIGH);
  delayMicroseconds(10);
  digitalWrite(TRIG_PIN, LOW);

  unsigned long durasi = pulseIn(ECHO_PIN, HIGH, 30000);
  if (durasi == 0) return -1;

  return durasi * 0.0343 / 2.0;
}

void bacaGPS() {
  while (GPS_Serial.available()) {
    gps.encode(GPS_Serial.read());
  }
}

void hitungKapasitas() {
  jarak = bacaJarak();

  // Pembacaan di luar rentang tempat sampah dianggap tidak valid.
  if (jarak < 2.0 || jarak > TINGGI_TEMPAT_SAMPAH) {
    sensorValid = false;
    statusSampah = "SENSOR ERROR";
    return;
  }

  sensorValid = true;
  tinggiSampah = TINGGI_TEMPAT_SAMPAH - jarak;
  kapasitas = (tinggiSampah / TINGGI_TEMPAT_SAMPAH) * 100.0;
  kapasitas = constrain(kapasitas, 0.0, 100.0);

  if (kapasitas >= 80.0) statusSampah = "PENUH";
  else if (kapasitas >= 50.0) statusSampah = "HAMPIR PENUH";
  else statusSampah = "BELUM PENUH";
}

void kirimData() {
  if (!sensorValid) {
    Serial.println("Data tidak dikirim: pembacaan HC-SR04 tidak valid.");
    return;
  }

  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("WiFi belum terhubung. Data belum dikirim.");
    return;
  }

  bool gpsValid = gps.location.isValid();
  String lat = gpsValid ? String(gps.location.lat(), 6) : "null";
  String lng = gpsValid ? String(gps.location.lng(), 6) : "null";
  String sat = gps.satellites.isValid()
      ? String(gps.satellites.value())
      : "null";

  String payload = "{";
  payload += "\"distance_cm\":" + String(jarak, 2) + ",";
  payload += "\"fill_height_cm\":" + String(tinggiSampah, 2) + ",";
  payload += "\"capacity_percent\":" + String(kapasitas, 2) + ",";
  payload += "\"status\":\"" + statusSampah + "\",";
  payload += "\"latitude\":" + lat + ",";
  payload += "\"longitude\":" + lng + ",";
  payload += "\"satellites\":" + sat + ",";
  payload += "\"gps_valid\":" + String(gpsValid ? "true" : "false");
  payload += "}";

  WiFiClientSecure client;

  // Untuk prototipe awal. Ini menonaktifkan verifikasi sertifikat TLS.
  // Untuk penggunaan produksi, pasang root CA sertifikat server.
  client.setInsecure();

  HTTPClient https;
  https.setTimeout(8000);

  if (!https.begin(client, API_URL)) {
    Serial.println("Gagal memulai koneksi HTTPS.");
    return;
  }

  https.addHeader("Content-Type", "application/json");
  https.addHeader("x-device-token", DEVICE_TOKEN);

  int httpCode = https.POST(payload);

  Serial.print("HTTP response: ");
  Serial.println(httpCode);

  if (httpCode > 0) {
    Serial.println(https.getString());
  } else {
    Serial.println(https.errorToString(httpCode));
  }

  https.end();
}

void tampilkanSerial() {
  Serial.println("\n===== TRASH MONITOR =====");

  if (sensorValid) {
    Serial.print("Jarak       : "); Serial.print(jarak, 2); Serial.println(" cm");
    Serial.print("Tinggi isi  : "); Serial.print(tinggiSampah, 2); Serial.println(" cm");
    Serial.print("Kapasitas   : "); Serial.print(kapasitas, 1); Serial.println(" %");
    Serial.print("Status      : "); Serial.println(statusSampah);
  } else {
    Serial.println("Sensor      : Tidak valid");
  }

  Serial.print("WiFi        : ");
  Serial.println(WiFi.status() == WL_CONNECTED ? WiFi.localIP().toString() : "Terputus");

  Serial.print("GPS         : ");
  Serial.println(gps.location.isValid() ? "FIXED" : "SEARCHING");

  Serial.print("Satelit     : ");
  if (gps.satellites.isValid()) Serial.println(gps.satellites.value());
  else Serial.println("Belum tersedia");

  if (gps.location.isValid()) {
    Serial.print("Latitude    : "); Serial.println(gps.location.lat(), 6);
    Serial.print("Longitude   : "); Serial.println(gps.location.lng(), 6);
  }

  Serial.println("=========================");
}

void setup() {
  Serial.begin(115200);
  delay(1000);

  pinMode(TRIG_PIN, OUTPUT);
  pinMode(ECHO_PIN, INPUT);
  digitalWrite(TRIG_PIN, LOW);

  GPS_Serial.begin(9600, SERIAL_8N1, GPS_RX_PIN, GPS_TX_PIN);

  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

  Serial.println("Menghubungkan ke WiFi...");
  unsigned long start = millis();
  while (WiFi.status() != WL_CONNECTED && millis() - start < 15000) {
    delay(500);
    Serial.print(".");
  }

  Serial.println();
  if (WiFi.status() == WL_CONNECTED) {
    Serial.print("WiFi terhubung. IP: ");
    Serial.println(WiFi.localIP());
  } else {
    Serial.println("WiFi belum terhubung. Akan mencoba lagi di loop.");
  }

  Serial.println("Trash Monitor siap.");
}

void loop() {
  bacaGPS();

  if (WiFi.status() != WL_CONNECTED &&
      millis() - lastWifiRetry >= INTERVAL_WIFI_RETRY) {
    lastWifiRetry = millis();
    Serial.println("Mencoba menghubungkan ulang WiFi...");
    WiFi.reconnect();
  }

  if (millis() - lastSend >= INTERVAL_KIRIM) {
    lastSend = millis();

    hitungKapasitas();
    tampilkanSerial();
    kirimData();
  }
}
