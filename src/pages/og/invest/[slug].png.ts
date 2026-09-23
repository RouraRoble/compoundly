import type { APIRoute, GetStaticPaths } from 'astro';
import { renderOg } from '../../../lib/og';
import { investPages, investHeadline } from '../../../lib/pages';
import { money } from '../../../lib/format';

export const getStaticPaths: GetStaticPaths = () => investPages().map((page) => ({ params: { slug: page.slug }, props: { page } }));

export const GET: APIRoute = async ({ props }) => {
  const page = props.page as ReturnType<typeof investPages>[number];
  const headline = investHeadline(page);
  const png = await renderOg({
    eyebrow: 'Compoundly · Investment result',
    title: `${money(page.monthly, 'USD', 0)}/month at ${page.rate}% for ${page.years} years`,
    subtitle: `Grows to ${money(headline)} (monthly compounding)`,
  });
  return new Response(new Uint8Array(png), { headers: { 'Content-Type': 'image/png' } });
};
