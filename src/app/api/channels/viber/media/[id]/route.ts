import {mediaTicketValid} from '@/lib/agent/channel-media-ticket';
import {getDatabase} from '@/lib/database/client';
import {PrivateBlobStorage} from '@/lib/agent/chat-attachments';
export const runtime='nodejs';
export async function GET(request:Request,{params}:{params:Promise<{id:string}>}){
 const {id}=await params,url=new URL(request.url),headers={'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff','X-Robots-Tag':'noindex, nofollow'};
 if(!mediaTicketValid(id,url.searchParams.get('expires'),url.searchParams.get('signature')))return new Response(null,{status:404,headers});
 try{const row=await getDatabase().chatAttachment.findUnique({where:{id},include:{message:{select:{author:true,conversation:{select:{channel:true}}}}}});if(!row||row.message?.author!=='ADMIN'||row.message.conversation.channel!=='VIBER'||!['image/jpeg','application/pdf'].includes(row.mimeType))return new Response(null,{status:404,headers});const bytes=await new PrivateBlobStorage().read(row.storageKey);return new Response(new Uint8Array(bytes),{headers:{...headers,'Content-Type':row.mimeType,'Content-Disposition':'attachment; filename="attachment"'}});}catch{return new Response(null,{status:404,headers});}
}
