import type { PointCategory } from '@shared/points';

import administrationIconUrl from 'bootstrap-icons/icons/building-fill-gear.svg?url';
import healthcareIconUrl from 'bootstrap-icons/icons/hospital-fill.svg?url';
import laboratoryIconUrl from 'bootstrap-icons/icons/beaker-fill.svg?url';
import logisticsIconUrl from 'bootstrap-icons/icons/truck-front-fill.svg?url';
import maintenanceIconUrl from 'bootstrap-icons/icons/wrench-adjustable-circle-fill.svg?url';
import officeIconUrl from 'bootstrap-icons/icons/briefcase-fill.svg?url';
import parkIconUrl from 'bootstrap-icons/icons/tree-fill.svg?url';
import processUnitIconUrl from 'bootstrap-icons/icons/cpu-fill.svg?url';
import restaurantIconUrl from 'bootstrap-icons/icons/cup-hot-fill.svg?url';
import retailIconUrl from 'bootstrap-icons/icons/shop-window.svg?url';
import safetyIconUrl from 'bootstrap-icons/icons/shield-fill-check.svg?url';
import schoolIconUrl from 'bootstrap-icons/icons/mortarboard-fill.svg?url';
import storageIconUrl from 'bootstrap-icons/icons/database-fill.svg?url';
import transitIconUrl from 'bootstrap-icons/icons/train-front-fill.svg?url';
import utilitiesIconUrl from 'bootstrap-icons/icons/lightning-charge-fill.svg?url';
import warehouseIconUrl from 'bootstrap-icons/icons/boxes.svg?url';

export const POINT_ICON_URLS: Record<PointCategory, string> = {
  restaurant: restaurantIconUrl,
  transit: transitIconUrl,
  office: officeIconUrl,
  school: schoolIconUrl,
  park: parkIconUrl,
  retail: retailIconUrl,
  healthcare: healthcareIconUrl,
  warehouse: warehouseIconUrl,
  process_unit: processUnitIconUrl,
  utilities: utilitiesIconUrl,
  storage: storageIconUrl,
  maintenance: maintenanceIconUrl,
  logistics: logisticsIconUrl,
  safety: safetyIconUrl,
  laboratory: laboratoryIconUrl,
  administration: administrationIconUrl,
};

export const POINT_ICON_COLORS: Record<PointCategory, string> = {
  restaurant: '#c2410c',
  transit: '#1d4ed8',
  office: '#1e3a8a',
  school: '#7c3aed',
  park: '#15803d',
  retail: '#be185d',
  healthcare: '#b91c1c',
  warehouse: '#475569',
  process_unit: '#9a3412',
  utilities: '#0f766e',
  storage: '#a16207',
  maintenance: '#4338ca',
  logistics: '#0f766e',
  safety: '#be123c',
  laboratory: '#0369a1',
  administration: '#334155',
};
