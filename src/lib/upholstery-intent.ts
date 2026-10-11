export function upholsteryIntent(text: string) {
  return /вывести.{0,20}пятн|химчист|экстрактор|моющ[\p{L}]*\s+пылесос|dubinsko\s+pranje|dubinskog\s+pranja|дубинско\s+прање|pranje\s+(?:kauča|kauca|troseda|nameštaja|namestaja|tepiha|dušeka)|upholstery|(?:carpet|mattress).{0,20}(?:clean|wash)|(?:clean|cleaning|wash).{0,30}(?:sofa|couch|stain|carpet|mattress)|(?:диван|мебел|кресл|ковр|матрас).{0,30}(?:чист|пятн)|(?:пятн|вывести|чистк).{0,35}(?:диван|мебел|кресл|ковр|матрас)/iu.test(
    text,
  );
}
