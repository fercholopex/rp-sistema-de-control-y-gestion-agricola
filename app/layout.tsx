import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ERP Agrícola Siempre Alcachofa",
  description: "Gestión de lotes, mediciones, operaciones y costos agrícolas.",
};

export default function DisenoPrincipal({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
