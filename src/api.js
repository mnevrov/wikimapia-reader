/* Pure API request construction & defensive parsing: safe to test with node --test. */
const ENDPOINT = 'https://api.wikimapia.org/';
const FORMATS = new Set(['https:']);

export class ValidationError extends Error {}

export function buildRequest(func, key, opts = {}) {
  if (!['box', 'place.getbyarea', 'place.getbyid', 'search'].includes(func)) throw new ValidationError('Неизвестный метод API');
  if (!key || !String(key).trim()) throw new ValidationError('Нужен личный ключ Wikimapia API');
  const url = new URL(ENDPOINT);
  if (!FORMATS.has(url.protocol)) throw new ValidationError('Для ключа разрешён только HTTPS');
  url.searchParams.set('function', func);
  url.searchParams.set('key', String(key).trim());
  url.searchParams.set('format', 'json');
  url.searchParams.set('language', 'ru');
  url.searchParams.set('pack', 'none');
  if (func === 'place.getbyid') {
    const id = Number(opts.id);
    if (!Number.isSafeInteger(id) || id < 1) throw new ValidationError('Неверный ID объекта');
    url.searchParams.set('id', String(id));
    url.searchParams.set('data_blocks', 'main,location,geometry,photos,comments');
  } else if (func === 'search') {
    const query = String(opts.query ?? '').trim();
    if (!query || query.length > 200) throw new ValidationError('Введите запрос длиной до 200 символов');
    const lat=Number(opts.lat),lon=Number(opts.lon);
    if (!Number.isFinite(lat)||!Number.isFinite(lon)||Math.abs(lat)>90||Math.abs(lon)>180) throw new ValidationError('Некорректные координаты поиска');
    url.searchParams.set('lat',String(lat));
    url.searchParams.set('lon',String(lon));
    url.searchParams.set('q', query);
    url.searchParams.set('count', '20');
  } else {
    const bbox = opts.bbox;
    if (!Array.isArray(bbox) || bbox.length !== 4 || bbox.some(v => !Number.isFinite(Number(v)))) {
      throw new ValidationError('Некорректные границы карты');
    }
    const [west, south, east, north] = bbox.map(Number);
    if (west < -180 || east > 180 || south < -90 || north > 90 || west >= east || south >= north) {
      throw new ValidationError('Некорректные координаты');
    }
    if (east - west > 0.035 || north - south > 0.035) throw new ValidationError('Увеличьте масштаб карты');
    url.searchParams.set('bbox', bbox.join(','));
    url.searchParams.set('coordsby', 'bbox');
    const page = Number(opts.page ?? 1);
    if (!Number.isSafeInteger(page) || page < 1) throw new ValidationError('Некорректная страница API');
    url.searchParams.set('page', String(page));
    url.searchParams.set('count', '50');
  }
  return url.toString();
}

