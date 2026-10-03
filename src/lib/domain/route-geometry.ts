export function decodeRouteGeometry(
  value: string,
  precision = 5,
): [number, number][] {
  if (![5, 6, 7].includes(precision) || value.length > 500000)
    throw Error("INVALID_GEOMETRY");
  let i = 0,
    lat = 0,
    lng = 0;
  const points: [number, number][] = [];
  const read = () => {
    let result = 0,
      shift = 0,
      b = 0;
    do {
      if (i >= value.length || shift > 30) throw Error("INVALID_GEOMETRY");
      b = value.charCodeAt(i++) - 63;
      if (b < 0 || b > 63) throw Error("INVALID_GEOMETRY");
      result |= (b & 31) << shift;
      shift += 5;
    } while (b >= 32);
    return result & 1 ? ~(result >> 1) : result >> 1;
  };
  while (i < value.length) {
    lat += read();
    lng += read();
    const p: [number, number] = [lng / 10 ** precision, lat / 10 ** precision];
    if (Math.abs(p[0]) > 180 || Math.abs(p[1]) > 90)
      throw Error("INVALID_GEOMETRY");
    points.push(p);
  }
  return points;
}
