import {notFound} from 'next/navigation';
import {requireAdmin} from '@/lib/auth/session';
import {KnowledgePreview} from './preview';
export default async function Page(){
 if(process.env.VERCEL_ENV!=='preview')notFound();
 await requireAdmin();
 return <KnowledgePreview/>;
}
