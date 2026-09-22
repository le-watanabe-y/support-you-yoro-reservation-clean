// Facility information shown to parents. Safe for the browser (public values only).
// Set NEXT_PUBLIC_FACILITY_* in the hosting environment to override.
export const FACILITY = Object.freeze({
  name: process.env.NEXT_PUBLIC_FACILITY_NAME || '病児保育室 Support you（養老）',
  operator: process.env.NEXT_PUBLIC_FACILITY_OPERATOR || '有限会社ライフ・エスコート',
  shortName: process.env.NEXT_PUBLIC_FACILITY_SHORT_NAME || 'Support you',
  phone: process.env.NEXT_PUBLIC_FACILITY_PHONE || '',
  address: process.env.NEXT_PUBLIC_FACILITY_ADDRESS || '',
  hours: '平日 9:00〜17:00（土日・祝日・年末年始 12/29〜1/3 は休園）',
});
