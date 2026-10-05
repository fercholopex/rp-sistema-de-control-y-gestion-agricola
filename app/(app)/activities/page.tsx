import { redirect } from "next/navigation";
export default function RutaAnterior() {
  redirect("/operaciones?tipo_operacion=practica_general");
}
