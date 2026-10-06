export const validNumericTaxIds = ["11222333000181"] as const;
// Exemplo público divulgado na implantação do CNPJ alfanumérico:
// https://www.juntacomercial.pr.gov.br/ — consultado em 12/09/2026.
// "12ABC34501DE35" é o exemplo do documento técnico da Receita Federal
// (calculo-do-dv-do-cnpj-alfanumerico.pdf) — consultado em 05/10/2026.
export const validAlphanumericTaxIds = [
  "12345678000A08",
  "12ABC34501DE35",
] as const;
export const invalidTaxIds = [
  "",
  "123",
  "11222333000180",
  "11@222333000181",
] as const;
