const WebSocket = require('ws');

const PORT = process.env.PORT || 5001;
const wss = new WebSocket.Server({ port: PORT });
const rooms = {}; // { roomId: [clients] }

wss.on('connection', (ws) => {
    ws.on('message', (message) => {
        try {
            const parsedMessage = JSON.parse(message);
            const { type, roomId, text, userId } = parsedMessage;

            if (type === 'join') {
                if (!rooms[roomId]) {
                    rooms[roomId] = [];
                }

                // Attach userId and roomId to the WebSocket instance
                ws.roomId = roomId;
                ws.userId = userId;
                rooms[roomId].push(ws);

                console.log(`User ${userId} joined room: ${roomId}`);
            } else if (type === 'message') {
                const clients = rooms[ws.roomId];
                if (clients) {
                    clients.forEach((client) => {
                        if (client.readyState === WebSocket.OPEN) {
                            // Include userId in the broadcasted message
                            client.send(JSON.stringify({
                                type: 'message',
                                text,
                                userId: ws.userId,
                                roomId: ws.roomId
                            }));
                        }
                    });
                }
            }
        } catch (error) {
            console.error('Failed to process message:', message, error);
        }
    });

    ws.on('close', () => {
        const roomId = ws.roomId;
        if (roomId) {
            // Remove the WebSocket instance from the room
            rooms[roomId] = rooms[roomId]?.filter((client) => client !== ws);

            // Clean up the room if it's empty
            if (rooms[roomId]?.length === 0) {
                delete rooms[roomId];
            }
        }
    });
});

console.log(`WebSocket server is running on port ${PORT}`);
