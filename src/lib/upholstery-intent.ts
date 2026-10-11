export function upholsteryIntent(text: string) {
  return /вывести.{0,20}пятн|химчист|экстрактор|моющ[\p{L}]*\s+пылесос|dubinsko\s+pranje|dubinskog\s+pranja|дубинско\s+прање|pranje\s+(?:kauča|kauca|troseda|nameštaja|namestaja)|upholstery|(?:clean|cleaning).{0,30}(?:sofa|couch|stain)|(?:диван|мебел|кресл).{0,30}(?:чист|пятн)|(?:пятн|вывести).{0,35}(?:диван|мебел|кресл)/iu.test(
    text,
  );
}
