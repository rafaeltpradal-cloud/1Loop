import { FOUNDERS_ENDS_LABEL, foundersCountdown, foundersOpen, priceNow } from '@/lib/founders';
import { PLANS } from '@/lib/plans';

/** Preços do momento para as páginas de anúncio (Founders ou cheio). */
export function salesPrices() {
  return { founders: foundersOpen(), basic: priceNow('basic'), pro: priceNow('pro'), proFull: PLANS.pro.priceFull, label: FOUNDERS_ENDS_LABEL, countdown: foundersCountdown() };
}
