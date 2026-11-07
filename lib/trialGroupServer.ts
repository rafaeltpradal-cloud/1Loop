import { cookies } from 'next/headers';
import { TRIAL_GROUP_COOKIE, cardTestOn, groupFromCookie } from '@/lib/trialGroup';

/** Página pública: a pessoa está no grupo do cartão? (lê o cookie do sorteio) */
export async function visitorCardGroup() {
  if (!cardTestOn()) return false;
  return groupFromCookie((await cookies()).get(TRIAL_GROUP_COOKIE)?.value) === 'cartao';
}
