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
  const activeCallId = useRef<string | null>(null);

  // New Refs for Recording
  const mediaRecorder = useRef<MediaRecorder | null>(null);
  const recordedChunks = useRef<Blob[]>([]);
  const currentCallId = useRef<string | null>(null); // To associate audio with a call

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
      if (socketId === socket.id) return; 
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

    socket.on('call-started', ({ callId }) => {
      if (!callId) {
        console.error('No call ID received from server.');
        return;
      }
      console.log(`Call started with ID: ${callId}`);
      currentCallId.current = callId;
      activeCallId.current = callId;
      startRecording();
    });

    socket.on('call-ended', ({ callId }) => {
      console.log(`Call ended with ID: ${callId}`);
      stopRecording();
      currentCallId.current = null;
    });

    return () => {
      console.log('Detaching socket event listeners.');
      socket.off('connect');
      socket.off('signal');
      socket.off('user-joined');
      socket.off('user-left');
      socket.off('speaking-status');
      socket.off('call-started');
      socket.off('call-ended');
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

    // End the call if active
    if (currentCallId.current) {
      socket?.emit('end-call', { callId: currentCallId.current, room });
    }
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
      // Start the call if not already started
      if (!currentCallId.current) {
        startCall();
      }
    } else {
      console.log('You are now listening');
      // End the call if active
      if (currentCallId.current) {
        socket?.emit('end-call', { callId: currentCallId.current, room });
      }
    }
  };

  const emitSpeakingStatus = (status: boolean) => {
    socket?.emit(status ? 'start-speaking' : 'stop-speaking', { room });
  };

  // New Functions for Recording
  const startRecording = () => {
    if (userStream.current) {
      mediaRecorder.current = new MediaRecorder(userStream.current);
      recordedChunks.current = [];

      mediaRecorder.current.ondataavailable = (event) => {
        if (event.data.size > 0) {
          recordedChunks.current.push(event.data);
        }
      };

      mediaRecorder.current.onstop = async () => {
        const blob = new Blob(recordedChunks.current, { type: 'audio/webm' });
        console.log('Recording stopped, preparing to upload audio.');
        console.log('blob>>>>', blob);
      
        // Capture the callId before it's reset
        const callId = activeCallId.current;
      
        if (!callId) {
          console.error('No call ID associated with the audio file.');
          return;
        }
      
        // Convert blob to File
        const file = new File([blob], `call-${callId}.webm`, { type: 'audio/webm' });
        console.log('file>>>>', file);
      
        // Upload the audio file to the server
        console.log('going to call upload audio api', callId, file);
        await uploadAudio(file, callId);
      
        // Reset activeCallId
        activeCallId.current = null;
      };
      

      mediaRecorder.current.start();
      console.log('Audio recording started.');
    }
  };

  const stopRecording = () => {
    if (mediaRecorder.current && mediaRecorder.current.state !== 'inactive') {
      mediaRecorder.current.stop();
      console.log('Audio recording stopped.');
  
      if (!activeCallId.current) {
        console.error('No valid call ID found. Skipping upload.');
      }
    }
  };
  
  const uploadAudio = async (file: File, callId: string | null) => {
    console.log('uploadAudio', file, callId);
    if (!callId) {
      console.error('No call ID associated with the audio file.');
      return;
    }

    const formData = new FormData();
    formData.append('callId', callId);
    formData.append('audio', file);
console.log('FormData:', formData);
    try {
      console.log('Uploading audio file...');
      const response = await fetch('http://localhost:3005/audio/upload', {
        method: 'POST',
        body: formData,
      });
console.log('Response of Uploading audio file', response);
      if (response.ok) {
        console.log('Audio file uploaded successfully.');
      } else {
        const error = await response.json();
        console.error('Failed to upload audio file:', error.message);
      }
    } catch (error) {
      console.error('Error uploading audio file:', error);
    }
  };

  const downloadAudio = async (callId: string) => {
    try {
      const response = await fetch(`http://localhost:4000/audio/${callId}/download`);
      if (!response.ok) {
        throw new Error('Failed to download audio');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `call-${callId}.webm`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      console.log('Audio file downloaded successfully.');
    } catch (error) {
      console.error('Error downloading audio file:', error);
    }
  };

  const startCall = () => {
    const receiverSocketId = getReceiverSocketId();
    if (receiverSocketId) {
      socket?.emit('start-call', { room, receiverSocketId });
      console.log('Call initiated.');
    } else {
      console.error('No receiver socket ID found to initiate the call.');
    }
  };

  const getReceiverSocketId = (): string | null => {
    const callerSocketId = socket?.id;
    const peerSocketIds = Object.keys(peers).filter(id => id !== callerSocketId);
    return peerSocketIds.length > 0 ? peerSocketIds[0] : null;
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
          {/* Button to download audio after call ends */}
          {currentCallId.current && !micActive && (
            <button
              onClick={() => downloadAudio(currentCallId.current as string)}
              style={{ padding: '8px 16px', marginTop: '20px' }}
            >
              Download Conversation
            </button>
          )}
        </div>
      )}
    </div>
  );
};

export default Home;
