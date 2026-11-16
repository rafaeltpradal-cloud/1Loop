// Preço Founders: vale para quem assinar até 30/11/2026 às 23h59 (Brasília; prorrogado, era 31/10) e fica travado
// enquanto a assinatura durar. Depois disso o checkout cobra o preço cheio e o site para de mostrar a oferta.
import { FOUNDERS_ENDS_AT, PLANS, type PlanId } from '@/lib/plans';

export { FOUNDERS_ENDS_AT };
export const FOUNDERS_ENDS_LABEL = '30/11 às 23h59';

/** Encerrado em 16/11/2026: o preço novo (PLANS.priceFull) vale para todos, sem prazo. */
export function foundersOpen(now = new Date()) {
  void now;
  return false;
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

/**
 * Ajusta o HTML da landing (/) ao modelo de 16/11/2026: estratégia e primeiros posts grátis, sem cartão;
 * para continuar, assina e paga na hora no preço novo (PLANS.priceFull), com garantia de 7 dias.
 */
export function landingWithFounders(html: string) {
  let out = html
    .replace('Planos Basic e Pro · 7 dias para testar · cancele quando quiser', `Estratégia e primeiros posts grátis, sem cartão · Pro por R$ ${PLANS.pro.priceFull}/mês · garantia de 7 dias`)
    .replace(/href="#planos"><span>Testar<span class="hideXs"> 7 dias<\/span><\/span><\/a>/, 'href="/cadastro?plano=pro" data-cta="topo"><span>Começar grátis</span></a>')
    .replace('<a class="btn3d" href="#planos">Testar 7 dias grátis</a>', '<a class="btn3d" href="/cadastro?plano=pro" data-cta="hero">Ver minha estratégia grátis</a>')
    .replace(/<a class="btn3d" href="#planos"( style="[^"]*")>Começar meus 7 dias<\/a>/, '<a class="btn3d" href="/cadastro?plano=pro" data-cta="final"$1>Ver minha estratégia grátis</a>')
    .replace(/(href="\/cadastro\?plano=(basic|pro|multi)")>Testar 7 dias o (Basic|Pro|Multi)</g, '$1 data-cta="plano-$2">Começar grátis no $3<')
    .replace('<span>✓ 7 dias para testar</span>', '<span>✓ Primeiros posts grátis, sem cartão</span><span>✓ Garantia de 7 dias</span>')
    .replace('Sim. Você testa por 7 dias e pode cancelar a qualquer momento.', 'Sim. Sem fidelidade: cancela em 1 clique. E se nos primeiros 7 dias não fizer sentido, devolvemos 100% do valor.');
  // Preços: o HTML ainda traz o Founders antigo (riscado + preço); troca pelo preço novo.
  const strike = (full: number) => `<s style="font-size: 18px; font-weight: 600; color: #6E747D">R$ ${full}</s>`;
  const big = (v: number) => `<span style="font-size: 42px; font-weight: 700; letter-spacing: -1.2px">R$ ${v}</span>`;
  const OLD: Record<'basic' | 'pro', [number, number]> = { basic: [97, 67], pro: [197, 147] };
  for (const id of ['basic', 'pro'] as const) {
    const [full, founders] = OLD[id];
    out = out
      .replace(`${strike(full)}${big(founders)}`, big(PLANS[id].priceFull))
      .replace(`Preço Founders · depois R$ ${full}/mês`, 'Sem fidelidade · garantia de 7 dias');
  }
  return out
    // A conta antiga do Multi (R$ 83 por marca contra R$ 197 no Pro) não vale com o Pro a R$ 67.
    .replace('≈ R$ 83 por marca · no Pro seriam R$ 197 cada', 'Até 6 marcas, com time e aprovação do cliente')
    .replace(/<div class="fPill"[^]*?travado para sempre<\/div>/, '')
    .replace('<span>✓ Preço Founders travado para sempre</span>', '<span>✓ Sem fidelidade</span>');
}
