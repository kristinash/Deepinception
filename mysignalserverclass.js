class SignalServer {
    constructor(channel, role, roomType, desc, pass, idCreate, maxViewers, viewerName) {
       this.socket = new WebSocket(`wss://${location.hostname}/`);
        const id = Math.random().toString(36).substring(2);
        
        this.socket.addEventListener("open", () => { 
            this.postMessage({
                type: "join-channel",
                channel,
                id,
                role,
                roomType,
                desc,
                pass,
                idCreate,
                maxViewers: maxViewers || null,
                   name: viewerName
            });
        });
        
        this.socket.addEventListener("message", e => {
            const obj = JSON.parse(e.data);
            if (obj.type === "connection-established") {
                console.log("connection-established");
            } else {
                this.onmessage({ data: obj });
            }
        });
         this.socket.addEventListener("close", (e) => {
            this.onclose(e);
        });

        this.socket.addEventListener("error", (e) => {
            this.onerror(e);
        });
      
    }

    onmessage(e) {}
    onclose(e) {}   
    onerror(e) {}   
    
    
    postMessage(data) {
        if (this.socket && this.socket.readyState === WebSocket.OPEN) {
        this.socket.send(JSON.stringify(data));
    }
    }
}