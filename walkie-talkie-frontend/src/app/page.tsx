// src/app/page.tsx
'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useSocket } from '@/context/SocketContext';
import Peer, { Instance as PeerInstance } from 'simple-peer';

interface PeerConnection {
  peer: PeerInstance;
  stream: MediaStream;
}

const Home: React.FC = () => {
  const { socket } = useSocket();
  const [room, setRoom] = useState<string>('');
  const [joined, setJoined] = useState<boolean>(false);
  const [micActive, setMicActive] = useState<boolean>(false);
  const [isSpeaking, setIsSpeaking] = useState<boolean>(false);
  const [speakingUsers, setSpeakingUsers] = useState<{ [key: string]: boolean }>({});
  const [peers, setPeers] = useState<{ [key: string]: PeerConnection }>({});
  const userStream = useRef<MediaStream | null>(null);
  const peersRef = useRef<{ [key: string]: PeerInstance }>({});

  useEffect(() => {
    if (!socket) return;

    console.log('Attaching socket event listeners.');

    // Listen for connection event to get the local socket ID
    socket.on('connect', () => {
      console.log(`Connected with socket ID: ${socket.id}`);
    });

    socket.on('signal', ({ from, signal }) => {
      console.log(`Received signal from: ${from}`, signal);

      if (!peersRef.current[from]) {
        console.log(`Creating new peer for ${from}`);
        const peer = createPeer(false, from);
        peersRef.current[from] = peer;
      }
      peersRef.current[from]?.signal(signal);
    });

    socket.on('user-joined', ({ socketId }) => {
      console.log(`User joined: ${socketId}`);
      if (!peersRef.current[socketId]) {
        const peer = createPeer(true, socketId);
        peersRef.current[socketId] = peer;
      }
    });

    socket.on('user-left', ({ socketId }) => {
      console.log(`User left: ${socketId}`);
      if (peersRef.current[socketId]) {
        peersRef.current[socketId].destroy();
        delete peersRef.current[socketId];
        setPeers((prev) => {
          const updated = { ...prev };
          delete updated[socketId];
          return updated;
        });
      }

      // Remove from speaking users if necessary
      setSpeakingUsers((prev) => {
        const updated = { ...prev };
        delete updated[socketId];
        return updated;
      });
    });

    socket.on('speaking-status', ({ socketId, isSpeaking }) => {
      console.log(`${socketId} is now ${isSpeaking ? 'speaking' : 'listening'}`);
      setSpeakingUsers((prev) => ({ ...prev, [socketId]: isSpeaking }));
    });

    return () => {
      console.log('Detaching socket event listeners.');
      socket.off('connect');
      socket.off('signal');
      socket.off('user-joined');
      socket.off('user-left');
      socket.off('speaking-status');
    };
  }, [socket]);

  const createPeer = (initiator: boolean, socketId: string): PeerInstance => {
    const peer = new Peer({
      initiator,
      trickle: false,
      stream: userStream.current || undefined,
    });

    peer.on('signal', (signal) => {
      console.log(`Sending signal to ${socketId}`, signal);
      socket?.emit('signal', { to: socketId, signal });
    });

    peer.on('stream', (stream) => {
      console.log(`Received stream from ${socketId}`);
      addAudioStream(socketId, stream);
    });

    peer.on('close', () => {
      console.log(`Peer connection with ${socketId} closed.`);
      delete peersRef.current[socketId];
      setPeers((prev) => {
        const updated = { ...prev };
        delete updated[socketId];
        return updated;
      });

      // Remove from speaking users if necessary
      setSpeakingUsers((prev) => {
        const updated = { ...prev };
        delete updated[socketId];
        return updated;
      });
    });

    setPeers((prev) => ({
      ...prev,
      [socketId]: { peer, stream: userStream.current as MediaStream },
    }));

    return peer;
  };

  const addAudioStream = (socketId: string, stream: MediaStream) => {
    console.log(`Adding audio stream for ${socketId}`);
    let audio = document.getElementById(`audio-${socketId}`) as HTMLAudioElement;

    if (!audio) {
      audio = document.createElement('audio');
      audio.id = `audio-${socketId}`;
      audio.autoplay = true;
      audio.controls = false;
      document.body.appendChild(audio);
    }

    audio.srcObject = stream;
  };

  const joinRoom = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      userStream.current = stream;
      console.log('User media stream acquired.');
      socket?.emit('join-room', { room });
      console.log(`Joined room: ${room}`);
      setJoined(true);
    } catch (err) {
      console.error('Error accessing microphone:', err);
      alert('Could not access your microphone. Please check permissions.');
    }
  };

  const leaveRoom = () => {
    console.log('Leaving room:', room);
    socket?.emit('leave-room', { room });
    setJoined(false);
    setIsSpeaking(false);
    emitSpeakingStatus(false); // Update speaking status

    Object.keys(peersRef.current).forEach((socketId) => {
      peersRef.current[socketId].destroy();
    });
    peersRef.current = {};
    setPeers({});
    setSpeakingUsers({});

    // Remove all audio elements except user's own
    document.querySelectorAll('audio[id^="audio-"]').forEach((audio) => audio.remove());
  };

  const toggleMic = () => {
    if (!room) {
      console.error('Room is not defined.');
      return;
    }

    const newMicState = !micActive;
    userStream.current?.getAudioTracks().forEach((track) => {
      track.enabled = newMicState;
    });
    setMicActive(newMicState);
    setIsSpeaking(newMicState);
    emitSpeakingStatus(newMicState);

    // Log the speaking status in the local browser
    if (newMicState) {
      console.log('You are now speaking');
    } else {
      console.log('You are now listening');
    }
  };

  const emitSpeakingStatus = (status: boolean) => {
    socket?.emit(status ? 'start-speaking' : 'stop-speaking', { room });
  };

  return (
    <div style={{ padding: '20px' }}>
      {!joined ? (
        <div>
          <h2>Join a Voice Chat Room</h2>
          <input
            type="text"
            value={room}
            onChange={(e) => setRoom(e.target.value)}
            placeholder="Enter Room ID"
            style={{ padding: '8px', width: '200px' }}
          />
          <button onClick={joinRoom} style={{ padding: '8px 16px', marginLeft: '10px' }}>
            Join
          </button>
        </div>
      ) : (
        <div>
          <h2>Connected to Room: {room}</h2>
          <button onClick={leaveRoom} style={{ padding: '8px 16px', marginRight: '10px' }}>
            Leave Room
          </button>
          <button
            onClick={toggleMic}
            style={{
              padding: '8px 16px',
              backgroundColor: micActive ? 'green' : 'red',
              color: 'white',
            }}
          >
            {micActive ? 'Mic On' : 'Mic Off'}
          </button>
          <div style={{ marginTop: '20px' }}>
            <h3>Users in Room:</h3>
            <ul>
              {Object.keys(peers).map((socketId) => (
                <li key={socketId}>
                  {socketId}
                  {speakingUsers[socketId] ? ' 🎤 Speaking' : ' 💤 Listening'}
                </li>
              ))}
              {/* Optionally, include the current user */}
              <li>
                You {isSpeaking ? ' 🎤 Speaking' : ' 💤 Listening'}
              </li>
            </ul>
          </div>
        </div>
      )}
    </div>
  );
};

