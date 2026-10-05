import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";
const parametros = { N: 32768, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };
const derivar = (contrasena: string, sal: string) =>
  new Promise<Buffer>((resolver, rechazar) => {
    scrypt(contrasena, sal, 64, parametros, (error, clave) =>
      error ? rechazar(error) : resolver(clave),
    );
  });

export async function protegerContrasena(contrasena: string) {
  const sal = randomBytes(16).toString("hex");
  const clave = await derivar(contrasena, sal);
  return `scrypt$32768$8$1$${sal}$${clave.toString("hex")}`;
}

export async function comprobarContrasena(
  contrasena: string,
  resumen: unknown,
) {
  const partes = typeof resumen === "string" ? resumen.split("$") : [];
  const valido =
    partes.length === 6 &&
    partes[0] === "scrypt" &&
    partes[1] === "32768" &&
    partes[2] === "8" &&
    partes[3] === "1" &&
    /^[a-f0-9]{32}$/.test(partes[4]) &&
    /^[a-f0-9]{128}$/.test(partes[5]);
  // También se deriva una clave para cuentas inexistentes o migradas sin contraseña.
  const clave = await derivar(
    contrasena,
    valido ? partes[4] : "00000000000000000000000000000000",
  );
  return valido && timingSafeEqual(clave, Buffer.from(partes[5], "hex"));
}
