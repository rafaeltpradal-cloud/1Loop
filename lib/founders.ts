// Preço Founders: vale para quem assinar até 31/10/2026 às 23h59 (Brasília) e fica travado
// enquanto a assinatura durar. Depois disso o checkout cobra o preço cheio e o site para de mostrar a oferta.
import { FOUNDERS_ENDS_AT, PLANS, type PlanId } from '@/lib/plans';

export { FOUNDERS_ENDS_AT };
export const FOUNDERS_ENDS_LABEL = '31/10 às 23h59';

export function foundersOpen(now = new Date()) {
  return now.getTime() <= FOUNDERS_ENDS_AT.getTime();
}

/** Preço que a pessoa paga hoje, em R$/mês. */
export function priceNow(plan: PlanId, now = new Date()) {
  const p = PLANS[plan];
  return foundersOpen(now) && p.priceFounders ? p.priceFounders : p.priceFull;
}

/** Dias inteiros até o fim (0 = acaba hoje). */
export function foundersDaysLeft(now = new Date()) {
  const ms = FOUNDERS_ENDS_AT.getTime() - now.getTime();
  return ms < 0 ? -1 : Math.floor(ms / 86400000);
}

export function foundersCountdown(now = new Date()) {
  const d = foundersDaysLeft(now);
  if (d < 0) return '';
  if (d === 0) return 'acaba hoje';
  if (d === 1) return 'acaba amanhã';
  return `acaba em ${d} dias`;
}

/** Ajusta o HTML da landing (/ e /vendedores) ao prazo do Founders e ao novo fluxo (prévia antes do cartão). */
export function landingWithFounders(html: string, now = new Date()) {
  let out = html.replace(
    'Planos Basic e Pro · 7 dias para testar · cancele quando quiser',
    'Veja sua estratégia e seus primeiros posts antes de colocar o cartão',
  );
  if (foundersOpen(now)) {
    return out.replace(
      'Preço Founders para os <span class="grad">1.000 primeiros</span> · travado para sempre',
      `Preço Founders até <span class="grad">${FOUNDERS_ENDS_LABEL}</span> · travado para sempre`,
    );
  }
  const strike = (full: number) => `<s style="font-size: 18px; font-weight: 600; color: #6E747D">R$ ${full}</s>`;
  const big = (v: number) => `<span style="font-size: 42px; font-weight: 700; letter-spacing: -1.2px">R$ ${v}</span>`;
  for (const id of ['basic', 'pro'] as PlanId[]) {
    const p = PLANS[id];
    if (!p.priceFounders) continue;
    out = out
      .replace(`${strike(p.priceFull)}${big(p.priceFounders)}`, big(p.priceFull))
      .replace(`Preço Founders · depois R$ ${p.priceFull}/mês`, 'Sem fidelidade · cancele quando quiser');
  }
  return out
    .replace(/<div class="fPill"[^]*?travado para sempre<\/div>/, '')
    .replace('<span>✓ Preço Founders travado para sempre</span>', '<span>✓ Sem fidelidade</span>');
}
