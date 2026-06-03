# DeepInception

Платформа для совместного просмотра фильмов с синхронизированным плеером и чатом на основе WebRTC P2P.

🌐 **Рабочая версия:** [deepinception.ru](https://deepinception.ru)

---

## Как это работает

Администратор загружает локальный видеофайл прямо в браузер. Браузер воспроизводит его, захватывает медиапоток, который передаётся напрямую каждому зрителю через WebRTC P2P-соединение. Сервер выступает только как сигнальный посредник — помогает браузерам найти друг друга и обменяться параметрами соединения, после чего полностью исключается из цепочки передачи видео.

---

## Что реализовано

- **P2P-трансляция** — видео передаётся напрямую между браузерами без медиасервера
- **Адаптивное качество** — битрейт, частота кадров и разрешение автоматически снижаются при росте числа зрителей
- **Проверка новых подключений** — перед допуском зрителя система проверяет CPU и FPS, чтобы не перегрузить компьютер администратора
- **Синхронизация плеера** — паузы и воспроизведение мгновенно отражаются у всех зрителей
- **Публичные и приватные комнаты** — с паролями, лимитами зрителей и QR-кодами
- **Восстановление комнаты** — администратор может вернуться в свою комнату по кодовому слову
- **Чат** — текстовый чат с историей, эмодзи и всплывающими уведомлениями в полноэкранном режиме
- **Статистика** — таблица с FPS, битрейтом и CPU-лимитом для каждого зрителя
- **Адаптивный интерфейс** — поддержка мобильных устройств и планшетов

---

## Стек

**Сервер:** Node.js, WebSocket (ws)  
**Клиент:** нативный JavaScript, WebRTC API, WebSocket API  
**Инфраструктура:** HTTPS + WSS (Let's Encrypt), coturn (STUN/TURN)

---

## Запуск у себя

> ⚠️ **Важно:** без собственного STUN/TURN-сервера WebRTC-соединения не будут устанавливаться у пользователей за NAT. Просто запустить `myindex.js` недостаточно.

### 1. Запустить coturn через Docker

Разверните [coturn](https://github.com/coturn/coturn) на своём сервере. Пример через Docker:

```bash
docker run -d \
  --name coturn \
  --network host \
  -v ./turnserver.conf:/etc/coturn/turnserver.conf:ro \
  coturn/coturn:latest
```

Пример `turnserver.conf`:

```
realm=ваш.домен
server-name=turnserver
listening-ip=ВАШ_IP
external-ip=ВАШ_IP
listening-port=3478
user=ВАШ_ЛОГИН:ВАШ_ПАРОЛЬ
lt-cred-mech
fingerprint
min-port=50000
max-port=51000
```

### 2. Заменить STUN/TURN в коде

В файлах `mystream.html` и `myclient.html` найдите конфигурацию ICE-серверов и замените на свои:

```javascript
iceServers: [
    { urls: "stun:ВАШ_IP:3478" },
    { urls: "turn:ВАШ_IP:3478", username: "ВАШ_ЛОГИН", credential: "ВАШ_ПАРОЛЬ" }
]
```

### 3. Настроить SSL 

```javascript
const httpsServer = https.createServer({
    key:  fs.readFileSync('YOUR_PATH_TO_PRIVKEY'),   // путь к приватному ключу
    cert: fs.readFileSync('YOUR_PATH_TO_FULLCHAIN')  // путь к сертификату
```

### 4. Установить зависимости и запустить

```bash
npm install
node myindex.js
```

---

## Структура проекта

```
├── myindex.js                — WebSocket-сервер на Node.js
├── mysignalserverclass.js   — клиентский класс для работы с WebSocket
├── startpage.html           — лобби
├── mystream.html            — страница администратора
├── myclient.html            — страница зрителя
├── lobby.css                — стили лобби
├── styles_admin.css         — стили администратора
├── styles_client.css        — стили зрителя
```
## Источники

При разработке использовались следующие материалы:

**Книги:**
- Salvatore Loreto, Simon Pietro Romano. Real-Time Communication with WebRTC. 

**Научные статьи:**
- Zinah Tareq Nayyef, Sarah Faris Amer, Zena Hussain. Peer to Peer Multimedia Real-Time Communication System based on WebRTC Technology. International Journal of Engineering & Technology (2018).
- Edim Azom Emmanuel, Bakwa Dunka Dirting. A Peer-To-Peer Architecture For Real-Time Communication Using WebRTC. Journal of Multidisciplinary Engineering Science Studies (JMESS),  April 2017.

**Статьи и публикации:**
- [Using WebRTC to implement P2P video streaming — DEV Community](https://dev.to/logrocket/using-webrtc-to-implement-p2p-video-streaming-5f5g) 
- [Как работает JS: WebRTC и механизмы P2P-коммуникаций — Хабр](https://habr.com/ru/companies/ruvds/articles/416821/) 
- [На пальцах про WebRTC на примере своего мессенджера — Хабр](https://habr.com/ru/articles/902084/) 
