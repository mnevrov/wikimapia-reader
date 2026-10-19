// Stable, redacted diagnostics for a user-owned Yandex JS API key.
// Raw exceptions and request URLs must never be shown or copied: they can contain the key.
const messages={
 'not-selected':['Яндекс выключен','Выберите «Яндекс Карты» в настройках.'],
 'missing-or-invalid-key':['Ключ JS API не задан или неверного формата','Проверьте ключ продукта JavaScript API.'],
 'referer-not-confirmed':['Настройка Referer не подтверждена','Укажите допустимый домен в кабинете Яндекса.'],
 'license-not-confirmed':['Не подтверждены условия подключения','Проверьте условия бесплатного использования.'],
 'reload-required':['Изменён ключ в текущем WebView','Закройте WikiReader через системные настройки и запустите снова.'],
 'retry-cooldown':['Временная пауза после неудачной попытки','Повторите подключение позже. Не нажимайте кнопку многократно.'],
 'script-load-error':['Не удалось загрузить файл JavaScript API','Проверьте доступ к api-maps.yandex.ru без VPN и с VPN. Возможны DNS, блокировка или отклонение запроса.'],
 'script-timeout':['Истекло время ожидания JavaScript API','Сеть или сервер не ответили за 14 секунд. Проверьте соединение.'],
 'sdk-global-missing':['SDK загрузился, но объект ymaps3 отсутствует','Ответ мог быть неполным или содержать ошибку вместо JavaScript API.'],
 'sdk-ready-error':['JavaScript API не завершил инициализацию','SDK загрузился, но отклонил инициализацию. Проверьте работу в Android WebView.'],
 'sdk-map-error':['Ошибка создания карты после загрузки SDK','SDK загружен, но не смог создать карту или её слой в Android WebView.'],
 'sdk-style-error':['Ошибка обновления цветовой схемы','Проверьте версию Android System WebView.'],
 'map-host-missing':['Контейнер карты не найден','Повторно откройте экран карты.'],
 'webview-required':['Нет браузерной среды','Карта Яндекса доступна только в WebView или браузере.'],
 'sdk-unavailable':['Неизвестная ошибка JavaScript API','Подробности не удалось определить; проверьте сеть и перезапустите приложение.']
};
export function yandexErrorInfo(code,{origin='',online=true,previous='',retrySeconds=0}={}){
 const id=Object.hasOwn(messages,code)?code:'sdk-unavailable';
 const [title,help]=messages[id];
 return {code:id,title,help,origin:String(origin||'не определён').slice(0,128),online:online!==false,previous:Object.hasOwn(messages,previous)?previous:'',retrySeconds:Math.max(0,Math.min(60,Math.ceil(Number(retrySeconds)||0)))};
}
export function yandexDiagnosticReport(info){
 if(!info)return '';
 const origin=String(info.origin||'не определён');
 const lines=['WikiReader Next / Yandex JS API','Код: '+info.code,'Источник WebView: '+origin,'Соединение (по Android): '+(info.online?'online':'offline')];
 if(info.previous)lines.push('Предыдущая ошибка: '+info.previous);
 if(info.retrySeconds)lines.push('Повтор через: '+info.retrySeconds+' с');
 lines.push('Ключ и URL запросов намеренно не включены.');
 return lines.join('\n');
}
