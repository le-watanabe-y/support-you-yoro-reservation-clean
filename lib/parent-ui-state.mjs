const tabs=new Set(['bookings','children','guide']);
const key=login=>`supportyou-parent-ui:${login}`;
const clean=value=>({
 tab:tabs.has(value?.tab)?value.tab:'bookings',
 date:typeof value?.date==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(value.date)?value.date:'',
 scrollY:Number.isFinite(value?.scrollY)?Math.max(0,Math.min(100000,Math.round(value.scrollY))):0
});
const resolveStorage=storage=>typeof storage==='function'?storage():storage;
export function loadParentUi(login,storage){try{return clean(JSON.parse(resolveStorage(storage).getItem(key(login))||'{}'));}catch{return clean({});}}
// Optional view preferences must never interrupt a booking or effect cleanup.
// Accept a getter so browser denial while accessing localStorage is covered too.
export function saveParentUi(login,value,storage){const next=clean(value);try{resolveStorage(storage).setItem(key(login),JSON.stringify(next));}catch{/* Continue without restoring this device preference next time. */}return next;}
