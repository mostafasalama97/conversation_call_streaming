// src/context/SocketContext.tsx
import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { io, Socket } from 'socket.io-client';

interface SocketContextProps {
  socket: Socket | null;
}

const SocketContext = createContext<SocketContextProps>({ socket: null });

export const useSocket = () => useContext(SocketContext);

interface SocketProviderProps {
  children: ReactNode;
}

export const SocketProvider: React.FC<SocketProviderProps> = ({ children }) => {
  const [socket, setSocket] = useState<Socket | null>(null);

  useEffect(() => {
    const backendURL = 'http://localhost:4000';
    console.log(`Connecting to Socket.IO server at: ${backendURL}`);

    const newSocket = io(backendURL, {
      transports: ['websocket'],
      secure: false,
    });

    setSocket(newSocket);
    console.log(`Socket instance created with ID: ${newSocket.id}`);

    newSocket.on('connect', () => {
      console.log(`Socket connected with ID: ${newSocket.id}`);
    });

    newSocket.on('disconnect', (reason) => {
      console.log(`Socket disconnected. Reason: ${reason}`);
    });

    newSocket.on('connect_error', (error) => {
      console.error(`Socket connection error: ${error.message}`);
    });

    newSocket.on('error', (error) => {
      console.error('Socket error:', error.message || JSON.stringify(error));
    });

    return () => {
      if (newSocket) {
        console.log(`Disconnecting socket with ID: ${newSocket.id}`);
        newSocket.disconnect();
      }
    };
  }, []);

  return <SocketContext.Provider value={{ socket }}>{children}</SocketContext.Provider>;
};

























// import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
// import { io, Socket } from 'socket.io-client';

// interface SocketContextProps {
//   socket: Socket | null;
// }

// const SocketContext = createContext<SocketContextProps>({ socket: null });

// export const useSocket = () => useContext(SocketContext);

// interface SocketProviderProps {
//   children: ReactNode;
// }

// export const SocketProvider: React.FC<SocketProviderProps> = ({ children }) => {
//   const [socket, setSocket] = useState<Socket | null>(null);

//   useEffect(() => {
//     const backendURL = 'http://localhost:4000';
//     console.log(`Connecting to Socket.IO server at: ${backendURL}`);

//     const newSocket = io(backendURL, {
//       transports: ['websocket'],
//       secure: false,
//     });

//     setSocket(newSocket);
//     console.log(`Socket instance created with ID: ${newSocket.id}`);

//     newSocket.on('connect', () => {
//       console.log(`Socket connected with ID: ${newSocket.id}`);
//     });

//     newSocket.on('disconnect', (reason) => {
//       console.log(`Socket disconnected. Reason: ${reason}`);
//     });

//     newSocket.on('connect_error', (error) => {
//       console.error(`Socket connection error: ${error.message}`);
//     });

//     newSocket.on('error', (error) => {
//       console.error(`Socket error: ${error}`);
//     });

//     return () => {
//       if (newSocket) {
//         console.log(`Disconnecting socket with ID: ${newSocket.id}`);
//         newSocket.disconnect();
//       }
//     };
//   }, []);

//   return <SocketContext.Provider value={{ socket }}>{children}</SocketContext.Provider>;
// };