export default Home;






















// // src/app/page.tsx
// 'use client';

// import React, { useState, useRef, useEffect } from 'react';
// import { useSocket } from '@/context/SocketContext';
// import Peer, { Instance as PeerInstance } from 'simple-peer';

// interface PeerConnection {
//   peer: PeerInstance;
//   stream: MediaStream;
// }

// const Home: React.FC = () => {
//   const { socket } = useSocket();
//   const [room, setRoom] = useState<string>('');
//   const [joined, setJoined] = useState<boolean>(false);
//   const [micActive, setMicActive] = useState<boolean>(false);
//   const [isSpeaking, setIsSpeaking] = useState<boolean>(false); // Flag to track speaking state
//   const [peers, setPeers] = useState<{ [key: string]: PeerConnection }>({});
//   const userStream = useRef<MediaStream | null>(null);
//   const peersRef = useRef<{ [key: string]: PeerInstance }>({});

//   useEffect(() => {
//     if (!socket) return;

//     console.log('Attaching socket event listeners.');

//     socket.on('signal', ({ from, signal }) => {
//       console.log(`Received 'signal' from ${from}`);

//       // If no peer exists for the sender, create one
//       if (!peersRef.current[from]) {
//         console.log(`Creating peer for ${from} (not an initiator).`);