function plainText(value) {
  if (typeof value === 'string') return value;
  if (typeof value === 'number') return String(value);
  return '';
}
export function safeUrl(candidate) {
  try {
    const url = new URL(String(candidate ?? ''));
    return ['http:', 'https:'].includes(url.protocol) ? url.href : null;
  } catch { return null; }
}
export function wikimapiaUrl(id) {
  const number = Number(id);
  if (!Number.isSafeInteger(number) || number <= 0) return 'https://wikimapia.org/';
  return `https://wikimapia.org/${number}/`;
}
function unwrapCollection(value) {
  if (Array.isArray(value)) return value;
  if (value && typeof value === 'object') {
    for (const prop of ['places', 'place', 'photo', 'comment', 'items', 'item']) {
      if (Array.isArray(value[prop])) return value[prop];
      if (value[prop] && typeof value[prop] === 'object') return [value[prop]];
    }
  }
  return [];
}
function asLatLng(point) {
  if (!point) return null;
  if (Array.isArray(point) && point.length >= 2) {
    // Wikimapia polygon often uses x=longitude,y=latitude; array input is GeoJSON [lon,lat].
    if (point.slice(0,2).some(v => v === null || v === undefined || String(v).trim() === '')) return null;
    const [lon, lat] = point.map(Number);
    return Math.abs(lat) <= 90 && Math.abs(lon) <= 180 ? [lat, lon] : null;
  }
  const rawLat = point.lat ?? point.latitude ?? point.y;
  const rawLon = point.lon ?? point.lng ?? point.longitude ?? point.x;
  if ([rawLat,rawLon].some(v => v === null || v === undefined || String(v).trim() === '')) return null;
  const lat = Number(rawLat);
  const lon = Number(point.lon ?? point.lng ?? point.longitude ?? point.x);
  return Number.isFinite(lat) && Number.isFinite(lon) && Math.abs(lat) <= 90 && Math.abs(lon) <= 180 ? [lat, lon] : null;
}
export function geometryOf(place) {
  // Defensive conversion, definitive contract requires a sample from the live API.
  const geometry = place?.geometry ?? place ?? {};
  const polygon = geometry?.polygon ?? place?.polygon ?? geometry?.coordinates ?? null;
  let points = Array.isArray(polygon) ? polygon : polygon?.points ?? polygon?.point ?? polygon?.coordinates;
  if (!Array.isArray(points)) return [];
  if (points.length && Array.isArray(points[0]) && Array.isArray(points[0][0])) points = points[0];
  return points.map(asLatLng).filter(Boolean);
}
export function normalizeArea(payload) {
  const list = unwrapCollection(payload?.folder ?? payload?.places ?? payload);
  return list.map(item => ({
    id: Number(item?.id ?? item?.place_id),
    title: plainText(item?.title ?? item?.name) || 'Без названия',
    coords: geometryOf(item),
    url: safeUrl(item?.url)
  })).filter(item => Number.isSafeInteger(item.id) && item.id > 0);
}
export function normalizePlace(payload) {
  const item = payload?.place && !Array.isArray(payload.place) ? payload.place : payload;
  const main = item?.main ?? item ?? {};
  const id = Number(item?.id ?? main?.id);
  const photoItems = unwrapCollection(item?.photos);
  const commentItems = unwrapCollection(item?.comments);
  return {
    id,
    title: plainText(main?.title ?? item?.title) || 'Без названия',
    // Content is rendered as plain text, never injected as raw HTML.
    description: plainText(main?.description ?? item?.description),
    url: safeUrl(main?.url ?? item?.url) ?? wikimapiaUrl(id),
    photos: photoItems.map(p => ({
      src: photoUrl(p?.big_url ?? p?.['960_url'] ?? p?.thumbnail_url ?? p?.url_big ?? p?.url_full ?? p?.big ?? p?.fullsize ?? p?.url ?? p?.url_thumb ?? p?.thumb),
      author: plainText(p?.author_name ?? p?.user_name ?? p?.author)
    })).filter(p => p.src),
    comments: commentItems.filter(c => c && ![true,1,'1'].includes(c.is_deleted)).map(c => ({
      author: plainText(c?.author_name ?? c?.user_name ?? c?.name ?? c?.author) || 'Участник Wikimapia',
      text: plainText(c?.text ?? c?.comment ?? c?.message),
      date: commentDate(c?.date)
    })).filter(c => c.text)
  };
}
export function commentDate(value) {
  if (!['number','string'].includes(typeof value) || !String(value).trim()) return null;
  const seconds = Number(value);
  if (!Number.isFinite(seconds) || seconds <= 0 || seconds > Date.now()/1000 + 86400) return null;
  return new Date(seconds * 1000).toISOString();
}
function photoUrl(candidate) {
  const value = safeUrl(candidate);
  if (!value) return null;
  const url = new URL(value);
  if (url.hostname === 'photos.wikimapia.org') url.protocol = 'https:';
  return url.protocol === 'https:' ? url.href : null;
}
export class ApiError extends Error {}
export function validateResponse(result, func, expectedId) {
  if (result?.debug || result?.error || result?.error_message) {
    const detail = result.debug ?? result.error ?? result.error_message;
    const text = typeof detail === 'object' ? String(detail.message ?? detail.code ?? '') : String(detail);
    if (/limit|quota|wait|too many/i.test(text)) throw new ApiError('Исчерпан лимит API. Подождите перед следующим запросом.');
    if (/key|auth|1000/i.test(text)) throw new ApiError('Ключ API отклонён. Проверьте личный ключ.');
    throw new ApiError('Wikimapia API отклонил запрос.');
  }
  if (!result || typeof result !== 'object' || Array.isArray(result)) throw new ApiError('Неподтверждённая структура ответа API (в том числе пустой массив).');
  if (func === 'place.getbyarea' || func === 'box' || func === 'search') {
    if (!Array.isArray(func === 'place.getbyarea' ? result.places : result.folder)) throw new ApiError('Неподтверждённая структура списка объектов API.');
  } else {
    const place = result.place ?? result;
    const id = Number(place.id ?? place.main?.id);
    if (id !== Number(expectedId) || !(place.title ?? place.main?.title)) throw new ApiError('API вернул другой объект или неполные сведения.');
  }
  return result;
}
// Stable, non-sensitive categories for UI, diagnostics and future telemetry.
// Never return raw server messages: Wikimapia may echo query parameters or API keys.
export function classifyApiFailure(error, { offline = false } = {}) {
  if (offline) return 'offline';
  if (error instanceof ValidationError) return 'input';
  const message = String(error?.message ?? error ?? '');
  if (/429|limit|quota|wait|too many|исчерпан лимит/i.test(message)) return 'quota';
  if (/401|403|invalid key|api key|ключ api|ключ.*отклон|1000/i.test(message)) return 'auth';
  if (/неподтверждённая структура|неполные сведения|другой объект|schema|unexpected token|invalid json|json parse|json\.parse|not valid json/i.test(message)) return 'schema';
  if (/abort|timeout|timed out|вовремя/i.test(message)) return 'timeout';
  if (/Failed to fetch|Network request failed|network error|cors|ERR_NAME_NOT_RESOLVED|dns|connection refused|ERR_INTERNET_DISCONNECTED/i.test(message)) return 'network';
  return 'unknown';
}

export function diagnosticError(error) {
  if (error instanceof ApiError || error instanceof ValidationError) return error.message;
  const message = String(error?.message ?? error ?? 'Неизвестная ошибка');
  if (/Failed to fetch|Network request failed|network error|cors|ERR_NAME_NOT_RESOLVED|dns/i.test(message)) return 'Не удалось подключиться к API: проверьте DNS, HTTPS и CORS (для браузера).';
  if (/429|limit|quota|too many/i.test(message)) return 'Вероятно, исчерпан лимит API-запросов. Не повторяйте запросы часто.';
  if (/401|403|invalid key|api key/i.test(message)) return 'Ключ API отклонён или нет доступа к API.';
  if (/abort|timeout/i.test(message)) return 'Сервер не ответил вовремя. Повторите запрос позже.';
  return 'Не удалось загрузить данные. Проверьте подключение и повторите позже.';
}
