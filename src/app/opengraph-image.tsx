import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { ImageResponse } from "next/og";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "PeriniHub: criação de sites e desenvolvimento de sistemas";

export default async function OpengraphImage() {
  const logo = await readFile(join(process.cwd(), "public/perinihub-logo-dark.png"));
  const logoSrc = `data:image/png;base64,${logo.toString("base64")}`;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: "#040b1c",
          padding: "72px",
          position: "relative",
        }}
      >
        {/* Halo azul/aqua, como no hero do site */}
        <div
          style={{
            position: "absolute",
            top: -200,
            right: -140,
            width: 640,
            height: 640,
            borderRadius: "50%",
            background: "rgba(22, 119, 255, 0.35)",
            filter: "blur(100px)",
            display: "flex",
          }}
        />
        <div
          style={{
            position: "absolute",
            bottom: -260,
            right: 120,
            width: 520,
            height: 520,
            borderRadius: "50%",
            background: "rgba(34, 227, 216, 0.18)",
            filter: "blur(100px)",
            display: "flex",
          }}
        />

        <img src={logoSrc} alt="" width={347} height={100} />

        <div style={{ display: "flex", flexDirection: "column", gap: 26 }}>
          <div
            style={{
              fontSize: 76,
              fontWeight: 700,
              color: "#ffffff",
              lineHeight: 1.05,
              letterSpacing: -2.5,
              maxWidth: 980,
              display: "flex",
            }}
          >
            Sites e sistemas sob medida para a sua empresa crescer.
          </div>
          <div style={{ fontSize: 30, color: "rgba(255,255,255,0.65)", display: "flex" }}>
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
                color: "#d9e9ff",
                border: "1px solid rgba(125,182,255,0.3)",
                background: "rgba(22,119,255,0.12)",
                borderRadius: 999,
                padding: "12px 24px",
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
