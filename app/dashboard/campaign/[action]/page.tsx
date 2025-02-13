import { Suspense } from 'react';
import CampaignForm from '@/components/CampaignForm';

interface PageProps {
  params: {
    action: string;
  };
  searchParams: {
    id?: string;
    mediaid?: string;
  };
}

export default async function CampaignPage({searchParams }: PageProps) {
  // Await searchParams to properly handle them in Next.js 13+
  const { id, mediaid } = await Promise.resolve(searchParams);
  
  const campaignId = id ? parseInt(id) : 0;
  const mediaId = mediaid ? parseInt(mediaid) : 0;

  return (
    <div className="container mx-auto px-4 py-8">
      <Suspense fallback={<div>Loading...</div>}>
        <CampaignForm campaignId={campaignId} mediaId={mediaId} />
      </Suspense>
    </div>
  );
}
