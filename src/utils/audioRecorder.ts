import { requestMicrophonePermission, isNativePlatform } from './nativePermissions';

export class AudioRecorder {
  private mediaRecorder: MediaRecorder | null = null;
  private audioChunks: Blob[] = [];
  private startTime: number = 0;
  private stream: MediaStream | null = null;
  private recordedMimeType: string = '';

  async startRecording(): Promise<void> {
    try {
      // Request microphone permission first (handles both native and web)
      const permission = await requestMicrophonePermission();
      
      if (!permission.granted) {
        throw new Error('Microphone permission denied. Please grant microphone access in your device settings.');
      }

      this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      // Detect iOS devices
      const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
      
      // Use appropriate MIME type based on platform
      let mimeType: string;
      if (isIOS) {
        // iOS prefers MP4 or AAC
        mimeType = MediaRecorder.isTypeSupported('audio/mp4')
          ? 'audio/mp4'
          : MediaRecorder.isTypeSupported('audio/aac')
          ? 'audio/aac'
          : 'audio/wav';
      } else {
        // Android/Desktop: use WebM with Opus for better compression
        mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
          ? 'audio/webm;codecs=opus'
          : 'audio/webm';
      }

      this.recordedMimeType = mimeType;
      this.mediaRecorder = new MediaRecorder(this.stream, { mimeType });
      this.audioChunks = [];
      this.startTime = Date.now();

      this.mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          this.audioChunks.push(event.data);
        }
      };

      // Start with timeslice to ensure data is captured
      this.mediaRecorder.start(100);
      
      console.log('[AudioRecorder] Recording started with MIME type:', mimeType, 'Native platform:', isNativePlatform());
    } catch (error: any) {
      console.error('Error starting recording:', error);
      
      // Provide more specific error messages
      if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
        throw new Error('Microphone access denied. Please enable microphone permission in your device settings.');
      } else if (error.name === 'NotFoundError') {
        throw new Error('No microphone found. Please connect a microphone and try again.');
      } else if (error.name === 'NotReadableError') {
        throw new Error('Microphone is in use by another application. Please close other apps using the microphone.');
      }
      
      throw new Error(error.message || 'Failed to access microphone. Please grant permission.');
    }
  }

  async stopRecording(): Promise<{ blob: Blob; mimeType: string }> {
    return new Promise((resolve, reject) => {
      if (!this.mediaRecorder) {
        reject(new Error('No recording in progress'));
        return;
      }

      this.mediaRecorder.onstop = () => {
        const audioBlob = new Blob(this.audioChunks, { type: this.recordedMimeType });
        const mimeType = this.recordedMimeType;
        console.log('[AudioRecorder] Recording stopped - Blob size:', audioBlob.size, 'bytes, MIME type:', mimeType);
        this.cleanup();
        resolve({ blob: audioBlob, mimeType });
      };

      this.mediaRecorder.stop();
    });
  }

  cancelRecording(): void {
    if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
      this.mediaRecorder.stop();
    }
    this.cleanup();
  }

  getDuration(): number {
    return Math.floor((Date.now() - this.startTime) / 1000);
  }

  isRecording(): boolean {
    return this.mediaRecorder?.state === 'recording';
  }

  private cleanup(): void {
    if (this.stream) {
      this.stream.getTracks().forEach(track => track.stop());
      this.stream = null;
    }
    this.audioChunks = [];
    this.mediaRecorder = null;
  }
}