//         const peer = new Peer({
//           initiator: false, // Not the initiator for this peer
//           trickle: false,
//           stream: userStream.current || undefined,
//           config: {
//             iceServers: [
//               { urls: process.env.NEXT_PUBLIC_STUN_SERVER || 'stun:stun.l.google.com:19302' },
//               {
//                 urls: process.env.NEXT_PUBLIC_TURN_SERVER || 'turn:your-turn-server.com',
//                 username: process.env.NEXT_PUBLIC_TURN_USERNAME || 'user',
//                 credential: process.env.NEXT_PUBLIC_TURN_PASSWORD || 'pass',
//               },
//             ],
//           },
//         });

//         peer.on('signal', (newSignal) => {
//           console.log(`Sending 'signal' to ${from}`);
//           socket.emit('signal', { to: from, signal: newSignal });
//         });

//         peer.on('stream', (stream) => {
//           console.log(`Received stream from ${from}`);
//           addAudioStream(from, stream);
//         });

//         peer.on('close', () => {
//           console.log(`Peer connection with ${from} closed.`);
//           delete peersRef.current[from];
//           setPeers((prevPeers) => {
//             const updatedPeers = { ...prevPeers };
//             delete updatedPeers[from];
//             return updatedPeers;
//           });
//         });

//         peer.on('error', (err) => {
//           console.error(`Peer error with ${from}:`, err);
//         });

//         peersRef.current[from] = peer;
//         setPeers((prevPeers) => ({
//           ...prevPeers,
//           [from]: { peer, stream: userStream.current as MediaStream },
//         }));

//         console.log(`Peer connection with ${from} established.`);
//       }

//       // Pass the signal to the peer
//       peersRef.current[from].signal(signal);
//     });

//     socket.on('user-joined', ({ socketId }) => {
//       console.log(`User joined: ${socketId}`);
//       initiatePeer(socketId, true);
//     });

//     socket.on('user-left', ({ socketId }) => {
//       console.log(`User left: ${socketId}`);
//       if (peersRef.current[socketId]) {
//         peersRef.current[socketId].destroy();
//         delete peersRef.current[socketId];
//         setPeers((prevPeers) => {
//           const updatedPeers = { ...prevPeers };
//           delete updatedPeers[socketId];
//           return updatedPeers;
//         });
//         console.log(`Peer connection with ${socketId} destroyed.`);
//       } else {
//         console.warn(`No peer found with socket ID: ${socketId}`);
//       }
//     });

//     return () => {
//       console.log('Detaching socket event listeners.');
//       socket.off('signal');
//       socket.off('user-joined');
//       socket.off('user-left');
//     };
//   }, [socket]);

//   const initiatePeer = (socketId: string, initiator: boolean) => {
//     if (!userStream.current) {
//       console.error('User media stream is not available.');
//       return;
//     }

//     console.log(`Initiating peer connection with ${socketId}, initiator: ${initiator}`);

//     const peer = new Peer({
//       initiator,
//       trickle: false,
//       stream: userStream.current,
//       config: {
//         iceServers: [
//           { urls: process.env.NEXT_PUBLIC_STUN_SERVER || 'stun:stun.l.google.com:19302' },
//           {
//             urls: process.env.NEXT_PUBLIC_TURN_SERVER || 'turn:your-turn-server.com',
//             username: process.env.NEXT_PUBLIC_TURN_USERNAME || 'user',
//             credential: process.env.NEXT_PUBLIC_TURN_PASSWORD || 'pass',
//           },
//         ],
//       },
//     });

//     peer.on('signal', (signal) => {
//       console.log(`Sending 'signal' to ${socketId}`);
//       socket?.emit('signal', { to: socketId, signal });
//     });

//     peer.on('stream', (stream) => {
//       console.log(`Received stream from ${socketId}`);
//       addAudioStream(socketId, stream);
//     });

//     peer.on('close', () => {
//       console.log(`Peer connection with ${socketId} closed.`);
//       delete peersRef.current[socketId];
//       setPeers((prevPeers) => {
//         const updatedPeers = { ...prevPeers };
//         delete updatedPeers[socketId];
//         return updatedPeers;
//       });
//     });

//     peer.on('error', (err) => {
//       console.error(`Peer error with ${socketId}:`, err);
//     });

//     peersRef.current[socketId] = peer;
//     setPeers((prevPeers) => ({
//       ...prevPeers,
//       [socketId]: { peer, stream: userStream.current as MediaStream },
//     }));

//     console.log(`Peer connection with ${socketId} established.`);
//   };

