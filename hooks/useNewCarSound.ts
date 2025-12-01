import { useCallback } from 'react';
import { Platform } from 'react-native';

export function useNewCarSound() {
  const playNewCarSound = useCallback(async () => {
    try {
      if (Platform.OS === 'web') {
        const AudioContextClass = (window as any).AudioContext || (window as any).webkitAudioContext;
        if (!AudioContextClass) {
          console.log('Web Audio API not supported');
          return;
        }
        
        const audioContext = new AudioContextClass();
        
        const playTone = (freq: number, startTime: number, duration: number) => {
          const oscillator = audioContext.createOscillator();
          const gainNode = audioContext.createGain();
          
          oscillator.connect(gainNode);
          gainNode.connect(audioContext.destination);
          
          oscillator.frequency.setValueAtTime(freq, startTime);
          oscillator.type = 'sine';
          
          gainNode.gain.setValueAtTime(0.3, startTime);
          gainNode.gain.exponentialRampToValueAtTime(0.01, startTime + duration);
          
          oscillator.start(startTime);
          oscillator.stop(startTime + duration);
        };
        
        const now = audioContext.currentTime;
        playTone(523.25, now, 0.15);
        playTone(659.25, now + 0.15, 0.15);
        playTone(783.99, now + 0.3, 0.2);
        
      } else {
        console.log('Sound notification (native): New car detected!');
      }
    } catch (error) {
      console.log('Sound playback error:', error);
    }
  }, []);

  return { playNewCarSound };
}
