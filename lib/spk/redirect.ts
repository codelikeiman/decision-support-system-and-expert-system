/** Tujuan pasca-login end-user: hanya izinkan alamat di dalam halaman client yang sama. */
export function tujuanDalamClient(clientSlug: string, callbackUrl: string | undefined): string {
  const beranda = `/c/${clientSlug}`;
  if (!callbackUrl || callbackUrl.includes('\\') || callbackUrl.includes('//')) return beranda;
  if (callbackUrl === beranda || callbackUrl.startsWith(`${beranda}/`)) return callbackUrl;
  return beranda;
}
