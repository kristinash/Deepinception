const { WebSocketServer } = require("ws");
const https = require("https");
const http = require("http");
const fs = require("fs");
const httpsServer = https.createServer({
    // Укажите пути к вашим SSL-сертификатам
     key:  fs.readFileSync('YOUR_PATH_TO_PRIVKEY'),   // путь к приватному ключу
    cert: fs.readFileSync('YOUR_PATH_TO_FULLCHAIN')  // путь к сертификату
}, function(request, response) {
    let filePath = request.url.substring(1).split('?')[0];
    if (filePath === '') filePath = 'startpage.html';
    const ext = filePath.split(".").pop();
    const types = {
        'html': 'text/html',
        'css': 'text/css',
        'js': 'application/javascript',
        'json': 'application/json',
        'png': 'image/png',
        'jpg': 'image/jpeg',
    };
    let contentType = types[ext] || "text/plain";
    fs.readFile(filePath, function(error, data) {
        if (error) {
            response.writeHead(404);
            response.end("Resource not found!");
        } else {
            response.writeHead(200, { 'Content-Type': contentType });
            response.end(data, 'utf-8');
        }
    });
});

httpsServer.listen(443, function() {
    console.log("Server started at 443");
});

http.createServer((req, res) => {
    res.writeHead(301, { Location: 'https://' + req.headers.host + req.url })
    res.end()
}).listen(80)

const channels = {};
const roomsList = {};
const chatHistory = {};
const adminTimeouts = {};
const server = new WebSocketServer({ server: httpsServer });

setInterval(() => {
    server.clients.forEach(ws => {
        if (ws.isAlive === false) {
            ws.terminate(); 
            return;
        }
        ws.isAlive = false;
        ws.ping();
      
    });
}, 10000);


server.on("connection", handleConnection);