//   const addAudioStream = (socketId: string, stream: MediaStream) => {
//     console.log(`Adding audio stream for ${socketId}`);
//     const audio = document.createElement('audio');
//     audio.srcObject = stream;
//     audio.autoplay = true;
//     audio.controls = false;
//     audio.id = `audio-${socketId}`;
//     document.body.appendChild(audio);

//     audio.onplay = () => console.log(`Audio for ${socketId} is playing.`);
//     audio.onerror = (err) => console.error(`Error with audio for ${socketId}:`, err);

//     console.log(`Audio element added for ${socketId}`);
//   };

//   const joinRoom = async () => {
//     if (!room) {
//       console.warn('Room ID is empty.');
//       return;
//     }

//     console.log(`Attempting to join room: ${room}`);

//     try {
//       const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
//       userStream.current = stream;
//       console.log('User media stream acquired.');

//       socket?.emit('join-room', { room });
//       console.log(`'join-room' event emitted for room: ${room}`);
//       setJoined(true);
//     } catch (err) {
//       console.error('Failed to get user media:', err);
//       alert('Could not access your microphone. Please check permissions.');
//     }
//   };

//   const leaveRoom = () => {
//     if (!room) {
//       console.warn('Room ID is empty.');
//       return;
//     }

//     console.log(`Leaving room: ${room}`);
//     socket?.emit('leave-room', { room });
//     console.log(`'leave-room' event emitted for room: ${room}`);
//     setJoined(false);

//     if (userStream.current) {
//       console.log('Stopping user media streams.');
//       userStream.current.getTracks().forEach((track) => track.stop());
//       userStream.current = null;
//     }

//     Object.keys(peersRef.current).forEach((socketId) => {
//       console.log(`Destroying peer connection with ${socketId}`);
//       peersRef.current[socketId].destroy();
//     });
//     peersRef.current = {};
//     setPeers({});

//     const audios = document.querySelectorAll('audio[id^="audio-"]');
//     audios.forEach((audio) => {
//       console.log(`Removing audio element: ${audio.id}`);
//       audio.remove();
//     });
//     console.log('All audio elements removed.');
//   };

//   const toggleMic = () => {
//     if (!userStream.current) {
//       console.error('User media stream is not available.');
//       return;
//     }

//     userStream.current.getAudioTracks().forEach((track) => {
//       track.enabled = !micActive;
//     });
//     setMicActive(!micActive);
//     setIsSpeaking(!micActive); // Update the speaking flag
//     console.log(`Microphone is now ${micActive ? 'off' : 'on'}.`);

//     if (!micActive) {
//       console.log('You are now speaking.');
//     } else {
//       console.log('You are now listening.');
//     }
//   };
//   return (
//     <div className="flex flex-col items-center justify-center min-h-screen bg-gray-100 p-4">
//       {!joined ? (
//         <div className="bg-white p-8 rounded shadow-md w-full max-w-md">
//           <h1 className="text-2xl font-bold mb-4 text-center">Join a Walkie-Talkie Room</h1>
//           <input
//             type="text"
//             placeholder="Enter Room ID"
//             value={room}
//             onChange={(e) => {
//               setRoom(e.target.value);
//               console.log(`Room ID updated to: ${e.target.value}`);
//             }}
//             className="w-full p-3 border border-gray-300 rounded mb-4 focus:outline-none focus:ring-2 focus:ring-blue-500"
//           />
//           <button
//             onClick={joinRoom}
//             className="w-full bg-blue-500 text-white py-2 rounded hover:bg-blue-600 transition duration-200"
//           >
//             Join
//           </button>
//         </div>
//       ) : (
//         <div className="bg-white p-8 rounded shadow-md w-full max-w-md text-center">
//           <h1 className="text-2xl font-bold mb-4">Connected to Room: {room}</h1>
//           <p className="mb-6">Speak into your microphone to communicate in real-time.</p>
//           <button
//             onClick={leaveRoom}
//             className="w-full bg-red-500 text-white py-2 rounded hover:bg-red-600 transition duration-200"
//           >
//             Leave Room
//           </button>
//           <button
//             onMouseDown={toggleMic}
//             onMouseUp={toggleMic}
//             className={`w-full ${
//   micActive ? 'bg-green-500' : 'bg-gray-500'
// } text-white py-2 rounded hover:bg-green-600 transition duration-200 mt-4`}
//           >
//             {micActive ? 'Mic On' : 'Mic Off'}
//           </button>
//         </div>
//       )}
//     </div>
//   );
// };

// export default Home;
