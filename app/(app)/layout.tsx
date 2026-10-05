import { EstructuraAplicacion } from "@/components/estructura-aplicacion";

export default function DisenoAplicacion({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return <EstructuraAplicacion>{children}</EstructuraAplicacion>;
}
