import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { BookOpenCheck, ExternalLink, Trash2 } from 'lucide-react';
import { ConfirmButton } from '@/components/confirm-button';
import { PageHeader } from '@/components/page-header';
import { CaseForm } from '@/components/super-admin/case-form';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { deleteCase } from '@/lib/actions/super-admin';
import { prisma } from '@/lib/db';
import { isMethodKey } from '@/lib/engines';
import { parseId, requireSuperAdmin } from '@/lib/guards';

export const metadata: Metadata = { title: 'Pengaturan Case' };

export default async function CaseEditPage({ params }: { params: Promise<{ id: string }> }) {
  await requireSuperAdmin();
  const id = parseId((await params).id);
  const [kasus, clients] = await Promise.all([
    prisma.spkCase.findUnique({
      where: { id },
      include: { client: { select: { namaClient: true, slug: true } }, _count: { select: { consultations: true } } },
    }),
    prisma.client.findMany({ orderBy: { namaClient: 'asc' }, select: { id: true, namaClient: true, slug: true } }),
  ]);
  if (!kasus) notFound();

  return (
    <>
      <PageHeader
        judul={kasus.judul}
        deskripsi={`Client: ${kasus.client.namaClient}`}
        crumbs={[{ label: 'SPK Case', href: '/super-admin/cases' }, { label: kasus.judul }]}
        aksi={
          <>
            <Button asChild variant="outline">
              <Link href={`/c/${kasus.client.slug}/${kasus.slug}`} target="_blank">
                <ExternalLink /> Halaman publik
              </Link>
            </Button>
            <Button asChild>
              <Link href={`/admin/cases/${kasus.id}`}>
                <BookOpenCheck /> Kelola basis pengetahuan
              </Link>
            </Button>
          </>
        }
      />

      <CaseForm
        id={kasus.id}
        clients={clients}
        kategoriTersimpan={kasus.category}
        defaultValues={{
          clientId: kasus.clientId,
          judul: kasus.judul,
          slug: kasus.slug,
          deskripsi: kasus.deskripsi ?? '',
          methodKey: isMethodKey(kasus.methodKey) ? kasus.methodKey : 'saw',
          mcdmMode: kasus.mcdmMode,
          requiresLogin: kasus.requiresLogin,
          isActive: kasus.isActive,
        }}
      />

      <Card className="mt-8 max-w-3xl border-red-200">
        <CardHeader>
          <CardTitle className="text-destructive">Zona berbahaya</CardTitle>
          <CardDescription>
            Menghapus Case akan menghapus permanen basis pengetahuan, data uji, dan {kasus._count.consultations} riwayat konsultasinya.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ConfirmButton
            action={deleteCase.bind(null, kasus.id)}
            judul={`Hapus Case “${kasus.judul}”?`}
            deskripsi="Seluruh alternatif, kriteria/gejala/aturan, riwayat konsultasi, dan data uji validitas Case ini akan dihapus permanen."
            labelKonfirmasi="Ya, hapus Case"
            redirectTo="/super-admin/cases"
          >
            <Button variant="destructive">
              <Trash2 /> Hapus Case
            </Button>
          </ConfirmButton>
        </CardContent>
      </Card>
    </>
  );
}