function handleConnection(ws) {
     ws.isAlive = true;
    ws.on('pong', () => { ws.isAlive = true; });

    console.log('New connection');
    ws.send(JSON.stringify({ type: 'connection-established' }));
    
    let channel = "";

    ws.on('message', message => {
        const object = JSON.parse(message);
        const roomsData = Object.entries(roomsList).map(([id, { secret, password, ...safeData }]) => ({
            id,
            ...safeData
        }));
        
        if (object.type === "get-rooms") {
            ws.send(JSON.stringify({
                type: 'rooms-list',
                rooms: roomsData
            }));
            return;
        }
        
        if (object.type === "join-channel") {
            channel = object.channel;
            ws.id = object.id;
            ws.role = object.role;
            console.log(object.type + ws.role + " " + ws.id);
            
            if (channels[channel] === undefined) channels[channel] = [];
            
            if (ws.role === 'admin') {
                if (adminTimeouts[channel]) {
                    clearTimeout(adminTimeouts[channel]);
                    delete adminTimeouts[channel];
                }
                if (channels[channel].some(m => m.role === 'admin')) {
                    channel = '';
                    ws.role = '';
                    return ws.send(JSON.stringify({ type: 'error-admin-exists' }));
                }
                
                if (!chatHistory[channel]) chatHistory[channel] = [];
                
                if (!roomsList[channel]) {
                    roomsList[channel] = {
                        id: object.channel,
                        type: object.roomType,
                        desc: object.desc || '',
                        password: object.pass,
                        viewers: 0,
                        secret: object.idCreate,
                        adminOnline: true,
                         maxViewers: object.maxViewers,
                         allnames : {}
                    };
                    broadcastRooms();
                } else {
                     if (roomsList[channel].secret !== object.idCreate) {
                        channel = '';
                        ws.role = '';
                        return ws.send(JSON.stringify({ type: 'error-wrong-secret' }));
                    }
                    roomsList[channel].adminOnline = true;
                    broadcastRooms();
                }
            }
            
            if (ws.role === 'viewer') {
            
                if (!roomsList[channel]) {
        return ws.send(JSON.stringify({ type: 'error-no-admin' }));
    }
    if (!roomsList[channel].adminOnline) {
         ws.isRejected = true; 
        return ws.send(JSON.stringify({ type: 'error-admin-yet-not-here' }));
    }
                if (roomsList[channel].type === 'private') {
                    if (roomsList[channel].password !== object.pass) {
                         ws.isRejected = true;    
                        return ws.send(JSON.stringify({ type: 'error-wrong-password' }));
                    }
                }
                 
    if (roomsList[channel].maxViewers!==null && roomsList[channel].viewers >= roomsList[channel].maxViewers) {
        //  ws.isRejected = true;
         ws.isRejected = true;    
        ws.send(JSON.stringify({ type: 'room-full', message: 'лимит комнаты' }));
        setTimeout(() => ws.terminate(), 500);
        return;
    }
   const nameTaken = Object.values(roomsList[channel].allnames).filter(n => n !== null)
    .some(n => n && n.toLowerCase() === object.name.toLowerCase());
if (nameTaken) {
    ws.isRejected = true;
    return ws.send(JSON.stringify({ type: 'error-duplicate-name' }));
}
else  {
     ws.send(JSON.stringify({ type: 'name-ok', name: object.name }));
}


                ws.name = object.name;
                roomsList[channel].allnames[object.id] = object.name;
               
                roomsList[channel].viewers += 1;
                broadcastRooms();
                
            }
            
            channels[channel].push(ws);
            const history = chatHistory[channel] || [];
            ws.send(JSON.stringify({ type: 'chat-history', messages: history }));
            
            const admin = channels[channel]?.find((member) => member.role === "admin");
            
            if (admin && ws.role !== "admin") {
                admin.send(JSON.stringify({
                    type: 'joined-channel',
                    role: ws.role,
                    id: ws.id,
                    name: ws.name, 
                    viewers: roomsList[channel].viewers 
                }));
                
             
            }
            
            if (admin && ws.role === "admin") {
                
                for (let member of channels[channel]) {
                    member.send(JSON.stringify({
                        type: 'admin_again_here',
                        viewerscount: channels[channel]?.filter(m => m.role === 'viewer').length,
                        allnames: roomsList[channel].allnames
                    }));
                }
            }
        }
        
        else if (object.type === "pause") {
            channel = object.roomId;
            const all = channels[channel]?.filter((member) => member.role !== "admin");
            all.forEach(client => client.send(JSON.stringify({ type: 'pause' })));
        }
        
        
        else if (object.type === "post-message") {
            channel = object.roomId;
            chatHistory[channel].push({ name: object.name, text: object.message });
            channels[channel]?.forEach(client => client.send(JSON.stringify({
                type: 'receive-message',
                name: object.name,
                message: object.message
            })));
        }
        
        else if (object.type === "play") {
            channel = object.roomId;
            const all = channels[channel]?.filter((member) => member.role !== "admin");
            all.forEach(client => client.send(JSON.stringify({ type: 'play' })));
        }
        else if (object.type === "force-leave") {
            channel = object.roomId;
            const client = channels[channel]?.find((member) => member.id === object.id);
              if (client && client.readyState === 1) {   client.send(JSON.stringify({ type: 'force-leave' }))
            client.terminate();}
         
           
        }
        
        else if (object.type === "videostate") {
            channel = object.roomId;
            const state = object.state;
            const member = channels[channel]?.find((member) => member.id === object.id);
            if (member?.readyState === 1) {
        member.send(JSON.stringify({ type: 'videostate', state }));
    }
        }
        
        else if (object.type === "restore-room") {
            channel = object.channel;
            const secret = object.secret;
            if (roomsList[channel].secret === secret) {
                ws.send(JSON.stringify({ type: 'restore-success' }));
            } else {
                ws.send(JSON.stringify({ type: 'restore-failed' }));
            }
        }
        
        else if (object.type === "check-parol") {
            channel = object.channel;
            const pass = object.password;
            
            if (roomsList[channel].password === pass) {
                ws.send(JSON.stringify({ type: 'parol-true' }));
            } else {
                ws.send(JSON.stringify({ type: 'parol-false' }));
            }
        }
        

else if (object.type === "probe-passed") {
    channel = object.roomId;
    const client = channels[channel]?.find(m => m.id === object.id);
    if (!client) return 
    client.send(JSON.stringify({ type: 'probe-passed' }));
}
else if (object.type === "checking") {
    channel = object.roomId;
    const client = channels[channel]?.find(m => m.id === object.id);
    if (!client || client.readyState !== 1) return;
     client.send(JSON.stringify({ type: 'checking', seconds: object.seconds }));
}

else if (object.type === "room-full") {
    channel = object.roomId;
    const client = channels[channel]?.find(m => m.id === object.id);
    if (!client || client.readyState !== 1) return;
    client.send(JSON.stringify({ type: 'room-full', message: object.message }));
      setTimeout(() => client.terminate(), 500);
}
        
        else if (object.type === "new-file") {
            channel = object.roomId;
            const admin = channels[channel]?.find((member) => member.role === "admin");
            
            if (channels[channel]) {
                for (let member of channels[channel]) {
                    if (member.role !== "admin") {
                        if (admin) {
                            admin.send(JSON.stringify({
                                type: 'joined-channel',
                                id: member.id,
                                viewers: roomsList[channel].viewers
                            }));
                        }
                    }
                }
            }
        } else {
            channels[channel]?.find((member) => member.id === object.id)?.send(JSON.stringify({ ...object, id: ws.id }));
        }
    });
    
    function broadcastRooms() {
        server.clients.forEach(client => {
            if (client.readyState === 1) {
                const roomsData = Object.entries(roomsList).map(([id, data]) => {
                    const { secret, password, ...safeData } = data;
                    return { id, ...safeData };
                });
                client.send(JSON.stringify({ type: 'rooms-list', rooms: roomsData }));
            }
        });
    }
    ws.on('error', (err) => {
        console.error('WebSocket error:', err);
        ws.terminate(); 
    });
    
    ws.on('close', () => {
        console.log('Client has disconnected!');
       
        if (channel !== "") {
            if (ws.role === 'admin' && roomsList[channel]) {
                roomsList[channel].adminOnline = false;
                channels[channel]?.forEach(m => m.send(JSON.stringify({ type: 'error-leave-admin' })));
                broadcastRooms();
                
                adminTimeouts[channel] = setTimeout(() => {
                    channels[channel]?.forEach(m => m.send(JSON.stringify({ type: 'admin-left-always' })));
                    delete channels[channel];
                    delete chatHistory[channel];
                    delete roomsList[channel];
                    delete adminTimeouts[channel];
                    broadcastRooms();
                }, 5 * 60 * 1000);
            }
            
            else if (ws.role === 'viewer' && roomsList[channel]) {
              
             if (!ws.isRejected) { 
               
       if (roomsList[channel]) {
                roomsList[channel].viewers = Math.max(0, roomsList[channel].viewers - 1);
                 if (roomsList[channel] && roomsList[channel].allnames && roomsList[channel].allnames[ws.id]) {
                delete roomsList[channel].allnames[ws.id];
                
            }
                broadcastRooms();
            }
        }
           
      
            }
              
            
            channels[channel] = channels[channel]?.filter((member) => member.id !== ws.id);
            
            
            if (channels[channel]?.length === 0) {
                if (adminTimeouts[channel]) {
                    clearTimeout(adminTimeouts[channel]);
                    delete adminTimeouts[channel];
                }
                delete channels[channel];
                delete chatHistory[channel];
                delete roomsList[channel];
                broadcastRooms();
            }
            
            const admin = channels[channel]?.find((member) => member.role === "admin");
            if (ws.role !== 'admin' && admin) {
                admin.send(JSON.stringify({
                    role: ws.role,
                    type: 'leave-channel',
                     viewers: roomsList[channel].viewers,
                    id: ws.id
                }));
            }
        }
    });
}