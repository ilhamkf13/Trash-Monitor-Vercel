"use client";

import { useEffect, useMemo, useState } from "react";

type Reading = {
  id: number;
  created_at: string;
  distance_cm: number;
  fill_height_cm: number;
  capacity_percent: number;
  status: string;
  latitude: number | null;
  longitude: number | null;
  satellites: number | null;
  gps_valid: boolean;
};

function formatDate(value?: string) {
  if (!value) return "Belum ada data";
  return new Date(value).toLocaleString("id-ID", {
    dateStyle: "medium",
    timeStyle: "medium"
  });
}

function statusClass(status?: string) {
  if (status === "PENUH") return "danger";
  if (status === "HAMPIR PENUH") return "warning";
  return "good";
}

export default function Home() {
  const [readings, setReadings] = useState<Reading[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [lastUpdated, setLastUpdated] = useState("");

  useEffect(() => {
    let active = true;

    async function loadData() {
      try {
        const response = await fetch("/api/telemetry", { cache: "no-store" });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || "Gagal mengambil data");

        if (active) {
          setReadings(result.readings || []);
          setLastUpdated(new Date().toISOString());
          setError("");
        }
      } catch (err) {
        if (active) setError(err instanceof Error ? err.message : "Koneksi bermasalah");
      } finally {
        if (active) setLoading(false);
      }
    }

    loadData();
    const timer = setInterval(loadData, 5000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, []);

  const latest = readings[0];
  const chartReadings = useMemo(() => readings.slice(0, 12).reverse(), [readings]);
  const mapUrl = latest?.gps_valid && latest.latitude !== null && latest.longitude !== null
    ? `https://www.google.com/maps?q=${latest.latitude},${latest.longitude}`
    : "";

  return (
    <main className="shell">
      <header className="topbar">
        <div>
          <div className="eyebrow">INTERNET OF THINGS · ESP32-C3</div>
          <h1>Trash Monitor</h1>
          <p className="subheading">Pemantauan kapasitas tempat sampah secara online</p>
        </div>
        <div className="live-pill"><span className="pulse" /> LIVE · refresh 5 detik</div>
      </header>

      {error && <div className="alert">Koneksi data: {error}</div>}

      <section className="summary-grid">
        <article className="panel main-capacity">
          <div className="panel-label">KAPASITAS TERISI</div>
          <div className="capacity-line">
            <strong>{latest ? `${Number(latest.capacity_percent).toFixed(1)}%` : "--"}</strong>
            <span className={`status ${statusClass(latest?.status)}`}>
              {latest?.status || (loading ? "MEMUAT" : "BELUM ADA DATA")}
            </span>
          </div>
          <div className="progress"><div style={{ width: `${Math.max(0, Math.min(100, latest?.capacity_percent || 0))}%` }} /></div>
          <div className="muted small">Ketinggian bagian dalam tempat sampah: 57 cm</div>
        </article>

        <article className="panel metric">
          <div className="panel-label">JARAK SENSOR</div>
          <strong>{latest ? `${Number(latest.distance_cm).toFixed(1)} cm` : "--"}</strong>
          <span className="muted">Sensor ke permukaan sampah</span>
        </article>

        <article className="panel metric">
          <div className="panel-label">TINGGI SAMPAH</div>
          <strong>{latest ? `${Number(latest.fill_height_cm).toFixed(1)} cm` : "--"}</strong>
          <span className="muted">Estimasi tinggi terisi</span>
        </article>
      </section>

      <section className="content-grid">
        <article className="panel">
          <div className="section-heading">
            <div>
              <div className="panel-label">RIWAYAT PEMANTAUAN</div>
              <h2>Grafik kapasitas</h2>
            </div>
            <span className="muted small">12 data terbaru</span>
          </div>
          {chartReadings.length ? (
            <div className="chart">
              {chartReadings.map((item) => (
                <div className="chart-col" key={item.id} title={`${Number(item.capacity_percent).toFixed(1)}% · ${formatDate(item.created_at)}`}>
                  <div className="chart-value">{Math.round(item.capacity_percent)}%</div>
                  <div className="bar-track"><div className="bar" style={{ height: `${Math.max(3, Math.min(100, item.capacity_percent))}%` }} /></div>
                  <div className="chart-time">{new Date(item.created_at).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}</div>
                </div>
              ))}
            </div>
          ) : (
            <div className="empty">Belum ada riwayat. Kirim data pertama dari ESP32 untuk mengisi grafik.</div>
          )}
        </article>

        <article className="panel">
          <div className="panel-label">GPS TRACKING</div>
          <h2>Lokasi tempat sampah</h2>
          {latest?.gps_valid && latest.latitude !== null && latest.longitude !== null ? (
            <>
              <div className="coordinates">
                <div><span className="muted">Latitude</span><strong>{latest.latitude.toFixed(6)}</strong></div>
                <div><span className="muted">Longitude</span><strong>{latest.longitude.toFixed(6)}</strong></div>
                <div><span className="muted">Satelit</span><strong>{latest.satellites ?? "--"}</strong></div>
              </div>
              <a className="map-link" href={mapUrl} target="_blank" rel="noreferrer">Buka lokasi di Google Maps ↗</a>
              <p className="muted small">Peta akan tersedia setelah modul GPS memperoleh fix yang valid.</p>
            </>
          ) : (
            <div className="gps-wait">
              <div className="gps-icon">⌖</div>
              <strong>Menunggu GPS fix</strong>
              <span className="muted small">Koordinat akan muncul setelah GPS mendapatkan posisi valid.</span>
              <span className="muted small">Satelit terdeteksi: {latest?.satellites ?? "Belum tersedia"}</span>
            </div>
          )}
        </article>
      </section>

      <section className="panel table-panel">
        <div className="section-heading">
          <div>
            <div className="panel-label">DATA TERSIMPAN</div>
            <h2>Riwayat data sensor</h2>
          </div>
          <span className="muted small">{readings.length} data terbaru</span>
        </div>
        <div className="table-wrap">
          <table>
            <thead><tr><th>Waktu</th><th>Jarak</th><th>Tinggi</th><th>Kapasitas</th><th>Status</th><th>GPS</th></tr></thead>
            <tbody>
              {readings.length ? readings.slice(0, 20).map((item) => (
                <tr key={item.id}>
                  <td>{formatDate(item.created_at)}</td>
                  <td>{Number(item.distance_cm).toFixed(1)} cm</td>
                  <td>{Number(item.fill_height_cm).toFixed(1)} cm</td>
                  <td>{Number(item.capacity_percent).toFixed(1)}%</td>
                  <td><span className={`status ${statusClass(item.status)}`}>{item.status}</span></td>
                  <td>{item.gps_valid ? "FIX" : "Belum fix"}</td>
                </tr>
              )) : <tr><td colSpan={6} className="empty-cell">{loading ? "Memuat data..." : "Belum ada data masuk."}</td></tr>}
            </tbody>
          </table>
        </div>
      </section>

      <footer>
        <span>Trash Monitor · ESP32-C3 + HC-SR04 + GPS</span>
        <span>Update dashboard: {lastUpdated ? formatDate(lastUpdated) : "--"}</span>
      </footer>
    </main>
  );
}
