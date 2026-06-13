export type OptionsRouteView = 'feishu' | 'tables' | 'ai' | 'interop' | 'importExport';

export interface OptionsRoute {
  view: OptionsRouteView;
  tableId: string | null;
  autoLoadFields: boolean;
}

function decodeHashPart(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function splitHash(hash: string): string[] {
  return hash
    .replace(/^#/, '')
    .split('/')
    .map(part => part.trim())
    .filter(Boolean)
    .map(decodeHashPart);
}

export function parseOptionsHash(hash: string): OptionsRoute {
  const [view, tableId, section] = splitHash(hash);

  if (view === 'tables') {
    return {
      view: 'tables',
      tableId: tableId || null,
      autoLoadFields: section === 'fields',
    };
  }

  if (view === 'interop' || view === 'ai' || view === 'importExport') {
    return {
      view,
      tableId: null,
      autoLoadFields: false,
    };
  }

  return {
    view: 'feishu',
    tableId: null,
    autoLoadFields: false,
  };
}

export function buildOptionsHash(route: OptionsRoute): string {
  if (route.view === 'tables') {
    const tablePath = route.tableId ? `/${encodeURIComponent(route.tableId)}` : '';
    const fieldPath = route.tableId && route.autoLoadFields ? '/fields' : '';
    return `#tables${tablePath}${fieldPath}`;
  }

  if (route.view === 'feishu') return '';
  return `#${route.view}`;
}

export function buildTableMappingOptionsHash(tableId: string): string {
  return buildOptionsHash({
    view: 'tables',
    tableId,
    autoLoadFields: true,
  });
}
