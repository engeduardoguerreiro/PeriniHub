import { ImageResponse } from "next/og";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "PeriniHub — Criação de sites e desenvolvimento de sistemas";

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: "#09090b",
          padding: "72px",
          position: "relative",
        }}
      >
        {/* Brilho vermelho no canto superior direito */}
        <div
          style={{
            position: "absolute",
            top: -220,
            right: -160,
            width: 620,
            height: 620,
            borderRadius: "50%",
            background: "rgba(228, 22, 28, 0.30)",
            filter: "blur(90px)",
            display: "flex",
          }}
        />

        <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
          <div
            style={{
              width: 16,
              height: 46,
              borderRadius: 4,
              background: "#e4161c",
              display: "flex",
            }}
          />
          <div
            style={{
              fontSize: 30,
              fontWeight: 700,
              color: "#fafafa",
              letterSpacing: 10,
              display: "flex",
            }}
          >
            PERINIHUB
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 26 }}>
          <div
            style={{
              fontSize: 78,
              fontWeight: 800,
              color: "#ffffff",
              lineHeight: 1.05,
              letterSpacing: -2.5,
              maxWidth: 960,
              display: "flex",
            }}
          >
            Sites e sistemas sob medida para a sua empresa.
          </div>
          <div
            style={{
              fontSize: 30,
              color: "#a1a1aa",
              display: "flex",
            }}
          >
            Orçamento em até 24 horas, sem compromisso.
          </div>
        </div>

        <div style={{ display: "flex", gap: 14 }}>
          {["Sites e landing pages", "Sistemas sob medida", "Automações"].map((item) => (
            <div
              key={item}
              style={{
                display: "flex",
                fontSize: 24,
                color: "#e4e4e7",
                border: "1px solid rgba(255,255,255,0.18)",
                borderRadius: 10,
                padding: "12px 22px",
              }}
            >
              {item}
            </div>
          ))}
        </div>
      </div>
    ),
    size,
  );
}
