export const LINE_VIEWS = Object.freeze({
  reserve: { tab: 'bookings', target: 'reservation-days', label: '予約を申し込む' },
  history: { tab: 'bookings', target: 'parent-booking-history', label: '予約を確認する' },
  guide: { tab: 'guide', target: 'parent-guide', label: '利用案内を見る' },
});

// No account IDs, reservation IDs or login credentials belong in LINE menu URLs.
export function lineEntry(search = '') {
  const view = new URLSearchParams(search).get('view');
  return Object.hasOwn(LINE_VIEWS, view) ? { view, ...LINE_VIEWS[view] } : { view: 'reserve', ...LINE_VIEWS.reserve };
}
export const isLinePath = pathname => /^\/f\/[a-z0-9-]+\/line\/?$/.test(pathname);

export function lineEntryPath(facilityId, view = 'reserve', staff = false) {
  if (staff) return `/line/staff?f=${facilityId}`;
  return `/f/${facilityId}/line?view=${Object.hasOwn(LINE_VIEWS, view) ? view : 'reserve'}`;
}

export function externalLinePath(pathname = '', search = '') {
  const params = new URLSearchParams(search); params.set('openExternalBrowser', '1');
  return `${pathname}?${params}`;
}

export function buildLineMenu(origin, facilityId) {
  const url = new URL(origin);
  if (url.protocol !== 'https:' || url.username || url.password || url.pathname !== '/' || url.search || url.hash) {
    throw new Error('HTTPSのサイトのオリジンを指定してください。');
  }
  return {
    size: { width: 2500, height: 843 },
    selected: true,
    name: 'Support you 予約入口',
    chatBarText: '予約・確認・利用案内',
    areas: ['reserve', 'history', 'guide'].map((view, i) => ({
      bounds: { x: [0, 834, 1667][i], y: 0, width: [834, 833, 833][i], height: 843 },
      action: { type: 'uri', label: LINE_VIEWS[view].label, uri: url.origin + lineEntryPath(facilityId, view) },
    })),
  };
}
