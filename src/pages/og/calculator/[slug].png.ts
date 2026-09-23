import type { APIRoute, GetStaticPaths } from 'astro';
import { renderOg } from '../../../lib/og';
import { calcPages, calcScenario, calcHeadline } from '../../../lib/pages';
import { money } from '../../../lib/format';

export const getStaticPaths: GetStaticPaths = () => calcPages().map((page) => ({ params: { slug: page.slug }, props: { page } }));

export const GET: APIRoute = async ({ props }) => {
  const page = props.page as ReturnType<typeof calcPages>[number];
  const scenario = calcScenario(page);
  const headline = calcHeadline(page);
  const png = await renderOg({
    eyebrow: 'Compoundly · Compound interest result',
    title: `${money(page.amount, 'USD', 0)} at ${page.rate}% for ${page.years} years`,
    subtitle: `Grows to ${money(headline)} (${scenario.compounding === 'y' ? 'yearly' : scenario.compounding} compounding)`,
  });
  return new Response(new Uint8Array(png), { headers: { 'Content-Type': 'image/png' } });
};
