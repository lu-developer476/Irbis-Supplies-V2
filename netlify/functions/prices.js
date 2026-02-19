exports.handler = async function () {

  const INFLACION_MENSUAL = 0.08;
  const FECHA_BASE = new Date("2024-01-01");
  const hoy = new Date();

  const meses =
    (hoy.getFullYear() - FECHA_BASE.getFullYear()) * 12 +
    (hoy.getMonth() - FECHA_BASE.getMonth());

  const factor = Math.pow(1 + INFLACION_MENSUAL, meses);

  return {
    statusCode: 200,
    body: JSON.stringify({
      factor
    })
  };
};
