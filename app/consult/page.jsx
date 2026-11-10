import Consult from '@/components/Consult';

export const metadata = { title: 'Consult | Dubash' };

export default async function Page({ searchParams }) {
  const demo = (await searchParams)?.demo === '1';
  return <Consult demo={demo} key={demo ? 'demo' : 'live'} />;
}
