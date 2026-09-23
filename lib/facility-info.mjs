// Organization-wide information (the operating company). Safe for the browser.
// Facility-specific information (name, phone, address, rules) lives in each facility's
// settings and is edited from the staff screen.
export const ORGANIZATION = Object.freeze({
  serviceName: process.env.NEXT_PUBLIC_SERVICE_NAME || 'Support you 病児保育予約',
  operator: process.env.NEXT_PUBLIC_OPERATOR_NAME || '有限会社ライフ・エスコート',
  contact: process.env.NEXT_PUBLIC_OPERATOR_CONTACT || '',
});
