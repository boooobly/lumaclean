export function upholsteryIntent(text: string) {
  return /вывести.{0,20}пятн|химчист|экстрактор|моющ[\p{L}]*\s+пылесос|dubinsko\s+pranje|dubinskog\s+pranja|дубинско\s+прање|pranje\s+(?:kauča|kauca|troseda|nameštaja|namestaja|tepiha|dušeka)|upholstery|(?:sofa|couch|carpet|mattress).{0,20}(?:clean|wash)|(?:clean|cleaning|wash).{0,30}(?:sofa|couch|stain|carpet|mattress)|(?:диван|мебел|кресл|ковр|матрас).{0,30}(?:чист|пятн)|(?:пятн|вывести|чистк|почист|очист).{0,35}(?:диван|мебел|кресл|ковр|матрас)/iu.test(
    text,
  );
}

export function upholsteryBookingIntent(text:string){
 if(!upholsteryIntent(text))return false;
 if(/^(?:как|how|kako|како).{0,30}(?:заказ|book|order|zakaz|заказ)/iu.test(text.trim()))return false;
 if(/сколько|стоим|цен[аыу]|how much|price|cost|koliko|cena|колико|цена|занимаетесь|делаете|оказываете|выполняете|do you|can you|could you|вы можете|možete li|mozete li|можете ли|da li|да ли/iu.test(text)&&!/нужн|хочу|заказ|вместе|need|want|book|together|treba|želim|zelim|zajedno|треба|желим|заједно|please clean|my (?:sofa|couch|carpet|mattress)|(?<!\p{L})(?:мой|мою|моя|мо[её]|нашу)(?!\p{L})/iu.test(text))return false;
 return true;
}
